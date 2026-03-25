import tempfile
import unittest

from fastapi.testclient import TestClient

from campuscloud_dp.main import create_app


class FakeDockerHelper:
    def __init__(self, network_prefix="campuscloud-project"):
        self.network_prefix = network_prefix
        self.networks = set()
        self.containers = {}

    def get_network_name(self, project_id):
        return f"{self.network_prefix}-{project_id}"

    def ensure_project_network(self, project_id):
        network_name = self.get_network_name(project_id)
        self.networks.add(network_name)
        return network_name

    def create_container(
        self,
        instance_id,
        project_id,
        image,
        name,
        cpu_millicores,
        memory_mb,
    ):
        if image == "bad:image":
            raise RuntimeError("image not found")

        network_name = self.ensure_project_network(project_id)
        container_id = "ctr-" + instance_id[:8]
        self.containers[container_id] = {
            "instance_id": instance_id,
            "project_id": project_id,
            "container_id": container_id,
            "name": name,
            "image": image,
            "status": "running",
            "network_name": network_name,
            "cpu_millicores": cpu_millicores,
            "memory_mb": memory_mb,
        }
        return {
            "instance_id": instance_id,
            "project_id": project_id,
            "container_id": container_id,
            "name": name,
            "image": image,
            "status": "running",
            "network_name": network_name,
        }

    def stop_container(self, container_id, timeout_seconds):
        container = self.containers.get(container_id)
        if not container:
            return False
        container["status"] = "stopped"
        return True

    def remove_container(self, container_id):
        return self.containers.pop(container_id, None) is not None

    def delete_project_network(self, project_id):
        network_name = self.get_network_name(project_id)
        if any(item["project_id"] == project_id for item in self.containers.values()):
            return False
        if network_name in self.networks:
            self.networks.remove(network_name)
            return True
        return False

    def list_managed_containers(self):
        return list(self.containers.values())

    def get_stats(self, container_id):
        item = self.containers[container_id]
        return {
            "cpu_percent": 12.5,
            "memory_mb": float(item["memory_mb"]) / 2,
        }

    def seed_container(self, instance_id, project_id, name, image, status="running"):
        network_name = self.ensure_project_network(project_id)
        container_id = "seed-" + instance_id[:8]
        self.containers[container_id] = {
            "instance_id": instance_id,
            "project_id": project_id,
            "container_id": container_id,
            "name": name,
            "image": image,
            "status": status,
            "network_name": network_name,
            "cpu_millicores": 0,
            "memory_mb": 0,
        }


def deny_quota(project_id, cpu_millicores, memory_mb):
    return False, "Quota exceeded"


