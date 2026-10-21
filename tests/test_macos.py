import json
import os
from pathlib import Path
import queue
import re
import sys
import tempfile
import threading
import time
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
_TEMP = tempfile.TemporaryDirectory()
os.environ["YOGO_DATA_DIR"] = _TEMP.name

if sys.platform == "darwin":
    import hid_macos
    import kbd


@unittest.skipUnless(sys.platform == "darwin", "macOS HID backend")
class MacTransportTests(unittest.TestCase):
    def test_normalize_unnumbered_and_numbered_reports(self):
        packet = bytes([0xAA, 20, 0, 0, 24, 7, 0, 0]) + bytes(range(24))
        self.assertEqual(hid_macos.normalize_report(packet), b"\0" + packet)
        self.assertEqual(hid_macos.normalize_report(b"\0" + packet), b"\0" + packet)
        self.assertEqual(hid_macos.normalize_report(b"\1" + packet), b"")
        self.assertEqual(hid_macos.normalize_report(b"\xaa"), b"")
        self.assertEqual(hid_macos.normalize_report([]), b"")

    def test_only_vendor_control_collection_is_enumerated(self):
        base = dict(path=b"vendor", vendor_id=hid_macos.VID, product_id=1,
                    usage_page=0xFF60, usage=0x61)
        with patch.object(hid_macos.hid, "enumerate", return_value=[base,
                dict(base, path=b"typing", usage_page=1, usage=6),
                dict(base, path=b"other", usage=0x62)]):
            rows = hid_macos.interfaces()
        self.assertEqual([r[0] for r in rows], [b"vendor"])

    def test_write_uses_report_id_and_detects_short_write(self):
        class FakeDevice:
            result = 32
            def open_path(self, path): self.path = path
            def get_product_string(self): return "ATK YOGO Dongle"
            def write(self, data): self.data = data; return self.result
            def close(self): pass
        fake = FakeDevice()
        with patch.object(hid_macos.hid, "device", return_value=fake):
            connection = hid_macos.Connection(b"vendor")
        packet = b"\0\xaa" + bytes(31)
        self.assertTrue(connection.write(packet))
        self.assertEqual(fake.data, packet)
        fake.result = 8
        self.assertFalse(connection.write(packet))
        connection.close()
        self.assertFalse(connection.write(packet))

    def test_shared_protocol_roundtrip_and_config_backup(self):
        class FakeConnection:
            product = "ATK YOGO Dongle"
            def __init__(self, path): self.incoming = queue.Queue(); self.packets = []; self.closed = False
            def write(self, packet):
                packet = bytes(packet); self.packets.append(packet)
                reply = bytearray(packet)
                if packet[2] == kbd.C_READ:
                    off, size = packet[3] + packet[4] * 256, packet[5]
                    reply[9:9+size] = bytes(range(off, off+size))
                elif packet[2] == kbd.C_POWER: reply[9:11] = bytes([75, 0])
                self.incoming.put(bytes(reply))
                return True
            def read(self):
                try: return self.incoming.get(timeout=.02)
                except queue.Empty: return b""
            def close(self): self.closed = True
        kb = kbd.Keyboard()
        kb.BAK = str(Path(_TEMP.name) / "test-config.bak")
        # No system idle watcher is needed for the fake transport.
        kb._idle_loop = lambda: None
        with patch.object(kbd.H, "Connection", FakeConnection), patch.object(kbd.H, "interfaces",
                return_value=[(b"vendor", 0x373B, 1, 0xFF60, 0x61, 33, 33)]):
            try:
                self.assertTrue(kb.open())
                config = kb.read_config()
                self.assertEqual(config, bytes(range(64)))
                self.assertEqual(Path(kb.BAK).read_bytes(), config)
                self.assertEqual(kb.power(force=True)["pct"], 75)
                connection = kb.fh
                pixels = bytes(range(108))
                self.assertTrue(kb.push_matrix(pixels))
                self.assertFalse(kb.push_matrix(pixels))  # deduplicated
                packets = [p for p in connection.packets if p[2] == kbd.C_MATRIX]
                self.assertEqual(len(packets), 5)
                self.assertEqual([p[3] for p in packets], [0,24,48,72,96])
                self.assertEqual(b"".join(p[9:33] for p in packets)[:108], pixels)
                self.assertTrue(all(len(p) == 33 and p[:2] == b"\0\xaa" for p in packets))
                self.assertNotIn(49, [p[2] for p in connection.packets])
            finally:
                kb.close()
                if kb.reader: kb.reader.join(1)
        self.assertFalse(kb.connected())

    def test_lock_idle_and_low_battery_budgets(self):
        kb = kbd.Keyboard()
        kb._pw = {"pct": 15, "charging": False}
        with patch.object(kbd, "idle_secs", return_value=0):
            self.assertEqual(kb._want_off(), (False, True, False))
            kb.locked = True
            self.assertEqual(kb._want_off(), (True, True, True))
            kb.locked = False; kb._pw = {"pct": 5, "charging": True}
            self.assertEqual(kb._want_off(), (False, False, False))
        with patch.object(kbd, "idle_secs", return_value=181):
            self.assertEqual(kb._want_off(), (True, True, True))

    def test_blanked_frames_are_saved_for_resume(self):
        kb = kbd.Keyboard(); kb._mx_off = kb._ky_off = True
        pixels = bytes([1] * 108); keys = bytes([2] * 168)
        self.assertFalse(kb.push_matrix(pixels))
        self.assertFalse(kb.push_keys(keys))
        self.assertEqual(kb._saved_mx, pixels)
        self.assertEqual(kb._saved_ky, keys)
        self.assertFalse(kb.connected())


class PatternTests(unittest.TestCase):
    def test_all_new_patterns_are_valid_unique_six_by_six(self):
        text = (ROOT / "patterns.js").read_text()
        entries = re.findall(r'^      (\w+): (\[[^\n]+\])', text, re.M)
        self.assertEqual(len(entries), 52)
        palette_extension = json.loads(re.search(r'const palette = (\{.*?\});', text, re.S).group(1))
        for rgb in palette_extension.values():
            self.assertEqual(len(rgb), 3)
            self.assertTrue(all(isinstance(v, int) and 0 <= v <= 255 for v in rgb))
        seen = set()
        palette = set(".roygcbpvwdkAaAlsSOnmYGetLB") | set(palette_extension)
        for name, raw in entries:
            rows = json.loads(raw)
            self.assertEqual(len(rows), 6, name)
            self.assertTrue(all(len(row) == 6 for row in rows), name)
            self.assertFalse(set(''.join(rows)) - palette, name)
            signature = ''.join(rows)
            self.assertNotIn(signature, seen, name)
            seen.add(signature)
        page = (ROOT / "yogo.html").read_text()
        self.assertLess(page.index('src="patterns.js"'), page.index('const STATICS='))
        self.assertIn('...YOGO_PATTERNS.designs', page)
        self.assertIn('...YOGO_PATTERNS.palette', page)


if __name__ == "__main__":
    unittest.main()
