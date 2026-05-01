import os

DEFAULT_DATABASE_URL = "sqlite:///./campuscloud.db"
DEFAULT_METRICS_POLL_INTERVAL_SECONDS = 15
DEFAULT_STOP_TIMEOUT_SECONDS = 10
DEFAULT_PROJECT_NETWORK_PREFIX = "campuscloud-project"


def load_settings(extra=None):
    settings = {
        "database_url": os.getenv("DATABASE_URL", DEFAULT_DATABASE_URL),
        "metrics_poll_interval_seconds": int(
            os.getenv(
                "METRICS_POLL_INTERVAL_SECONDS",
                str(DEFAULT_METRICS_POLL_INTERVAL_SECONDS),
            )
        ),
        "stop_timeout_seconds": int(
            os.getenv("STOP_TIMEOUT_SECONDS", str(DEFAULT_STOP_TIMEOUT_SECONDS))
        ),
        "project_network_prefix": os.getenv(
            "PROJECT_NETWORK_PREFIX",
            DEFAULT_PROJECT_NETWORK_PREFIX,
        ),
    }

    if isinstance(extra, dict):
        for key, value in extra.items():
            settings[key] = value
    elif extra is not None:
        for key in list(settings.keys()):
            if hasattr(extra, key):
                settings[key] = getattr(extra, key)

    return settings


def get_database_path(database_url):
    if database_url.startswith("sqlite:///"):
        return database_url.replace("sqlite:///", "", 1)
    if database_url.startswith("sqlite://"):
        return database_url.replace("sqlite://", "", 1)
    return database_url
