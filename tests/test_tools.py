import sys, pathlib, uuid, pytest
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / "tools"))
import tk
from new_client import new_client
from import_saved import import_saved


@pytest.fixture
def made():
    ids = []
    yield ids
    s = tk.rest("dev")
    for i in ids:
        s.delete(s.base + f"/businesses?id=eq.{i}")


def prefill(name):
    return {"client": {"name": name, "business": "עסק \"בדיקה\"", "folder": "f", "date": "17.11"},
            "domains": [{"id": "marketing", "score": 2, "extraQs": ["שאלה?\nשורה"]}],
            "prefill": {"blockers": [], "resources": []}}


def row(table, key, val, sel="*"):
    s = tk.rest("dev")
    r = s.get(s.base + f"/{table}?{key}=eq.{val}&select={sel}")
    r.raise_for_status()
    return r.json()[0]


def test_new_client_creates_rows(made):
    p = prefill("בדיקה " + uuid.uuid4().hex[:6])
    bid = new_client("dev", p); made.append(bid)
    assert row("businesses", "id", bid)["name"] == p["client"]["name"]
    assert row("diagnoses", "business_id", bid)["prefill"] == p


def test_import_roundtrip_hebrew(made):
    bid = new_client("dev", prefill("x")); made.append(bid)
    saved = {"meeting": 1, "client": {"name": 'דני "כהן"\nשורה'}, "domains": {"m": {"answers": {"b:ש?": "תשובה 'עם' גרש"}}},
             "plan": {"drop": True}}
    v = import_saved("dev", bid, saved)
    assert v == 1
    st = row("diagnoses", "business_id", bid)["state"]
    expected = dict(saved); expected.pop("plan")
    assert st.pop("localAt")
    assert st == expected


def test_import_sets_stage(made):
    bid = new_client("dev", prefill("y")); made.append(bid)
    import_saved("dev", bid, {"meeting": 2, "domains": {}, "vision": {}})
    assert row("businesses", "id", bid)["stage"] == "m2"


def test_seed_rules_parses_26():
    import os
    from seed_rules import parse_rules, SRC
    if not os.path.exists(SRC):
        pytest.skip("J: missing")
    r = parse_rules()
    assert [x["id"] for x in r] == list(range(1, 27))
    assert r[12]["title"] == "תמחור לפי ערך"
    assert r[18]["title"] == "בדיקה בשטח" and r[18]["body"] == "" and r[18]["grp"] == "מתוך העבודה של אברהם"
