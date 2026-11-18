"""Seed the master rules table from the tracker file. Usage: python tools/seed_rules.py <dev|prod>"""
import re, sys
import tk

SRC = r"J:\האחסון שלי\ייעוץ עסקי\תכל'ס - מעקב העסק.md"
EXTRA_GRP = "מתוך העבודה של אברהם"


def parse_rules(path=SRC) -> list[dict]:
    lines = open(path, encoding="utf-8").read().splitlines()
    start = next(i for i, l in enumerate(lines) if l.startswith("## כללי החשיבה העסקית של תכל'ס"))
    out, grp = [], ""
    for l in lines[start + 1:]:
        l = l.strip()
        if l.startswith("## "):
            break
        m = re.fullmatch(r"\*\*([^*]+)\*\*", l)
        if m:
            grp = m.group(1).strip()
            continue
        m = re.match(r"(\d+)\.\s+\*\*(.+?)\*\*\s+[–-]\s+(.*)", l)
        if m:
            out.append({"id": int(m.group(1)), "grp": grp, "title": m.group(2).strip(), "body": m.group(3).strip()})
            continue
        m = re.match(r"\*\*עוד 8 כללים מתוך העבודה של אברהם:\*\*\s*(.*)", l)
        if m:
            for k, t in enumerate(m.group(1).strip().rstrip(".").split(" · ")):
                out.append({"id": 19 + k, "grp": EXTRA_GRP, "title": t.strip(), "body": ""})
    return out


def seed(env: str) -> int:
    rules = parse_rules()
    with tk.db(env) as c:
        for r in rules:
            c.execute("insert into public.rules(id, grp, title, body) values (%(id)s, %(grp)s, %(title)s, %(body)s) "
                      "on conflict (id) do update set grp=excluded.grp, title=excluded.title, body=excluded.body", r)
    return len(rules)


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    if len(sys.argv) != 2 or sys.argv[1] not in ("dev", "prod"):
        sys.exit(__doc__)
    print(seed(sys.argv[1]))
