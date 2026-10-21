"""macOS HID transport. Only enumerate the ATK vendor control collection.

HIDAPI writes include report ID 0; macOS reads of an unnumbered report omit it.
Normalize reads to the Windows layout used by the shared protocol engine.
No firmware, keyboard input reports, or reset commands are touched.
"""
import ctypes
import threading

import hid

# The wheel embeds HIDAPI. Explicitly use a shared IOHIDDevice connection so
# opening the vendor collection never seizes the keyboard from macOS.
_hidlib = ctypes.CDLL(hid.__file__)
_hidlib.hid_darwin_set_open_exclusive.argtypes = [ctypes.c_int]
_hidlib.hid_darwin_set_open_exclusive.restype = None
_hidlib.hid_darwin_set_open_exclusive(0)

VID = 0x373B
USAGE_PAGE, USAGE = 0xFF60, 0x61


def interfaces():
    return [(d["path"], d["vendor_id"], d["product_id"], d["usage_page"],
             d["usage"], 33, 33)
            for d in hid.enumerate(VID, 0)
            if d.get("usage_page") == USAGE_PAGE and d.get("usage") == USAGE]


def normalize_report(report):
    data = bytes(report)
    if len(data) == 32 and data[0] == 0xAA:
        return b"\x00" + data
    if len(data) == 33 and data[:2] == b"\x00\xaa":
        return data
    return b""


class Connection:
    def __init__(self, path):
        self._lock = threading.Lock()
        self._device = hid.device()
        self._device.open_path(path)
        try:
            self.product = self._device.get_product_string() or "ATK YOGO"
        except Exception:
            self._device.close()
            raise

    def read(self):
        # Bound the read so close cannot race a native hid_read / free its pointer.
        with self._lock:
            if self._device is None:
                return b""
            return normalize_report(self._device.read(33, 100))

    def write(self, packet):
        with self._lock:
            if self._device is None:
                return False
            # HIDAPI on Darwin returns 32 after stripping the unnumbered ID.
            return self._device.write(bytes(packet)) in (32, 33)

    def close(self):
        with self._lock:
            device, self._device = self._device, None
            if device is not None:
                device.close()


_cg = ctypes.CDLL("/System/Library/Frameworks/CoreGraphics.framework/CoreGraphics")
_cg.CGEventSourceSecondsSinceLastEventType.argtypes = [ctypes.c_int, ctypes.c_uint32]
_cg.CGEventSourceSecondsSinceLastEventType.restype = ctypes.c_double


def idle_secs():
    # Combined session state and all event types. Does not install an event tap.
    return max(0.0, _cg.CGEventSourceSecondsSinceLastEventType(0, 0xFFFFFFFF))


def locked():
    # The native shell relays distributed lock and workspace sleep notifications
    # to KB.session_locked. No access to keyboard input or accessibility required.
    return False
