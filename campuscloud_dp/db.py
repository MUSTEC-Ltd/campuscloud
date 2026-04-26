from contextlib import closing
import sqlite3
from datetime import datetime, timezone


def now_text():
    return datetime.now(timezone.utc).isoformat()


def open_db(db_path):
    conn = sqlite3.connect(db_path, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def setup_db(db_path):
    with closing(open_db(db_path)) as conn:
        conn.execute(
            """
            create table if not exists instances (
                id text primary key,
                project_id text not null,
                docker_container_id text unique,
                name text not null,
                image text not null,
                status text not null,
                cpu_millicores integer not null,
                memory_mb integer not null,
                network_name text not null,
                last_error text,
                created_at text not null,
                updated_at text not null
            )
            """
        )
        conn.execute(
            """
            create table if not exists usage_samples (
                id integer primary key autoincrement,
                instance_id text not null,
                project_id text not null,
                cpu_percent real not null,
                memory_mb real not null,
                runtime_seconds real not null default 0,
                collected_at text not null
            )
            """
        )
        ensure_usage_samples_runtime_column(conn)
        conn.commit()


def ensure_usage_samples_runtime_column(conn):
    columns = conn.execute("pragma table_info(usage_samples)").fetchall()
    names = {row["name"] for row in columns}
    if "runtime_seconds" not in names:
        conn.execute(
            "alter table usage_samples add column runtime_seconds real not null default 0"
        )


def make_instance_row(instance_id, project_id, name, image, cpu_millicores, memory_mb, network_name):
    timestamp = now_text()
    return {
        "id": instance_id,
        "project_id": project_id,
        "docker_container_id": None,
        "name": name,
        "image": image,
        "status": "creating",
        "cpu_millicores": cpu_millicores,
        "memory_mb": memory_mb,
        "network_name": network_name,
        "last_error": None,
        "created_at": timestamp,
        "updated_at": timestamp,
    }


def add_instance(db_path, row):
    with closing(open_db(db_path)) as conn:
        conn.execute(
            """
            insert into instances (
                id, project_id, docker_container_id, name, image, status,
                cpu_millicores, memory_mb, network_name, last_error, created_at, updated_at
            ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                row["id"],
                row["project_id"],
                row["docker_container_id"],
                row["name"],
                row["image"],
                row["status"],
                row["cpu_millicores"],
                row["memory_mb"],
                row["network_name"],
                row["last_error"],
                row["created_at"],
                row["updated_at"],
            ),
        )
        conn.commit()


def get_instance(db_path, instance_id):
    with closing(open_db(db_path)) as conn:
        row = conn.execute(
            "select * from instances where id = ?",
            (instance_id,),
        ).fetchone()
    return row_to_dict(row)


def update_instance(db_path, instance_id, changes):
    if not changes:
        return get_instance(db_path, instance_id)

    changes = dict(changes)
    changes["updated_at"] = now_text()
    columns = []
    values = []
    for key, value in changes.items():
        columns.append(f"{key} = ?")
        values.append(value)
    values.append(instance_id)

    with closing(open_db(db_path)) as conn:
        conn.execute(
            f"update instances set {', '.join(columns)} where id = ?",
            values,
        )
        conn.commit()

    return get_instance(db_path, instance_id)


def list_instances(db_path, project_id=None, include_deleted=False, newest_first=False):
    sql = "select * from instances"
    values = []
    where = []

    if project_id:
        where.append("project_id = ?")
        values.append(project_id)
    if not include_deleted:
        where.append("status != ?")
        values.append("deleted")

    if where:
        sql += " where " + " and ".join(where)
    if newest_first:
        sql += " order by updated_at desc"
    else:
        sql += " order by created_at asc"

    with closing(open_db(db_path)) as conn:
        rows = conn.execute(sql, values).fetchall()
    return [row_to_dict(row) for row in rows]


def list_running_instances(db_path):
    with closing(open_db(db_path)) as conn:
        rows = conn.execute(
            """
            select * from instances
            where status = ? and docker_container_id is not null
            order by created_at asc
            """,
            ("running",),
        ).fetchall()
    return [row_to_dict(row) for row in rows]


def count_active_instances(db_path, project_id):
    with closing(open_db(db_path)) as conn:
        row = conn.execute(
            """
            select count(*) as total from instances
            where project_id = ? and status != ?
            """,
            (project_id, "deleted"),
        ).fetchone()
    return int(row["total"])


def add_sample(db_path, instance_id, project_id, cpu_percent, memory_mb, runtime_seconds):
    with closing(open_db(db_path)) as conn:
        conn.execute(
            """
            insert into usage_samples (
                instance_id, project_id, cpu_percent, memory_mb, runtime_seconds, collected_at
            ) values (?, ?, ?, ?, ?, ?)
            """,
            (
                instance_id,
                project_id,
                cpu_percent,
                memory_mb,
                runtime_seconds,
                now_text(),
            ),
        )
        conn.commit()


def list_samples(db_path, project_id, limit=12):
    with closing(open_db(db_path)) as conn:
        rows = conn.execute(
            """
            select * from usage_samples
            where project_id = ?
            order by collected_at desc
            limit ?
            """,
            (project_id, limit),
        ).fetchall()
    return [row_to_dict(row) for row in rows]


def list_latest_samples(db_path, project_id):
    with closing(open_db(db_path)) as conn:
        rows = conn.execute(
            """
            select s.*
            from usage_samples s
            join (
                select instance_id, max(collected_at) as latest_collected_at
                from usage_samples
                where project_id = ?
                group by instance_id
            ) latest
                on latest.instance_id = s.instance_id
               and latest.latest_collected_at = s.collected_at
            where s.project_id = ?
            order by s.collected_at desc
            """,
            (project_id, project_id),
        ).fetchall()
    return [row_to_dict(row) for row in rows]


def row_to_dict(row):
    if row is None:
        return None
    return {key: row[key] for key in row.keys()}
