# CampusCloud Data Plane

This repo is a simpler student-style Phase 1 BDS-8B implementation. The backend is split by team area:

- `campuscloud_dp/groups/compute.py`
- `campuscloud_dp/groups/network.py`
- `campuscloud_dp/groups/monitoring.py`
- `campuscloud_dp/groups/integration.py`

Main features:

- container create, stop, delete, and list
- one Docker network per project
- CPU and memory limits
- basic CPU and memory sampling into a database
- one central demo page and one page per group

## Run

```bash
uv sync
uv run uvicorn campuscloud_dp.main:app --reload
```

Or just run:

```bash
./run_frontend.sh
```

Open the backend or UI in a browser:

- `http://127.0.0.1:8000/health`
- `http://127.0.0.1:8000/ui`
- `http://127.0.0.1:8000/ui/compute`
- `http://127.0.0.1:8000/ui/network`
- `http://127.0.0.1:8000/ui/monitoring`
- `http://127.0.0.1:8000/ui/integration`

The central UI at `/ui` links to the four group pages and the deliverable documents under `/deliverables/...`.

## Environment

- `DATABASE_URL` default: `sqlite:///./campuscloud.db`
- `METRICS_POLL_INTERVAL_SECONDS` default: `15`
- `STOP_TIMEOUT_SECONDS` default: `10`
- `PROJECT_NETWORK_PREFIX` default: `campuscloud-project`

## Test

```bash
uv run python -m unittest discover -s tests -v
```

Or just run:

```bash
./run_tests.sh
```

The test suite now covers both the API and the frontend support routes.
