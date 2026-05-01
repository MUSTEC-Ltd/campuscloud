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

        profile = resolve_scale_profile(
            request.app,
            project_id,
            image,
            cpu_millicores,
            memory_mb,
            1,
        )

        current_count = db.count_scalable_instances(request.app.state.db_path, project_id)
        require_quota(
            request.app,
            project_id,
            current_count,
            current_count + 1,
            profile["cpu_millicores"],
            profile["memory_mb"],
        )

        return create_one_instance(
            request.app,
            project_id,
            profile,
            explicit_name=name or None,
        )

    @app.post("/scale")
    async def scale_project(request: Request):
        data = await request.json()
        project_id = str(data.get("project_id", "")).strip()
        target_count = parse_non_negative_number(data.get("target_instances"), "target_instances")
        image = str(data.get("image", "")).strip()
        cpu_millicores = parse_optional_positive_number(
            data.get("cpu_millicores"),
            "cpu_millicores",
        )
        memory_mb = parse_optional_positive_number(data.get("memory_mb"), "memory_mb")
        name_prefix = str(data.get("name_prefix", "")).strip()

        if not project_id:
            raise HTTPException(status_code=400, detail="project_id is required")

        previous_count = db.count_scalable_instances(request.app.state.db_path, project_id)
        current_count = previous_count
        created_instance_ids = []
        deleted_instance_ids = []
        profile = None

        if target_count > current_count:
            profile = resolve_scale_profile(
                request.app,
                project_id,
                image,
                cpu_millicores,
                memory_mb,
                target_count,
            )
            require_quota(
                request.app,
                project_id,
                current_count,
                target_count,
                profile["cpu_millicores"],
                profile["memory_mb"],
            )

            created_rows = []
            try:
                for _ in range(target_count - current_count):
                    row = create_one_instance(
                        request.app,
                        project_id,
                        profile,
                        name_prefix=name_prefix or project_id,
                    )
                    created_rows.append(row)
                    created_instance_ids.append(row["id"])
            except HTTPException as error:
                rollback_created_instances(request.app, created_rows)
                network.cleanup_orphan_networks(request.app)
                raise error

        if target_count < current_count:
            candidates = pick_scale_down_candidates(
                db.list_scalable_instances(
                    request.app.state.db_path,
                    project_id,
                    newest_first=True,
                )
            )
            for item in candidates[: current_count - target_count]:
                try:
                    delete_one_instance(request.app, item)
                except HTTPException as error:
                    network.cleanup_orphan_networks(request.app)
                    raise HTTPException(
                        status_code=502,
                        detail=(
                            "Failed during scale-down after deleting "
                            f"{len(deleted_instance_ids)} instance(s): {error.detail}"
                        ),
                    )
                deleted_instance_ids.append(item["id"])

        network.cleanup_orphan_networks(request.app)
        current_count = db.count_scalable_instances(request.app.state.db_path, project_id)

        if profile is None:
            profile = db.get_project_profile(request.app.state.db_path, project_id)

        return {
            "project_id": project_id,
            "previous_count": previous_count,
            "target_count": target_count,
            "current_count": current_count,
            "created_instance_ids": created_instance_ids,
            "deleted_instance_ids": deleted_instance_ids,
            "network_name": network.get_network_name(request.app, project_id),
            "workload_profile": profile,
        }

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
            delete_one_instance(request.app, item)
            network.cleanup_orphan_networks(request.app)

        return Response(status_code=204)

    @app.get("/instances")
    async def list_project_instances(request: Request):
        project_id = request.query_params.get("project_id", "").strip()
        if not project_id:
            raise HTTPException(status_code=400, detail="project_id is required")
        return db.list_instances(request.app.state.db_path, project_id=project_id)


def create_one_instance(app, project_id, profile, explicit_name=None, name_prefix=None):
    instance_id = str(uuid4())
    name = build_instance_name(instance_id, explicit_name, name_prefix)
    network_name = network.get_network_name(app, project_id)
    row = db.make_instance_row(
        instance_id,
        project_id,
        name,
        profile["image"],
        profile["cpu_millicores"],
        profile["memory_mb"],
        network_name,
    )
    db.add_instance(app.state.db_path, row)

    try:
        runtime = app.state.docker_helper.create_container(
            instance_id,
            project_id,
            profile["image"],
            name,
            profile["cpu_millicores"],
            profile["memory_mb"],
        )
    except Exception as error:
        db.update_instance(
            app.state.db_path,
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
        app.state.db_path,
        instance_id,
        {
            "docker_container_id": runtime["container_id"],
            "status": runtime["status"],
            "network_name": runtime["network_name"],
            "image": runtime["image"] or profile["image"],
            "last_error": None,
        },
    )


