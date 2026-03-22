from pathlib import Path

from fastapi import HTTPException, Request
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from campuscloud_dp import db

PACKAGE_DIR = Path(__file__).resolve().parent.parent
REPO_ROOT = PACKAGE_DIR.parent
UI_DIR = PACKAGE_DIR / "ui_assets"
UI_ASSETS_DIR = UI_DIR / "assets"
DELIVERABLES_DIR = REPO_ROOT / "phase1-deliverables"
UI_PAGES = ["compute", "network", "monitoring", "integration"]


def mount_files(app):
    if UI_ASSETS_DIR.exists():
        app.mount("/ui/assets", StaticFiles(directory=str(UI_ASSETS_DIR)), name="ui-assets")
    if DELIVERABLES_DIR.exists():
        app.mount("/deliverables", StaticFiles(directory=str(DELIVERABLES_DIR)), name="deliverables")


def add_integration_routes(app):
    @app.get("/", include_in_schema=False)
    async def home_page():
        return FileResponse(UI_DIR / "index.html")

    @app.get("/ui", include_in_schema=False)
    async def ui_home():
        return FileResponse(UI_DIR / "index.html")

    @app.get("/ui/{page_name}", include_in_schema=False)
    async def ui_page(page_name):
        if page_name not in UI_PAGES:
            raise HTTPException(status_code=404, detail="Page not found")
        return FileResponse(UI_DIR / f"{page_name}.html")

    @app.get("/health")
    async def health():
        return {"status": "ok"}

    @app.get("/ui/api/summary")
    async def summary(request: Request):
        items = db.list_instances(
            request.app.state.db_path,
            include_deleted=False,
            newest_first=True,
        )
        return {
            "health": "ok",
            "active_instance_count": len(items),
            "status_breakdown": build_status_breakdown(items),
            "recent_instances": items[:8],
            "modules": [
                {
                    "slug": "compute",
                    "title": "Compute Service",
                    "ui_path": "/ui/compute",
                    "api_doc": "/deliverables/compute-service/api-documentation.pdf",
                    "nist_doc": "/deliverables/compute-service/nist-mapping.pdf",
                },
                {
                    "slug": "network",
                    "title": "Network Isolation",
                    "ui_path": "/ui/network",
                    "api_doc": "/deliverables/network-isolation/api-documentation.pdf",
                    "nist_doc": "/deliverables/network-isolation/nist-mapping.pdf",
                },
                {
                    "slug": "monitoring",
                    "title": "Basic Monitoring",
                    "ui_path": "/ui/monitoring",
                    "api_doc": "/deliverables/basic-monitoring/api-documentation.pdf",
                    "nist_doc": "/deliverables/basic-monitoring/nist-mapping.pdf",
                },
                {
                    "slug": "integration",
                    "title": "Integration Support",
                    "ui_path": "/ui/integration",
                    "api_doc": "/deliverables/integration-support/api-documentation.pdf",
                    "nist_doc": "/deliverables/integration-support/nist-mapping.pdf",
                },
            ],
        }

    @app.get("/ui/api/integration")
    async def integration_view(request: Request):
        project_id = request.query_params.get("project_id", "").strip()
        snapshot = None

        if project_id:
            items = db.list_instances(request.app.state.db_path, project_id=project_id)
            snapshot = {
                "project_id": project_id,
                "instance_count": len(items),
                "status_breakdown": build_status_breakdown(items),
                "instances": items,
            }

        return {
            "health": "ok",
            "metrics_worker_running": request.app.state.metrics_worker.is_running(),
            "settings": {
                "metrics_poll_interval_seconds": request.app.state.settings[
                    "metrics_poll_interval_seconds"
                ],
                "project_network_prefix": request.app.state.settings["project_network_prefix"],
                "stop_timeout_seconds": request.app.state.settings["stop_timeout_seconds"],
            },
            "startup_features": [
                "database initialization",
                "group files loaded",
                "startup resync",
                "background metrics worker",
            ],
            "project_snapshot": snapshot,
        }


def run_startup_sync(app):
    try:
        live_items = app.state.docker_helper.list_managed_containers()
    except Exception:
        return

    live_instance_ids = set()
    live_container_ids = set()

    for item in live_items:
        live_instance_ids.add(item["instance_id"])
        live_container_ids.add(item["container_id"])

        old = db.get_instance(app.state.db_path, item["instance_id"])
        if old is None:
            row = db.make_instance_row(
                item["instance_id"],
                item["project_id"],
                item["name"],
                item["image"],
                0,
                0,
                item["network_name"],
            )
            row["docker_container_id"] = item["container_id"]
            row["status"] = item["status"]
            db.add_instance(app.state.db_path, row)
        else:
            db.update_instance(
                app.state.db_path,
                item["instance_id"],
                {
                    "docker_container_id": item["container_id"],
                    "name": item["name"],
                    "image": item["image"] or old["image"],
                    "status": item["status"],
                    "network_name": item["network_name"] or old["network_name"],
                },
            )

    tracked_items = db.list_instances(app.state.db_path, include_deleted=False)
    for item in tracked_items:
        if not item["docker_container_id"]:
            continue
        if item["id"] in live_instance_ids:
            continue
        if item["docker_container_id"] in live_container_ids:
            continue
        if item["status"] == "running":
            db.update_instance(
                app.state.db_path,
                item["id"],
                {
                    "status": "failed",
                    "last_error": "Container missing during startup sync",
                },
            )


def build_status_breakdown(items):
    breakdown = {}
    for item in items:
        status = item["status"]
        if status not in breakdown:
            breakdown[status] = 0
        breakdown[status] += 1
    return breakdown
