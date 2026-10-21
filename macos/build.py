"""Build a self-contained app with a native Swift shell and Python HID service."""
import os
from pathlib import Path
import platform
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parent.parent
os.chdir(ROOT)
os.environ["PYINSTALLER_CONFIG_DIR"] = str(ROOT / "build/pyinstaller-cache")
DIST = ROOT / "dist"
APP = DIST / "YogoDot.app"

def run(*args):
    subprocess.run(args, check=True)

if sys.platform != "darwin":
    raise SystemExit("A Mac is required to build YogoDot.app")
arch = platform.machine()
run(sys.executable, "-m", "PyInstaller", "--noconfirm", "--clean", "--onedir",
    "--name", "yogodot-backend", "--paths", str(ROOT),
    "--specpath", "build", "--hidden-import", "kbd", "--hidden-import", "hid_macos",
    "--hidden-import", "hid", "--hidden-import", "quota",
    "--add-data", f"{ROOT}/yogo.html:.", "--add-data", f"{ROOT}/patterns.js:.",
    "--add-data", f"{ROOT}/designs.js:.", "--add-data", f"{ROOT}/fonts:fonts",
    "--add-data", f"{ROOT}/LICENSE:.", "--add-data", f"{ROOT}/README.md:.", "macos/backend.py")
if APP.exists():
    shutil.rmtree(APP)
contents = APP / "Contents"
resources = contents / "Resources"
(contents / "MacOS").mkdir(parents=True)
resources.mkdir()
shutil.copytree(DIST / "yogodot-backend", resources / "backend", symlinks=True)
shutil.copy("macos/Info.plist", contents / "Info.plist")
shutil.copy("LICENSE", resources / "LICENSE")
shutil.copy("macos/README.md", resources / "README.md")
# The existing icon is retained, converted into the macOS bundle format.
from PIL import Image
with Image.open("yogo.ico") as image:
    image.convert("RGBA").resize((1024, 1024), Image.Resampling.NEAREST).save(resources / "YogoDot.icns")
env = dict(os.environ, CLANG_MODULE_CACHE_PATH=str(ROOT / "build/swift-module-cache"))
subprocess.run(["xcrun", "swiftc", "macos/App.swift", "-swift-version", "5", "-parse-as-library", "-O",
                "-target", f"{arch}-apple-macosx13.0", "-framework", "AppKit", "-framework", "WebKit",
                "-o", str(contents / "MacOS/YogoDot")], check=True, env=env)
# Ad-hoc signing is for bundle integrity, not Developer ID notarization.
run("xattr", "-cr", str(APP))
run("codesign", "--force", "--deep", "--sign", "-", str(APP))
run("codesign", "--verify", "--deep", "--strict", str(APP))
archive = DIST / f"YogoDot-macos-{arch}.zip"
archive.unlink(missing_ok=True)
run("ditto", "-c", "-k", "--sequesterRsrc", "--keepParent", str(APP), str(archive))
print(archive)
