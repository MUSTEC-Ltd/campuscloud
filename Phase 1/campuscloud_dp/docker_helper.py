MANAGED_LABEL_KEY = "campuscloud.managed"
PROJECT_LABEL_KEY = "campuscloud.project_id"
INSTANCE_LABEL_KEY = "campuscloud.instance_id"


class DockerHelper:
    def __init__(self, network_prefix):
        self.network_prefix = network_prefix
        self.client = None

    def get_client(self):
        if self.client is None:
            import docker

            self.client = docker.from_env()
        return self.client

    def get_network_name(self, project_id):
        return f"{self.network_prefix}-{project_id}"

    def ensure_project_network(self, project_id):
        name = self.get_network_name(project_id)
        networks = self.get_client().networks.list(names=[name])
        if networks:
            return name

        self.get_client().networks.create(
            name=name,
            driver="bridge",
            labels={
                MANAGED_LABEL_KEY: "true",
                PROJECT_LABEL_KEY: project_id,
            },
        )
        return name

    def create_container(
        self,
        instance_id,
        project_id,
        image,
        name,
        cpu_millicores,
        memory_mb,
    ):
        network_name = self.ensure_project_network(project_id)
        self.get_client().images.pull(image)
        container = self.get_client().containers.run(
            image=image,
            name=name,
            detach=True,
            labels={
                MANAGED_LABEL_KEY: "true",
                PROJECT_LABEL_KEY: project_id,
                INSTANCE_LABEL_KEY: instance_id,
            },
            nano_cpus=cpu_millicores * 1_000_000,
            mem_limit=f"{memory_mb}m",
            network=network_name,
        )
        container.reload()
        image_name = image
        if container.image.tags:
            image_name = container.image.tags[0]
        return {
            "instance_id": instance_id,
            "project_id": project_id,
            "container_id": container.id,
            "name": container.name,
            "image": image_name,
            "status": clean_status(container.status),
            "network_name": network_name,
        }

    def stop_container(self, container_id, timeout_seconds):
        try:
            container = self.get_client().containers.get(container_id)
        except Exception:
            return False
        container.stop(timeout=timeout_seconds)
        return True

    def remove_container(self, container_id):
        try:
            container = self.get_client().containers.get(container_id)
        except Exception:
            return False
        container.remove()
        return True

    def delete_project_network(self, project_id):
        name = self.get_network_name(project_id)
        networks = self.get_client().networks.list(names=[name])
        if not networks:
            return False
        networks[0].remove()
        return True

    def list_managed_containers(self):
        containers = self.get_client().containers.list(
            all=True,
            filters={"label": f"{MANAGED_LABEL_KEY}=true"},
        )
        items = []
        for container in containers:
            labels = container.labels or {}
            items.append(
                {
                    "instance_id": labels.get(INSTANCE_LABEL_KEY, container.id),
                    "project_id": labels.get(PROJECT_LABEL_KEY, ""),
                    "container_id": container.id,
                    "name": container.name,
                    "image": container.image.tags[0] if container.image.tags else "",
                    "status": clean_status(container.status),
                    "network_name": find_network_name(container.attrs),
                }
            )
        return items

    def get_stats(self, container_id):
        container = self.get_client().containers.get(container_id)
        stats = container.stats(stream=False)
        return {
            "cpu_percent": cpu_percent_from_stats(stats),
            "memory_mb": float(stats.get("memory_stats", {}).get("usage", 0.0))
            / (1024 * 1024),
        }


def clean_status(status):
    if status == "running":
        return "running"
    if status in ["created", "dead", "exited", "paused", "restarting"]:
        return "stopped"
    return "failed"


def find_network_name(attrs):
    networks = attrs.get("NetworkSettings", {}).get("Networks", {})
    if not networks:
        return ""
    return next(iter(networks.keys()))


def cpu_percent_from_stats(stats):
    cpu_stats = stats.get("cpu_stats", {})
    old_cpu_stats = stats.get("precpu_stats", {})
    cpu_usage = cpu_stats.get("cpu_usage", {}).get("total_usage", 0)
    old_cpu_usage = old_cpu_stats.get("cpu_usage", {}).get("total_usage", 0)
    system_usage = cpu_stats.get("system_cpu_usage", 0)
    old_system_usage = old_cpu_stats.get("system_cpu_usage", 0)
    online_cpus = cpu_stats.get("online_cpus")

    if not online_cpus:
        per_cpu = cpu_stats.get("cpu_usage", {}).get("percpu_usage") or [1]
        online_cpus = max(len(per_cpu), 1)

    cpu_delta = cpu_usage - old_cpu_usage
    system_delta = system_usage - old_system_usage
    if cpu_delta <= 0 or system_delta <= 0:
        return 0.0
    return (cpu_delta / system_delta) * online_cpus * 100.0
