"""Load a map saved from the local diagnosis page (the 'שמור' JSON) into a client's cloud diagnosis.
Same as the page's 'טען': the 'plan' key is dropped. Sets stage m1/m2 from 'meeting'.
Usage: python tools/import_saved.py <prod|dev> <business id> <json path>"""
import sys, json
from datetime import datetime, timezone
import tk


def import_saved(env: str, business_id: str, saved: dict) -> int:
    s = tk.rest(env)
    state = {k: v for k, v in saved.items() if k != "plan"}
    state["localAt"] = datetime.now(timezone.utc).isoformat()
    r = s.get(s.base + f"/diagnoses?business_id=eq.{business_id}&select=version")
    r.raise_for_status()
    if not r.json():
        raise RuntimeError(f"no diagnosis for business {business_id}")
    cur = r.json()[0]["version"]
    r = s.patch(s.base + f"/diagnoses?business_id=eq.{business_id}&version=eq.{cur}",
                headers={"Prefer": "return=representation"},
                data=json.dumps({"state": state, "version": cur + 1, "updated_at": datetime.now(timezone.utc).isoformat()}, ensure_ascii=False).encode("utf-8"))
    r.raise_for_status()
    if not r.json():
        raise RuntimeError("conflict: the map changed while importing, try again")
    stage = "m2" if saved.get("meeting") == 2 else "m1"
    s.patch(s.base + f"/businesses?id=eq.{business_id}", data=json.dumps({"stage": stage}).encode()).raise_for_status()
    return cur + 1


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    if len(sys.argv) != 4 or sys.argv[1] not in ("dev", "prod"):
        sys.exit(__doc__)
    print("version", import_saved(sys.argv[1], sys.argv[2], json.load(open(sys.argv[3], encoding="utf-8-sig"))))
