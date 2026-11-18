"""Nightly encrypted backup of the Tachles database to Drive.
Usage:
  python tools/backup.py run              # dump prod, encrypt, save to the backup folder, keep last 30
  python tools/backup.py show <file.bin>  # decrypt a backup and print it (JSON)
The encryption key lives in Credential Manager as 'tachles-backup-key' (created on first run)."""
import sys, json, pathlib
from datetime import datetime, timezone
import keyring
from cryptography.fernet import Fernet
import tk

TABLES = ["businesses", "members", "diagnoses", "admins"]
FOLDER = pathlib.Path(r"J:\האחסון שלי\ייעוץ עסקי\מערכת תכל'ס\גיבויים")
KEY_NAME = "tachles-backup-key"


def new_key() -> bytes:
    return Fernet.generate_key()


def get_key() -> bytes:
    k = keyring.get_password(KEY_NAME, tk.USER)
    if not k:
        k = new_key().decode()
        keyring.set_password(KEY_NAME, tk.USER, k)
    return k.encode()


def encrypt(data: dict, key: bytes) -> bytes:
    return Fernet(key).encrypt(json.dumps(data, ensure_ascii=False).encode("utf-8"))


def decrypt(blob: bytes, key: bytes) -> dict:
    return json.loads(Fernet(key).decrypt(blob).decode("utf-8"))


def dump(env: str) -> dict:
    s = tk.rest(env)
    out = {}
    for t in TABLES:
        r = s.get(s.base + f"/{t}?select=*", timeout=60)
        r.raise_for_status()
        out[t] = r.json()
    return {"env": env, "at": datetime.now(timezone.utc).isoformat(), "tables": out}


def prune(folder: pathlib.Path, keep: int = 30) -> None:
    files = sorted(folder.glob("tachles-*.bin"))
    for f in files[:-keep] if len(files) > keep else []:
        f.unlink()


def run() -> pathlib.Path:
    FOLDER.mkdir(parents=True, exist_ok=True)
    data = dump("prod")
    f = FOLDER / f"tachles-{datetime.now().strftime('%Y-%m-%d')}.bin"
    f.write_bytes(encrypt(data, get_key()))
    assert decrypt(f.read_bytes(), get_key())["tables"].keys() == data["tables"].keys()
    prune(FOLDER)
    return f


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    if sys.argv[1:2] == ["run"]:
        f = run()
        print("saved", f.name, sum(1 for _ in FOLDER.glob("tachles-*.bin")), "backups in folder")
    elif sys.argv[1:2] == ["show"] and len(sys.argv) == 3:
        print(json.dumps(decrypt(pathlib.Path(sys.argv[2]).read_bytes(), get_key()), ensure_ascii=False, indent=1))
    else:
        print(__doc__)
