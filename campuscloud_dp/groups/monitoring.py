from threading import Event, Thread

from fastapi import HTTPException, Request

from campuscloud_dp import db


class MetricsWorker:
    def __init__(self, app, seconds):
        self.app = app
        self.seconds = seconds
        self.stop_event = Event()
        self.thread = None

    def start(self):
        if self.thread is not None:
            return
        self.thread = Thread(target=self.loop, daemon=True)
        self.thread.start()

    def stop(self):
        self.stop_event.set()
        if self.thread is not None:
            self.thread.join(timeout=self.seconds + 1)
            self.thread = None
        self.stop_event.clear()

    def is_running(self):
        return self.thread is not None and self.thread.is_alive()

    def collect_once(self):
        items = db.list_running_instances(self.app.state.db_path)
        for item in items:
            try:
                stats = self.app.state.docker_helper.get_stats(item["docker_container_id"])
            except Exception:
                continue

            db.add_sample(
                self.app.state.db_path,
                item["id"],
                item["project_id"],
                stats["cpu_percent"],
                stats["memory_mb"],
            )

    def loop(self):
        while not self.stop_event.wait(self.seconds):
            self.collect_once()


def add_monitoring_routes(app):
    @app.get("/ui/api/metrics")
    async def metrics_view(request: Request):
        project_id = request.query_params.get("project_id", "").strip()
        if not project_id:
            raise HTTPException(status_code=400, detail="project_id is required")

        limit = request.query_params.get("limit", "12").strip()
        try:
            limit_number = int(limit)
        except Exception:
            limit_number = 12
        if limit_number < 1:
            limit_number = 1
        if limit_number > 50:
            limit_number = 50

        samples = db.list_samples(request.app.state.db_path, project_id, limit_number)
        latest = None
        if samples:
            latest = samples[0]

        return {
            "project_id": project_id,
            "sample_count": len(samples),
            "latest": latest,
            "samples": samples,
        }
