"""
B7-B9 Basic Monitoring – metrics collection and retrieval.

Provides a background worker that periodically samples CPU and memory
from every running container, plus an API route to query stored samples.
"""

from threading import Event, Thread

from fastapi import HTTPException, Request

from campuscloud_dp import db

DEFAULT_SAMPLE_LIMIT = 12
MAX_SAMPLE_LIMIT = 50
MIN_SAMPLE_LIMIT = 1


class MetricsWorker:
    """Background thread that collects resource usage at a fixed interval."""

    def __init__(self, application, interval_seconds):
        self._app = application
        self._interval = interval_seconds
        self._shutdown = Event()
        self._worker_thread = None

    def start(self):
        if self._worker_thread is not None:
            return
        self._worker_thread = Thread(target=self._run, daemon=True)
        self._worker_thread.start()

    def stop(self):
        self._shutdown.set()
        if self._worker_thread is not None:
            self._worker_thread.join(timeout=self._interval + 1)
            self._worker_thread = None
        self._shutdown.clear()

    def is_running(self):
        return self._worker_thread is not None and self._worker_thread.is_alive()

    def collect_once(self):
        """Pull stats from every running instance and persist a sample row."""
        running = db.list_running_instances(self._app.state.db_path)
        for instance in running:
            container_id = instance["docker_container_id"]
            try:
                usage = self._app.state.docker_helper.get_stats(container_id)
            except Exception:
                continue

            db.add_sample(
                self._app.state.db_path,
                instance["id"],
                instance["project_id"],
                usage["cpu_percent"],
                usage["memory_mb"],
            )

    def _run(self):
        while not self._shutdown.wait(self._interval):
            self.collect_once()


def _parse_limit(raw_value):
    """Convert the limit query param to a safe integer."""
    try:
        parsed = int(raw_value)
    except (ValueError, TypeError):
        return DEFAULT_SAMPLE_LIMIT
    return max(MIN_SAMPLE_LIMIT, min(parsed, MAX_SAMPLE_LIMIT))


def add_monitoring_routes(app):
    @app.get("/ui/api/metrics")
    async def get_metrics(request: Request):
        pid = request.query_params.get("project_id", "").strip()
        if not pid:
            raise HTTPException(status_code=400, detail="project_id is required")

        limit = _parse_limit(request.query_params.get("limit", DEFAULT_SAMPLE_LIMIT))

        rows = db.list_samples(request.app.state.db_path, pid, limit)
        most_recent = rows[0] if rows else None

        return {
            "project_id": pid,
            "sample_count": len(rows),
            "latest": most_recent,
            "samples": rows,
        }
