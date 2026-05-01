from fastapi import HTTPException, Request

from campuscloud_dp import db


def add_network_routes(app):
    @app.get("/ui/api/network-overview")
    async def network_overview(request: Request):
        project_id = request.query_params.get("project_id", "").strip()
        if not project_id:
            raise HTTPException(status_code=400, detail="project_id is required")

        items = db.list_instances(request.app.state.db_path, project_id=project_id)
        return {
            "project_id": project_id,
            "network_name": get_network_name(request.app, project_id),
            "active_instance_count": db.count_scalable_instances(
                request.app.state.db_path,
                project_id,
            ),
            "instances": [
                {
                    "id": item["id"],
                    "name": item["name"],
                    "status": item["status"],
                    "docker_container_id": item["docker_container_id"],
                }
                for item in items
            ],
            "isolation_rules": [
                "One project maps to one managed Docker bridge network.",
                "Containers from different projects do not share the same managed network.",
                "Network cleanup runs only when the last active instance is deleted.",
            ],
        }


def get_network_name(app, project_id):
    return app.state.docker_helper.get_network_name(project_id)


def make_sure_network_exists(app, project_id):
    return app.state.docker_helper.ensure_project_network(project_id)


def remove_network_if_unused(app, project_id):
    left = db.count_scalable_instances(app.state.db_path, project_id)
    live = count_live_project_containers(app).get(project_id, 0)
    if left == 0 and live == 0:
        try:
            app.state.docker_helper.delete_project_network(project_id)
        except Exception:
            pass


def cleanup_orphan_networks(app):
    live = count_live_project_containers(app)
    try:
        networks = app.state.docker_helper.list_managed_networks()
    except Exception:
        return

    for item in networks:
        project_id = item.get("project_id", "")
        if not project_id:
            continue
        tracked = db.count_scalable_instances(app.state.db_path, project_id)
        if tracked == 0 and live.get(project_id, 0) == 0:
            try:
                app.state.docker_helper.delete_project_network(project_id)
            except Exception:
                pass


def count_live_project_containers(app):
    try:
        items = app.state.docker_helper.list_managed_containers()
    except Exception:
        return {}

    counts = {}
    for item in items:
        project_id = item.get("project_id", "")
        if not project_id:
            continue
        counts[project_id] = counts.get(project_id, 0) + 1
    return counts
