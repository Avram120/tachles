"""Shared helpers for Tachles tools: secrets from Windows Credential Manager, DB and REST clients.
Usage: python tools/tk.py check"""
import sys
import keyring
import requests

USER = "tachles"
_PREFIX = {"prod": "tachles", "dev": "tachles-dev"}


def secret(name: str) -> str:
    v = keyring.get_password(name, USER)
    if not v:
        raise RuntimeError(f"missing secret: {name}")
    return v


def db(env: str):
    import psycopg
    return psycopg.connect(secret(f"{_PREFIX[env]}-db-url"), connect_timeout=20)


def db_dev():
    return db("dev")


def rest(env: str) -> requests.Session:
    p = _PREFIX[env]
    key = secret(f"{p}-supabase-service-key")
    s = requests.Session()
    s.base = secret(f"{p}-supabase-url").rstrip("/") + "/rest/v1"
    s.headers.update({"apikey": key, "Authorization": f"Bearer {key}",
                      "Content-Type": "application/json; charset=utf-8"})
    return s


def check() -> None:
    for env in ("prod", "dev"):
        with db(env) as c:
            c.execute("select 1")
        r = rest(env).get(rest(env).base + "/", timeout=20)
        print(f"{env} ok" if r.status_code < 500 else f"{env} rest {r.status_code}")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    if sys.argv[1:] == ["check"]:
        check()
    else:
        print(__doc__)
