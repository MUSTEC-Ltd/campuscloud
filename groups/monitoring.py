from datetime import datetime, timezone
from threading import Event, Thread

from fastapi import HTTPException, Request

from campuscloud_dp import db

CPU_HOUR_RATE_USD = 0.24
MEMORY_GB_HOUR_RATE_USD = 0.08
MINIMUM_BILLABLE_SECONDS = 60.0


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
                runtime_seconds_from_instance(item),
            )

    def loop(self):
        while not self.stop_event.wait(self.seconds):
            self.collect_once()


def add_monitoring_routes(app):
    @app.get("/metrics/{project_id}")
    async def metrics_api(project_id, request: Request):
        project_id = project_id.strip()
        if not project_id:
            raise HTTPException(status_code=400, detail="project_id is required")
        limit_number = get_limit_number(request.query_params.get("limit", "20"))
        return build_metrics_payload(request.app, project_id, limit_number)

    @app.get("/ui/api/metrics")
    async def metrics_view(request: Request):
        project_id = request.query_params.get("project_id", "").strip()
        if not project_id:
            raise HTTPException(status_code=400, detail="project_id is required")
        limit_number = get_limit_number(request.query_params.get("limit", "20"))
        return build_metrics_payload(request.app, project_id, limit_number)

def build_metrics_payload(app, project_id, limit_number):
    items = db.list_instances(
        app.state.db_path,
        project_id=project_id,
        include_deleted=False,
        newest_first=True,
    )
    samples = db.list_samples(app.state.db_path, project_id, limit_number)
    latest_samples = db.list_latest_samples(app.state.db_path, project_id)
    latest_map = {}
    for sample in latest_samples:
        latest_map[sample["instance_id"]] = sample

    instances = []
    totals = {
        "cpu_percent": 0.0,
        "memory_mb": 0.0,
        "runtime_seconds": 0.0,
    }
    billing_amount = 0.0
    for item in items:
        latest = latest_map.get(item["id"])
        if latest:
            totals["cpu_percent"] += latest["cpu_percent"]
            totals["memory_mb"] += latest["memory_mb"]
            totals["runtime_seconds"] += latest["runtime_seconds"]
            billing_amount += estimate_instance_billing(latest)
        instances.append(
            {
                "id": item["id"],
                "name": item["name"],
                "status": item["status"],
                "image": item["image"],
                "cpu_millicores": item["cpu_millicores"],
                "memory_mb": item["memory_mb"],
                "network_name": item["network_name"],
                "latest_cpu_percent": latest["cpu_percent"] if latest else None,
                "latest_memory_mb": latest["memory_mb"] if latest else None,
                "latest_runtime_seconds": latest["runtime_seconds"] if latest else None,
                "last_collected_at": latest["collected_at"] if latest else None,
                "estimated_billing_usd": round(estimate_instance_billing(latest), 4) if latest else 0.0,
            }
        )

    latest = samples[0] if samples else None
    return {
        "project_id": project_id,
        "generated_at": db.now_text(),
        "instance_count": len(items),
        "sample_count": len(samples),
        "totals": totals,
        "billing": {
            "currency": "USD",
            "amount_usd": round(billing_amount, 4),
            "cpu_hour_rate_usd": CPU_HOUR_RATE_USD,
            "memory_gb_hour_rate_usd": MEMORY_GB_HOUR_RATE_USD,
        },
        "latest": latest,
        "instances": instances,
        "samples": samples,
    }


def get_limit_number(raw_value):
    try:
        limit_number = int(str(raw_value).strip())
    except Exception:
        limit_number = 20
    if limit_number < 1:
        limit_number = 1
    if limit_number > 100:
        limit_number = 100
    return limit_number


def runtime_seconds_from_instance(item):
    created_at = item.get("created_at")
    if not created_at:
        return 0.0
    try:
        created = datetime.fromisoformat(created_at)
    except Exception:
        return 0.0
    return max((datetime.now(timezone.utc) - created).total_seconds(), 0.0)


def estimate_instance_billing(sample):
    if not sample:
        return 0.0
    runtime_seconds = max(float(sample.get("runtime_seconds", 0.0)), MINIMUM_BILLABLE_SECONDS)
    runtime_hours = runtime_seconds / 3600.0
    cpu_units = max(float(sample.get("cpu_percent", 0.0)), 0.0) / 100.0
    memory_gb = max(float(sample.get("memory_mb", 0.0)), 0.0) / 1024.0
    return (cpu_units * runtime_hours * CPU_HOUR_RATE_USD) + (
        memory_gb * runtime_hours * MEMORY_GB_HOUR_RATE_USD
    )
