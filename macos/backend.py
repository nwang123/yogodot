"""Backend owned by the native app; exits when its parent exits."""
import argparse
import json
import os
from pathlib import Path
import signal
import sys
import threading
import time
from urllib.parse import urlsplit

if not getattr(sys, "frozen", False):
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import kbd
import server


class MacUI(server.UI):
    def do_GET(self):
        path = urlsplit(self.path).path
        if (not path.startswith("/fonts/") and path not in
                {"/yogo.html", "/patterns.js", "/designs.js", "/kb/status", "/kb/power",
                 "/debug", "/events", "/snapshot", "/jump", "/hud/keep", "/hud/geom",
                 "/capsule", "/settings", "/want", "/ui", "/usage"}):
            return self.send_error(404)
        if path.startswith("/fonts/") and (".." in path or "%" in path):
            return self.send_error(404)
        return super().do_GET()

    def do_POST(self):
        origin = self.headers.get("Origin")
        if origin and origin != "http://127.0.0.1:%d" % server.PORT:
            return self._json({"ok": False, "why": "Invalid origin"}, 403)
        if self.headers.get_content_type() != "application/json":
            return self._json({"ok": False, "why": "Expected JSON"}, 415)
        if self.path == "/mac/session":
            body = self._body()
            kbd.KB.session_locked = bool(body.get("locked"))
            return self._json({"ok": True})
        return super().do_POST()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--ready-file", required=True)
    parser.add_argument("--parent-pid", type=int, default=os.getppid())
    parser.add_argument("--no-hardware", action="store_true", help="Diagnostic mode: do not enumerate or open any keyboard")
    args = parser.parse_args()
    if args.no_hardware:
        kbd.H.interfaces = lambda: []
    servers = []
    serving = []
    try:
        # Bind before announcing success. A port collision must reach the GUI.
        for port, handler in ((server.PORT, MacUI), (server.HOOK_PORT, server.Hook)):
            srv = server.ThreadingHTTPServer(("127.0.0.1", port), handler)
            srv.daemon_threads = True
            servers.append(srv)
        for srv in servers:
            threading.Thread(target=srv.serve_forever, daemon=True).start()
            serving.append(srv)
        if server.claude_on():
            server.start_claude_services()
        ready = Path(args.ready_file)
        temp = ready.with_suffix(".tmp")
        temp.write_text(json.dumps({"port": server.PORT, "pid": os.getpid()}))
        temp.replace(ready)
        stopping = threading.Event()
        signal.signal(signal.SIGTERM, lambda *_: stopping.set())
        signal.signal(signal.SIGINT, lambda *_: stopping.set())
        while not stopping.wait(1):
            if os.getppid() != args.parent_pid:
                break
    finally:
        kbd.KB.close()
        for srv in servers:
            if srv in serving:
                srv.shutdown()
            srv.server_close()
        Path(args.ready_file).unlink(missing_ok=True)


if __name__ == "__main__":
    main()
