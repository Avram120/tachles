import sys, pathlib, json, pytest
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[2] / "tools"))
import tk

ADMIN = "g0548412271@gmail.com"


@pytest.fixture
def conn():
    c = tk.db_dev()
    c.autocommit = False
    try:
        yield c
    finally:
        c.rollback()
        c.close()


@pytest.fixture
def seeded(conn):
    cur = conn.cursor()
    cur.execute("insert into admins(email) values (%s) on conflict do nothing", (ADMIN,))
    a = cur.execute("insert into businesses(name) values ('A') returning id").fetchone()[0]
    b = cur.execute("insert into businesses(name) values ('B') returning id").fetchone()[0]
    for x in (a, b):
        cur.execute("insert into diagnoses(business_id, prefill) values (%s, '{}')", (x,))
    cur.execute("insert into members(business_id, email, is_primary) values (%s, 'a@x.com', true)", (a,))
    cur.execute("savepoint seeded")
    return {"a": a, "b": b}


@pytest.fixture
def as_user(conn):
    def _as(email):
        cur = conn.cursor()
        cur.execute("rollback to savepoint seeded")
        cur.execute("set local role authenticated")
        cur.execute("select set_config('request.jwt.claims', %s, true)",
                    (json.dumps({"email": email, "role": "authenticated"}),))
        return cur
    return _as