class ApiTests(unittest.TestCase):
    def build_app(self, docker_helper=None, quota_checker=None):
        self.tempdir = tempfile.TemporaryDirectory()
        settings = {
            "database_url": f"sqlite:///{self.tempdir.name}/test.db",
            "metrics_poll_interval_seconds": 60,
            "stop_timeout_seconds": 5,
            "project_network_prefix": "campuscloud-project",
        }
        return create_app(
            settings=settings,
            docker_helper=docker_helper or FakeDockerHelper(),
            quota_checker=quota_checker,
            start_background_jobs=False,
        )

    def tearDown(self):
        tempdir = getattr(self, "tempdir", None)
        if tempdir is not None:
            tempdir.cleanup()

    def test_create_list_stop_delete_flow(self):
        docker_helper = FakeDockerHelper()
        app = self.build_app(docker_helper=docker_helper)
        with TestClient(app) as client:
            create_response = client.post(
                "/instance",
                json={
                    "project_id": "project-a",
                    "image": "nginx:alpine",
                    "cpu_millicores": 500,
                    "memory_mb": 256,
                },
            )
            self.assertEqual(create_response.status_code, 201)
            instance = create_response.json()
            self.assertEqual(instance["status"], "running")

            list_response = client.get("/instances", params={"project_id": "project-a"})
            self.assertEqual(list_response.status_code, 200)
            self.assertEqual(len(list_response.json()), 1)

            stop_response = client.post(f"/instance/{instance['id']}/stop")
            self.assertEqual(stop_response.status_code, 200)
            self.assertEqual(stop_response.json()["status"], "stopped")

            stop_again = client.post(f"/instance/{instance['id']}/stop")
            self.assertEqual(stop_again.status_code, 200)
            self.assertEqual(stop_again.json()["status"], "stopped")

            delete_response = client.delete(f"/instance/{instance['id']}")
            self.assertEqual(delete_response.status_code, 204)

            delete_again = client.delete(f"/instance/{instance['id']}")
            self.assertEqual(delete_again.status_code, 204)

            list_after_delete = client.get("/instances", params={"project_id": "project-a"})
            self.assertEqual(list_after_delete.status_code, 200)
            self.assertEqual(list_after_delete.json(), [])

    def test_project_isolation_and_limits(self):
        docker_helper = FakeDockerHelper()
        app = self.build_app(docker_helper=docker_helper)
        with TestClient(app) as client:
            first = client.post(
                "/instance",
                json={
                    "project_id": "project-a",
                    "image": "nginx:alpine",
                    "cpu_millicores": 250,
                    "memory_mb": 128,
                },
            )
            second = client.post(
                "/instance",
                json={
                    "project_id": "project-b",
                    "image": "redis:7",
                    "cpu_millicores": 750,
                    "memory_mb": 512,
                },
            )
            self.assertEqual(first.status_code, 201)
            self.assertEqual(second.status_code, 201)
            self.assertEqual(len(docker_helper.networks), 2)

            project_a = client.get("/instances", params={"project_id": "project-a"})
            project_b = client.get("/instances", params={"project_id": "project-b"})
            self.assertEqual(len(project_a.json()), 1)
            self.assertEqual(len(project_b.json()), 1)
            self.assertNotEqual(
                project_a.json()[0]["network_name"],
                project_b.json()[0]["network_name"],
            )

            first_container = next(iter(docker_helper.containers.values()))
            self.assertEqual(first_container["cpu_millicores"], 250)
            self.assertEqual(first_container["memory_mb"], 128)

    def test_metrics_collection(self):
        app = self.build_app(docker_helper=FakeDockerHelper())
        with TestClient(app) as client:
            create_response = client.post(
                "/instance",
                json={
                    "project_id": "project-a",
                    "image": "nginx:alpine",
                    "cpu_millicores": 500,
                    "memory_mb": 256,
                },
            )
            self.assertEqual(create_response.status_code, 201)

            app.state.metrics_worker.collect_once()

            metrics_response = client.get(
                "/ui/api/metrics",
                params={"project_id": "project-a"},
            )
            self.assertEqual(metrics_response.status_code, 200)
            metrics = metrics_response.json()
            self.assertEqual(metrics["sample_count"], 1)
            self.assertGreater(metrics["latest"]["cpu_percent"], 0.0)

    def test_bad_image_marks_instance_failed(self):
        app = self.build_app(docker_helper=FakeDockerHelper())
        with TestClient(app) as client:
            create_response = client.post(
                "/instance",
                json={
                    "project_id": "project-a",
                    "image": "bad:image",
                    "cpu_millicores": 100,
                    "memory_mb": 64,
                },
            )
            self.assertEqual(create_response.status_code, 400)

            list_response = client.get("/instances", params={"project_id": "project-a"})
            self.assertEqual(list_response.status_code, 200)
            items = list_response.json()
            self.assertEqual(len(items), 1)
            self.assertEqual(items[0]["status"], "failed")
            self.assertIn("image not found", items[0]["last_error"])

    def test_startup_resync_restores_tracking(self):
        docker_helper = FakeDockerHelper()
        docker_helper.seed_container(
            "seed-1234",
            "project-a",
            "seed-instance",
            "nginx:alpine",
        )
        app = self.build_app(docker_helper=docker_helper)
        with TestClient(app) as client:
            response = client.get("/instances", params={"project_id": "project-a"})
            self.assertEqual(response.status_code, 200)
            items = response.json()
            self.assertEqual(len(items), 1)
            self.assertEqual(items[0]["id"], "seed-1234")
            self.assertEqual(items[0]["status"], "running")

    def test_quota_denial_returns_conflict(self):
        app = self.build_app(
            docker_helper=FakeDockerHelper(),
            quota_checker=deny_quota,
        )
        with TestClient(app) as client:
            response = client.post(
                "/instance",
                json={
                    "project_id": "project-a",
                    "image": "nginx:alpine",
                    "cpu_millicores": 250,
                    "memory_mb": 128,
                },
            )
            self.assertEqual(response.status_code, 409)
            self.assertEqual(response.json()["detail"], "Quota exceeded")


if __name__ == "__main__":
    unittest.main()
