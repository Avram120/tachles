"""Apply supabase/migrations/*.sql not yet applied. Usage: python tools/migrate.py <dev|prod>"""
import sys, pathlib
import tk

MIG = pathlib.Path(__file__).resolve().parents[1] / "supabase" / "migrations"


def migrate(env: str) -> list[str]:
    applied = []
    with tk.db(env) as c:
        c.execute("create table if not exists public._migrations (name text primary key, applied_at timestamptz not null default now())")
        c.execute("alter table public._migrations enable row level security")
        c.execute("revoke all on public._migrations from anon, authenticated")
        done = {r[0] for r in c.execute("select name from public._migrations")}
        for f in sorted(MIG.glob("*.sql")):
            if f.name in done:
                continue
            with c.transaction():
                c.execute(f.read_text(encoding="utf-8"))
                c.execute("insert into public._migrations(name) values (%s)", (f.name,))
            applied.append(f.name)
    return applied


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    if len(sys.argv) != 2 or sys.argv[1] not in ("dev", "prod"):
        sys.exit(__doc__)
    print("applied:", migrate(sys.argv[1]) or "nothing new")