def delete_one_instance(app, item, ignore_errors=False):
    if item["status"] == "deleted":
        return item

    if item["docker_container_id"] and item["status"] not in ["stopped", "failed"]:
        try:
            app.state.docker_helper.stop_container(
                item["docker_container_id"],
                app.state.settings["stop_timeout_seconds"],
            )
        except Exception as error:
            db.update_instance(
                app.state.db_path,
                item["id"],
                {"last_error": str(error)},
            )
            if not ignore_errors:
                raise HTTPException(
                    status_code=502,
                    detail=f"Failed to stop container: {error}",
                )

    if item["docker_container_id"]:
        try:
            app.state.docker_helper.remove_container(item["docker_container_id"])
        except Exception as error:
            db.update_instance(
                app.state.db_path,
                item["id"],
                {"last_error": str(error)},
            )
            if not ignore_errors:
                raise HTTPException(
                    status_code=502,
                    detail=f"Failed to remove container: {error}",
                )

    return db.update_instance(
        app.state.db_path,
        item["id"],
        {"status": "deleted"},
    )


def rollback_created_instances(app, items):
    for item in items:
        try:
            delete_one_instance(app, item, ignore_errors=True)
        except Exception:
            pass


def resolve_scale_profile(app, project_id, image, cpu_millicores, memory_mb, target_count):
    profile = db.get_project_profile(app.state.db_path, project_id)
    if profile is not None:
        check_profile_conflicts(profile, image, cpu_millicores, memory_mb)
        return profile

    if target_count > 0:
        if not image:
            raise HTTPException(status_code=400, detail="image is required when scaling from zero")
        if cpu_millicores is None:
            raise HTTPException(
                status_code=400,
                detail="cpu_millicores is required when scaling from zero",
            )
        if memory_mb is None:
            raise HTTPException(
                status_code=400,
                detail="memory_mb is required when scaling from zero",
            )

    if target_count == 0:
        return None

    return {
        "project_id": project_id,
        "image": image,
        "cpu_millicores": cpu_millicores,
        "memory_mb": memory_mb,
        "network_name": network.get_network_name(app, project_id),
        "source_instance_id": None,
    }


def check_profile_conflicts(profile, image, cpu_millicores, memory_mb):
    if image and image != profile["image"]:
        raise HTTPException(
            status_code=409,
            detail="Project already has a different image profile",
        )
    if cpu_millicores is not None and cpu_millicores != profile["cpu_millicores"]:
        raise HTTPException(
            status_code=409,
            detail="Project already has a different CPU profile",
        )
    if memory_mb is not None and memory_mb != profile["memory_mb"]:
        raise HTTPException(
            status_code=409,
            detail="Project already has a different memory profile",
        )


def require_quota(app, project_id, current_count, target_count, cpu_millicores, memory_mb):
    allowed, reason, max_instances = app.state.check_quota(
        project_id,
        current_count,
        target_count,
        cpu_millicores,
        memory_mb,
    )
    if allowed:
        return

    message = reason or "Quota exceeded"
    if max_instances is not None:
        message = f"{message} (max instances: {max_instances})"
    raise HTTPException(status_code=409, detail=message)


def pick_scale_down_candidates(items):
    stopped = []
    running_like = []
    for item in items:
        if item["status"] == "stopped":
            stopped.append(item)
        else:
            running_like.append(item)
    return stopped + running_like


def build_instance_name(instance_id, explicit_name, name_prefix):
    if explicit_name:
        return explicit_name
    prefix = name_prefix or "instance"
    return f"{prefix}-{instance_id[:8]}"


def parse_positive_number(value, field_name):
    try:
        number = int(value)
    except Exception:
        raise HTTPException(status_code=400, detail=f"{field_name} must be a positive number")
    if number <= 0:
        raise HTTPException(status_code=400, detail=f"{field_name} must be a positive number")
    return number


def parse_optional_positive_number(value, field_name):
    if value in [None, ""]:
        return None
    return parse_positive_number(value, field_name)


def parse_non_negative_number(value, field_name):
    try:
        number = int(value)
    except Exception:
        raise HTTPException(status_code=400, detail=f"{field_name} must be zero or more")
    if number < 0:
        raise HTTPException(status_code=400, detail=f"{field_name} must be zero or more")
    return number
