import sys, pathlib, json
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / "tools"))
import backup


def test_encrypt_roundtrip_hebrew():
    key = backup.new_key()
    data = {"businesses": [{"name": 'דני "כהן"\nשורה'}]}
    blob = backup.encrypt(data, key)
    assert "כהן".encode() not in blob and b"businesses" not in blob
    assert backup.decrypt(blob, key) == data


def test_dump_reads_all_tables():
    d = backup.dump("dev")
    assert set(d["tables"]) == set(backup.TABLES)
    assert d["env"] == "dev" and d["at"]


def test_keeps_last_n(tmp_path):
    for i in range(5):
        (tmp_path / f"tachles-2026-11-0{i+1}.bin").write_bytes(b"x")
    backup.prune(tmp_path, keep=3)
    assert sorted(p.name for p in tmp_path.iterdir()) == ["tachles-2026-11-03.bin", "tachles-2026-11-04.bin", "tachles-2026-11-05.bin"]
