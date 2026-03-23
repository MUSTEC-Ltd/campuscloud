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
            "cpu_percent": 18.75,
            "memory_mb": float(item["memory_mb"]) / 2,
        }


class UiTests(unittest.TestCase):
    def build_app(self):
        self.tempdir = tempfile.TemporaryDirectory()
        settings = {
            "database_url": f"sqlite:///{self.tempdir.name}/test.db",
            "metrics_poll_interval_seconds": 60,
            "stop_timeout_seconds": 5,
            "project_network_prefix": "campuscloud-project",
        }
        return create_app(
            settings=settings,
            docker_helper=FakeDockerHelper(),
            start_background_jobs=False,
        )

    def tearDown(self):
        tempdir = getattr(self, "tempdir", None)
        if tempdir is not None:
            tempdir.cleanup()

    def test_frontend_pages_and_assets_are_served(self):
        app = self.build_app()
        with TestClient(app) as client:
            root_response = client.get("/")
            self.assertEqual(root_response.status_code, 200)
            self.assertIn("CampusCloud Console", root_response.text)

            for page_name, marker in [
                ("compute", "Provision and manage isolated project workloads."),
                ("network", "Inspect project-level isolation boundaries."),
                ("monitoring", "Review stored resource usage for active workloads."),
                ("integration", "Track platform health and cross-service state."),
            ]:
                response = client.get(f"/ui/{page_name}")
                self.assertEqual(response.status_code, 200)
                self.assertIn(marker, response.text)

            css_response = client.get("/ui/assets/styles.css")
            self.assertEqual(css_response.status_code, 200)
            self.assertIn("font-family", css_response.text)

    def test_summary_and_network_views_return_expected_payloads(self):
        app = self.build_app()
        with TestClient(app) as client:
            create_response = client.post(
                "/instance",
                json={
                    "project_id": "project-a",
                    "image": "nginx:alpine",
                    "cpu_millicores": 250,
                    "memory_mb": 128,
                },
            )
            self.assertEqual(create_response.status_code, 201)

            summary_response = client.get("/ui/api/summary")
            self.assertEqual(summary_response.status_code, 200)
            summary = summary_response.json()
            self.assertEqual(summary["health"], "ok")
            self.assertEqual(summary["active_instance_count"], 1)
            self.assertEqual(len(summary["modules"]), 4)
            self.assertEqual(summary["recent_instances"][0]["project_id"], "project-a")

            network_response = client.get(
                "/ui/api/network-overview",
                params={"project_id": "project-a"},
            )
            self.assertEqual(network_response.status_code, 200)
            network = network_response.json()
            self.assertEqual(network["project_id"], "project-a")
            self.assertEqual(network["active_instance_count"], 1)
            self.assertEqual(network["network_name"], "campuscloud-project-project-a")
            self.assertEqual(len(network["instances"]), 1)
            self.assertEqual(len(network["isolation_rules"]), 3)

    def test_metrics_and_integration_views_return_project_state(self):
        app = self.build_app()
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
            self.assertEqual(metrics["project_id"], "project-a")
            self.assertEqual(metrics["sample_count"], 1)
            self.assertIsNotNone(metrics["latest"])
            self.assertEqual(len(metrics["samples"]), 1)

            integration_response = client.get(
                "/ui/api/integration",
                params={"project_id": "project-a"},
            )
            self.assertEqual(integration_response.status_code, 200)
            integration = integration_response.json()
            self.assertEqual(integration["health"], "ok")
            self.assertFalse(integration["metrics_worker_running"])
            self.assertEqual(
                integration["settings"]["project_network_prefix"],
                "campuscloud-project",
            )
            self.assertIsNotNone(integration["project_snapshot"])
            self.assertEqual(integration["project_snapshot"]["instance_count"], 1)


if __name__ == "__main__":
    unittest.main()
