from fastapi import FastAPI

from campuscloud_dp.config import get_database_path, load_settings
from campuscloud_dp.db import setup_db
from campuscloud_dp.docker_helper import DockerHelper
from campuscloud_dp.groups.compute import add_compute_routes
from campuscloud_dp.groups.integration import add_integration_routes, mount_files, run_startup_sync
from campuscloud_dp.groups.monitoring import MetricsWorker, add_monitoring_routes
from campuscloud_dp.groups.network import add_network_routes


def allow_everything(project_id, cpu_millicores, memory_mb):
    return True, ""


def clean_quota_checker(quota_checker):
    if quota_checker is None:
        return allow_everything
    if callable(quota_checker):
        return quota_checker

    def run_checker(project_id, cpu_millicores, memory_mb):
        result = quota_checker.can_launch(project_id, cpu_millicores, memory_mb)
        allowed = getattr(result, "allowed", True)
        reason = getattr(result, "reason", "")
        return allowed, reason

    return run_checker


def create_app(settings=None, docker_helper=None, quota_checker=None, start_background_jobs=True):
    app = FastAPI(title="CampusCloud Data Plane")
    app.state.settings = load_settings(settings)
    app.state.db_path = get_database_path(app.state.settings["database_url"])
    app.state.docker_helper = docker_helper or DockerHelper(
        app.state.settings["project_network_prefix"]
    )
    app.state.docker_adapter = app.state.docker_helper
    app.state.check_quota = clean_quota_checker(quota_checker)
    app.state.metrics_worker = MetricsWorker(
        app,
        app.state.settings["metrics_poll_interval_seconds"],
    )
    app.state.metrics_collector = app.state.metrics_worker
    app.state.start_background_jobs = start_background_jobs

    setup_db(app.state.db_path)
    mount_files(app)
    add_integration_routes(app)
    add_compute_routes(app)
    add_network_routes(app)
    add_monitoring_routes(app)

    @app.on_event("startup")
    def on_startup():
        setup_db(app.state.db_path)
        run_startup_sync(app)
        if app.state.start_background_jobs:
            app.state.metrics_worker.start()

    @app.on_event("shutdown")
    def on_shutdown():
        app.state.metrics_worker.stop()

    return app


app = create_app()
