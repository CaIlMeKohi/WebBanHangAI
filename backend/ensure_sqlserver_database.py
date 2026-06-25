import os
from pathlib import Path

import pyodbc


ROOT_DIR = Path(__file__).resolve().parent.parent


def load_env(path: Path) -> None:
    if not path.exists():
        return
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip())


def env(name: str, default: str = "") -> str:
    return os.getenv(name, default).strip()


def main() -> None:
    load_env(ROOT_DIR / ".env")
    if env("DATABASE_ENGINE", "sqlite").lower() not in {"mssql", "sqlserver"}:
        return

    database = env("SQLSERVER_DATABASE", "FashionShopDB")
    driver = env("SQLSERVER_DRIVER", "ODBC Driver 17 for SQL Server")
    host = env("SQLSERVER_HOST", "127.0.0.1")
    port = env("SQLSERVER_PORT", "1433")
    user = env("SQLSERVER_USER", "sa")
    password = env("SQLSERVER_PASSWORD")
    extra_params = env("SQLSERVER_EXTRA_PARAMS", "TrustServerCertificate=yes;Encrypt=no;")

    server = host if "\\" in host else f"{host},{port}"
    conn_str = (
        f"DRIVER={{{driver}}};"
        f"SERVER={server};"
        "DATABASE=master;"
        f"UID={user};"
        f"PWD={password};"
        f"{extra_params}"
    )

    try:
        with pyodbc.connect(conn_str, autocommit=True) as connection:
            cursor = connection.cursor()
            exists = cursor.execute(
                "SELECT 1 FROM sys.databases WHERE name = ?",
                database,
            ).fetchone()
            if not exists:
                cursor.execute(f"CREATE DATABASE [{database}]")
                print(f"[INFO] Created SQL Server database: {database}")
            else:
                print(f"[INFO] SQL Server database already exists: {database}")
    except pyodbc.Error as exc:
        print(f"[ERROR] Khong the ket noi SQL Server {server}: {exc}")
        print("[HINT] Kiem tra SQL Server dang chay va credential trong file .env.")
        raise SystemExit(1) from exc


if __name__ == "__main__":
    main()
