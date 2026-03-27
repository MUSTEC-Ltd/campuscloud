"""
UI and frontend-support route tests for CampusCloud data plane.

Uses a fake Docker helper so tests run without a real Docker daemon.
"""

import tempfile
import unittest

from fastapi.testclient import TestClient

from campuscloud_dp.main import create_app


class MockDockerHelper:
    """In-memory stand-in for the real Docker client."""

    def __init__(self, net_prefix="campuscloud-project"):
        self._prefix = net_prefix
        self._networks = set()
        self._containers = {}

    def get_network_name(self, project_id):
        return f"{self._prefix}-{project_id}"

    def ensure_project_network(self, project_id):
        name = self.get_network_name(project_id)
        self._networks.add(name)
        return name

    def create_container(self, instance_id, project_id, image, name, cpu_millicores, memory_mb):
        net = self.ensure_project_network(project_id)
        cid = "ctr-" + instance_id[:8]
        self._containers[cid] = {
            "instance_id": instance_id,
            "project_id": project_id,
            "container_id": cid,
            "name": name,
            "image": image,
            "status": "running",
            "network_name": net,
            "cpu_millicores": cpu_millicores,
            "memory_mb": memory_mb,
        }
        return {
            "instance_id": instance_id,
            "project_id": project_id,
            "container_id": cid,
            "name": name,
            "image": image,
            "status": "running",
            "network_name": net,
        }

    def stop_container(self, container_id, timeout_seconds):
        ctr = self._containers.get(container_id)
        if ctr is None:
            return False
        ctr["status"] = "stopped"
        return True

    def remove_container(self, container_id):
        return self._containers.pop(container_id, None) is not None

    def delete_project_network(self, project_id):
        net = self.get_network_name(project_id)
        has_containers = any(c["project_id"] == project_id for c in self._containers.values())
        if has_containers:
            return False
        if net in self._networks:
            self._networks.remove(net)
            return True
        return False

    def list_managed_containers(self):
        return list(self._containers.values())

    def get_stats(self, container_id):
        ctr = self._containers[container_id]
        return {
            "cpu_percent": 22.5,
            "memory_mb": float(ctr["memory_mb"]) * 0.45,
        }


class TestFrontendRoutes(unittest.TestCase):
    """Verify that UI pages, assets, and API views work correctly."""

    def _create_app(self):
        self._tmpdir = tempfile.TemporaryDirectory()
        config = {
            "database_url": f"sqlite:///{self._tmpdir.name}/test.db",
            "metrics_poll_interval_seconds": 60,
            "stop_timeout_seconds": 5,
            "project_network_prefix": "campuscloud-project",
        }
        return create_app(
            settings=config,
            docker_helper=MockDockerHelper(),
            start_background_jobs=False,
        )

    def tearDown(self):
        tmp = getattr(self, "_tmpdir", None)
        if tmp is not None:
            tmp.cleanup()

    def test_ui_pages_are_accessible(self):
        """All main UI pages should return 200 and contain their marker text."""
        app = self._create_app()
        with TestClient(app) as http:
            resp = http.get("/")
            self.assertEqual(resp.status_code, 200)
            self.assertIn("CampusCloud Console", resp.text)

            pages = [
                ("compute", "Provision and manage isolated project workloads."),
                ("network", "Inspect project-level isolation boundaries."),
                ("monitoring", "Review stored resource usage for active workloads."),
                ("integration", "Track platform health and cross-service state."),
            ]
            for name, expected_text in pages:
                page_resp = http.get(f"/ui/{name}")
                self.assertEqual(page_resp.status_code, 200, f"/ui/{name} failed")
                self.assertIn(expected_text, page_resp.text)

            css = http.get("/ui/assets/styles.css")
            self.assertEqual(css.status_code, 200)
            self.assertIn("font-family", css.text)

    def test_summary_and_network_api(self):
        """After creating an instance, summary and network views reflect it."""
        app = self._create_app()
        with TestClient(app) as http:
            create_resp = http.post("/instance", json={
                "project_id": "project-a",
                "image": "nginx:alpine",
                "cpu_millicores": 250,
                "memory_mb": 128,
            })
            self.assertEqual(create_resp.status_code, 201)

            summary = http.get("/ui/api/summary").json()
            self.assertEqual(summary["health"], "ok")
            self.assertEqual(summary["active_instance_count"], 1)
            self.assertEqual(len(summary["modules"]), 4)
            self.assertEqual(summary["recent_instances"][0]["project_id"], "project-a")

            net = http.get("/ui/api/network-overview", params={"project_id": "project-a"}).json()
            self.assertEqual(net["project_id"], "project-a")
            self.assertEqual(net["active_instance_count"], 1)
            self.assertEqual(net["network_name"], "campuscloud-project-project-a")
            self.assertEqual(len(net["instances"]), 1)
            self.assertEqual(len(net["isolation_rules"]), 3)

    def test_monitoring_collection_and_retrieval(self):
        """Metrics worker should collect a sample and the API should return it."""
        app = self._create_app()
        with TestClient(app) as http:
            http.post("/instance", json={
                "project_id": "project-a",
                "image": "nginx:alpine",
                "cpu_millicores": 500,
                "memory_mb": 256,
            })

            # trigger one collection cycle manually
            app.state.metrics_worker.collect_once()

            metrics = http.get("/ui/api/metrics", params={"project_id": "project-a"}).json()
            self.assertEqual(metrics["project_id"], "project-a")
            self.assertEqual(metrics["sample_count"], 1)
            self.assertIsNotNone(metrics["latest"])
            self.assertEqual(len(metrics["samples"]), 1)

            integration = http.get("/ui/api/integration", params={"project_id": "project-a"}).json()
            self.assertEqual(integration["health"], "ok")
            self.assertFalse(integration["metrics_worker_running"])
            self.assertEqual(integration["settings"]["project_network_prefix"], "campuscloud-project")
            self.assertIsNotNone(integration["project_snapshot"])
            self.assertEqual(integration["project_snapshot"]["instance_count"], 1)


if __name__ == "__main__":
    unittest.main()
