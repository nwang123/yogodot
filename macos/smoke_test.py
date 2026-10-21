"""Exercise the packaged service and optionally the native WKWebView.

Always isolates data and disables hardware enumeration. No login item is changed.
"""
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parent.parent
APP = ROOT / "dist/YogoDot.app"


def free_port():
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


def wait_for(path, process, timeout=25):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if path.exists():
            return json.loads(path.read_text())
        if process.poll() is not None:
            raise RuntimeError("Application exited before producing %s" % path.name)
        time.sleep(.1)
    raise TimeoutError(path.name)


def main():
    with tempfile.TemporaryDirectory(prefix="yogodot-smoke-") as tmp:
        env = dict(os.environ, YOGO_DATA_DIR=tmp,
                   YOGO_PORT=str(free_port()), YOGO_HOOK_PORT=str(free_port()))
        ready = Path(tmp) / "service-ready.json"
        executable = APP / "Contents/Resources/backend/yogodot-backend"
        with (Path(tmp) / "backend.log").open("w") as log:
            process = subprocess.Popen([str(executable), "--no-hardware", "--ready-file",
                str(ready), "--parent-pid", str(os.getpid())], env=env, stdout=log, stderr=log)
            try:
                wait_for(ready, process)
                base = "http://127.0.0.1:" + env["YOGO_PORT"]
                def get(path):
                    with urllib.request.urlopen(base + path, timeout=4) as response:
                        return response.read()
                assert b"YOGO_PATTERNS" in get("/patterns.js")
                assert b"patterns.js" in get("/yogo.html")
                status = json.loads(get("/kb/status"))
                assert status["ok"] and not status["connected"], status
                request = urllib.request.Request(base + "/mac/session", data=b'{"locked":true}',
                    headers={"Content-Type": "application/json"})
                assert json.load(urllib.request.urlopen(request))["ok"]
                for path in ("/.token", "/.git/config", "/fonts/../README.md"):
                    try:
                        get(path)
                        raise AssertionError("Unexpected exposed resource: " + path)
                    except urllib.error.HTTPError as error:
                        assert error.code == 404
                request.add_header("Origin", "https://example.invalid")
                try:
                    urllib.request.urlopen(request)
                    raise AssertionError("Cross-origin command was accepted")
                except urllib.error.HTTPError as error:
                    assert error.code == 403
                print("Packaged backend: resources, disconnected status, session relay, access checks passed")
            finally:
                process.terminate()
                process.wait(timeout=10)
        assert not ready.exists(), "Service failed to clean up its readiness file"
        if "--gui" in sys.argv:
            process = subprocess.Popen([str(APP / "Contents/MacOS/YogoDot"), "--smoke-test"], env=env)
            try:
                result = wait_for(Path(tmp) / "smoke-result.json", process, timeout=35)
                process.wait(timeout=10)
                assert result.get("designs") == 80, result
                assert result.get("cards") == 80, result
                assert result.get("newDesigns") == 32, result
                assert result.get("mac") is True and result.get("ticks", 0) >= 30, result
                print("Native app / hidden WKWebView:", json.dumps(result, ensure_ascii=False))
            finally:
                if process.poll() is None:
                    process.terminate()
                    process.wait(timeout=10)


if __name__ == "__main__":
    main()
