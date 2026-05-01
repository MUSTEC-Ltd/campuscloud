from uuid import uuid4

from fastapi import HTTPException, Request, Response

from campuscloud_dp import db
from campuscloud_dp.groups import network


def add_compute_routes(app):
    @app.post("/instance", status_code=201)
    async def create_instance(request: Request):
        data = await request.json()
        project_id = str(data.get("project_id", "")).strip()
        image = str(data.get("image", "")).strip()
        name = str(data.get("name", "")).strip()
        cpu_millicores = parse_positive_number(data.get("cpu_millicores"), "cpu_millicores")
        memory_mb = parse_positive_number(data.get("memory_mb"), "memory_mb")

        if not project_id:
            raise HTTPException(status_code=400, detail="project_id is required")
        if not image:
            raise HTTPException(status_code=400, detail="image is required")

        allowed, reason = request.app.state.check_quota(project_id, cpu_millicores, memory_mb)
        if not allowed:
            raise HTTPException(status_code=409, detail=reason or "Quota exceeded")

        instance_id = str(uuid4())
        if not name:
            name = "instance-" + instance_id[:8]

        network_name = network.get_network_name(request.app, project_id)
        row = db.make_instance_row(
            instance_id,
            project_id,
            name,
            image,
            cpu_millicores,
            memory_mb,
            network_name,
        )
        db.add_instance(request.app.state.db_path, row)

        try:
            runtime = request.app.state.docker_helper.create_container(
                instance_id,
                project_id,
                image,
                name,
                cpu_millicores,
                memory_mb,
            )
        except Exception as error:
            db.update_instance(
                request.app.state.db_path,
                instance_id,
                {
                    "status": "failed",
                    "last_error": str(error),
                },
            )
            raise HTTPException(
                status_code=400,
                detail=f"Failed to create container: {error}",
            )

        return db.update_instance(
            request.app.state.db_path,
            instance_id,
            {
                "docker_container_id": runtime["container_id"],
                "status": runtime["status"],
                "network_name": runtime["network_name"],
                "image": runtime["image"] or image,
                "last_error": None,
            },
        )

    @app.post("/instance/{instance_id}/stop")
    async def stop_instance(instance_id, request: Request):
        item = db.get_instance(request.app.state.db_path, instance_id)
        if item is None:
            raise HTTPException(status_code=404, detail="Instance not found")
        if item["status"] in ["stopped", "failed", "deleted"]:
            return item

        if item["docker_container_id"]:
            try:
                request.app.state.docker_helper.stop_container(
                    item["docker_container_id"],
                    request.app.state.settings["stop_timeout_seconds"],
                )
            except Exception as error:
                db.update_instance(
                    request.app.state.db_path,
                    instance_id,
                    {"last_error": str(error)},
                )
                raise HTTPException(
                    status_code=502,
                    detail=f"Failed to stop container: {error}",
                )

        return db.update_instance(
            request.app.state.db_path,
            instance_id,
            {"status": "stopped"},
        )

    @app.delete("/instance/{instance_id}", status_code=204)
    async def delete_instance(instance_id, request: Request):
        item = db.get_instance(request.app.state.db_path, instance_id)
        if item is None:
            return Response(status_code=204)

        if item["status"] != "deleted":
            if item["docker_container_id"] and item["status"] == "running":
                try:
                    request.app.state.docker_helper.stop_container(
                        item["docker_container_id"],
                        request.app.state.settings["stop_timeout_seconds"],
                    )
                except Exception as error:
                    db.update_instance(
                        request.app.state.db_path,
                        instance_id,
                        {"last_error": str(error)},
                    )

            if item["docker_container_id"]:
                try:
                    request.app.state.docker_helper.remove_container(item["docker_container_id"])
                except Exception as error:
                    db.update_instance(
                        request.app.state.db_path,
                        instance_id,
                        {"last_error": str(error)},
                    )
                    raise HTTPException(
                        status_code=502,
                        detail=f"Failed to remove container: {error}",
                    )

            db.update_instance(
                request.app.state.db_path,
                instance_id,
                {"status": "deleted"},
            )
            network.remove_network_if_unused(request.app, item["project_id"])

        return Response(status_code=204)

    @app.get("/instances")
    async def list_project_instances(request: Request):
        project_id = request.query_params.get("project_id", "").strip()
        if not project_id:
            raise HTTPException(status_code=400, detail="project_id is required")
        return db.list_instances(request.app.state.db_path, project_id=project_id)


def parse_positive_number(value, field_name):
    try:
        number = int(value)
    except Exception:
        raise HTTPException(status_code=400, detail=f"{field_name} must be a positive number")
    if number <= 0:
        raise HTTPException(status_code=400, detail=f"{field_name} must be a positive number")
    return number
