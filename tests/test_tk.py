import sys, pathlib, pytest
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / "tools"))
import tk

def test_missing_secret_raises(monkeypatch):
    monkeypatch.setattr(tk.keyring, "get_password", lambda s, u: None)
    with pytest.raises(RuntimeError, match="missing secret: x"):
        tk.secret("x")

def test_secret_reads_keyring(monkeypatch):
    monkeypatch.setattr(tk.keyring, "get_password", lambda s, u: f"{s}|{u}")
    assert tk.secret("abc") == "abc|tachles"

def test_rest_session_has_base_and_headers(monkeypatch):
    vals = {"tachles-dev-supabase-url": "https://d.supabase.co", "tachles-dev-supabase-service-key": "k"}
    monkeypatch.setattr(tk.keyring, "get_password", lambda s, u: vals.get(s))
    s = tk.rest("dev")
    assert s.base == "https://d.supabase.co/rest/v1"
    assert s.headers["apikey"] == "k" and s.headers["Authorization"] == "Bearer k"
