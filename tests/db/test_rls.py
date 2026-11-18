import psycopg, pytest
from conftest import ADMIN


def counts(cur):
    b = cur.execute("select count(*) from businesses").fetchone()[0]
    d = cur.execute("select count(*) from diagnoses").fetchone()[0]
    return b, d


def test_admin_sees_all(seeded, as_user):
    b, d = counts(as_user(ADMIN))
    assert b >= 2 and d >= 2


def test_stranger_sees_nothing(seeded, as_user):
    assert counts(as_user("s@x.com")) == (0, 0)


def test_member_sees_own_business_only(seeded, as_user):
    cur = as_user("a@x.com")
    rows = cur.execute("select id from businesses").fetchall()
    assert [r[0] for r in rows] == [seeded["a"]]
    assert cur.execute("select count(*) from diagnoses").fetchone()[0] == 0


def test_member_email_case_insensitive(seeded, as_user):
    cur = as_user("A@X.com")
    assert cur.execute("select count(*) from businesses").fetchone()[0] == 1


def test_save_increments_version(seeded, as_user):
    cur = as_user(ADMIN)
    v = cur.execute("select save_diagnosis(%s, '{\"x\":1}'::jsonb, 0)", (seeded["a"],)).fetchone()[0]
    assert v == 1
    assert cur.execute("select state->>'x' from diagnoses where business_id=%s", (seeded["a"],)).fetchone()[0] == "1"


def test_save_conflict(seeded, as_user):
    cur = as_user(ADMIN)
    cur.execute("select save_diagnosis(%s, '{}'::jsonb, 0)", (seeded["a"],))
    with pytest.raises(psycopg.errors.RaiseException, match="conflict"):
        cur.execute("select save_diagnosis(%s, '{}'::jsonb, 0)", (seeded["a"],))


def test_save_forbidden_for_member(seeded, as_user):
    cur = as_user("a@x.com")
    with pytest.raises(psycopg.errors.RaiseException, match="forbidden"):
        cur.execute("select save_diagnosis(%s, '{}'::jsonb, 0)", (seeded["a"],))


def test_admins_table_hidden(seeded, as_user):
    cur = as_user(ADMIN)
    try:
        n = cur.execute("select count(*) from admins").fetchone()[0]
    except psycopg.errors.InsufficientPrivilege:
        return
    assert n == 0


def test_is_admin(seeded, as_user):
    assert as_user(ADMIN).execute("select is_admin()").fetchone()[0] is True
    assert as_user("a@x.com").execute("select is_admin()").fetchone()[0] is False


def test_anon_sees_nothing(seeded, conn):
    cur = conn.cursor()
    cur.execute("rollback to savepoint seeded")
    cur.execute("set local role anon")
    assert cur.execute("select count(*) from businesses").fetchone()[0] == 0


def test_admin_creates_client(seeded, as_user):
    cur = as_user(ADMIN)
    bid = cur.execute("select create_client('לקוח \"חדש\"', 'עסק')").fetchone()[0]
    assert cur.execute("select name, stage from businesses where id=%s", (bid,)).fetchone() == ('לקוח "חדש"', "m1")
    pre = cur.execute("select prefill->'client'->>'name', version from diagnoses where business_id=%s", (bid,)).fetchone()
    assert pre == ('לקוח "חדש"', 0)


def test_member_cannot_create_client(seeded, as_user):
    cur = as_user("a@x.com")
    with pytest.raises(psycopg.errors.RaiseException, match="forbidden"):
        cur.execute("select create_client('x', '')")


def test_create_client_needs_name(seeded, as_user):
    with pytest.raises(psycopg.errors.RaiseException, match="name required"):
        as_user(ADMIN).execute("select create_client('  ', '')")


def test_create_client_with_contact(seeded, as_user):
    cur = as_user(ADMIN)
    bid = cur.execute("select create_client('דנה', 'סטודיו', ' Dana@X.com ', '054-1234567')").fetchone()[0]
    assert cur.execute("select email, phone from businesses where id=%s", (bid,)).fetchone() == ("dana@x.com", "054-1234567")
    assert cur.execute("select prefill->'client'->>'email' from diagnoses where business_id=%s", (bid,)).fetchone()[0] == "dana@x.com"


def check_admin_only(seeded, as_user, table, cols, vals):
    cur = as_user(ADMIN)
    cur.execute(f"insert into {table}({cols}) values ({vals})")
    assert cur.execute(f"select count(*) from {table}").fetchone()[0] >= 1
    for who in ("a@x.com", "s@x.com"):
        cur = as_user(who)
        assert cur.execute(f"select count(*) from {table}").fetchone()[0] == 0
        with pytest.raises(psycopg.errors.Error):
            cur.execute(f"insert into {table}({cols}) values ({vals})")


def test_pros_admin_only(seeded, as_user):
    check_admin_only(seeded, as_user, "professionals", "name", "'p'")


def test_rules_admin_only(seeded, as_user):
    check_admin_only(seeded, as_user, "rules", "id, grp, title", "9999, 'g', 't'")
