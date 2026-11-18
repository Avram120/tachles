"""Create a client (business + diagnosis prefill) from a 'נתוני מפה - <name>.json' file.
Usage: python tools/new_client.py <prod|dev> <json path>"""
import sys, json
import tk

APP = "https://gutfarb.co.il/app/map.html?b="


def new_client(env: str, prefill: dict) -> str:
    s = tk.rest(env)
    c = prefill.get("client", {})
    r = s.post(s.base + "/businesses", headers={"Prefer": "return=representation"},
               data=json.dumps({"name": c.get("name") or "ללא שם", "business": c.get("business") or "",
                                "folder": c.get("folder") or "",
                                "email": (c.get("email") or "").strip().lower(), "phone": (c.get("phone") or "").strip()}, ensure_ascii=False).encode("utf-8"))
    r.raise_for_status()
    bid = r.json()[0]["id"]
    r = s.post(s.base + "/diagnoses", data=json.dumps({"business_id": bid, "prefill": prefill}, ensure_ascii=False).encode("utf-8"))
    if not r.ok:
        s.delete(s.base + f"/businesses?id=eq.{bid}")
        r.raise_for_status()
    return bid


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    if len(sys.argv) != 3 or sys.argv[1] not in ("dev", "prod"):
        sys.exit(__doc__)
    bid = new_client(sys.argv[1], json.load(open(sys.argv[2], encoding="utf-8-sig")))
    print(bid)
    print(APP + bid)
