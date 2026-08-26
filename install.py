#!/usr/bin/env python3
"""
Calm — Reading Mode for AI Chats
Copyright (c) 2026 Yonatan Volsky. All rights reserved.

Package and install the extension.

    python3 install.py            # validate + build zip + guided install
    python3 install.py --zip      # only build the distributable zip
    python3 install.py --open     # open chrome://extensions in Chrome

HONESTY NOTE: Chrome 137+ removed the --load-extension flag, so NO script can
load an unpacked extension into Chrome for you anymore — the "Load unpacked"
button in chrome://extensions (Developer mode) is the only path. This tool
does everything up to that click: validates the extension, builds the
Web-Store zip, copies the folder path to your clipboard (macOS), reveals the
folder in Finder, and opens chrome://extensions.
"""

import argparse
import json
import os
import platform
import shutil
import subprocess
import sys
import zipfile

sys.dont_write_bytecode = True  # never drop __pycache__ into the extension folder

ROOT = os.path.dirname(os.path.abspath(__file__))
EXTENSION_FILES = ["manifest.json", "src", "content.css", "icons"]


def c(code, text):
    return f"\033[{code}m{text}\033[0m" if sys.stdout.isatty() else text


def sweep():
    """Delete regenerable build byproducts Chrome refuses to load.

    Chrome rejects any folder containing a name starting with "_", and Python
    drops __pycache__/ next to any script it byte-compiles here. Both that and
    .DS_Store are caches, so removing them is safe and self-healing — but only
    after confirming the directory holds nothing but .pyc files. Anything else
    (a stray .pem, a real _-prefixed file) is reported, never auto-deleted.
    """
    removed = []
    for base, dirs, files in os.walk(ROOT, topdown=True):
        if ".git" in base:
            dirs[:] = []
            continue
        for d in list(dirs):
            if d != "__pycache__":
                continue
            full = os.path.join(base, d)
            contents = os.listdir(full)
            if all(n.endswith(".pyc") for n in contents):  # cache only — safe
                shutil.rmtree(full)
                dirs.remove(d)
                removed.append(os.path.relpath(full, ROOT))
        for name in list(files):
            if name == ".DS_Store":
                os.remove(os.path.join(base, name))
                removed.append(os.path.relpath(os.path.join(base, name), ROOT))
    for r in removed:
        print(c("33", f"  swept {r}"))
    return removed


def validate():
    missing = [p for p in EXTENSION_FILES if not os.path.exists(os.path.join(ROOT, p))]
    if missing:
        print(c("31", f"✗ Missing required files: {', '.join(missing)}"))
        sys.exit(1)
    sweep()
    bad = []
    for base, dirs, files in os.walk(ROOT):
        if ".git" in base:
            continue
        for name in dirs + files:
            if name.startswith("_") or name.endswith(".pem"):
                bad.append(os.path.join(base, name))
    if bad:
        print(c("31", "✗ Chrome will refuse this folder — remove these first:"))
        for b in bad:
            print("   " + b)
        print(c("33", "  (.pem is your private signing key — move it out, don't delete it.)"))
        sys.exit(1)
    with open(os.path.join(ROOT, "manifest.json"), encoding="utf-8") as f:
        m = json.load(f)
    if m.get("manifest_version") != 3:
        print(c("31", "✗ manifest_version must be 3"))
        sys.exit(1)
    print(c("32", f"✓ Valid extension: {m['name']} v{m['version']}"))
    return m


def build_zip(manifest):
    dist = os.path.join(ROOT, "dist")
    os.makedirs(dist, exist_ok=True)
    out = os.path.join(dist, f"calm-for-ai-chats-v{manifest['version']}.zip")
    if os.path.exists(out):
        os.remove(out)
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
        for item in EXTENSION_FILES:
            path = os.path.join(ROOT, item)
            if os.path.isdir(path):
                for base, _, files in os.walk(path):
                    for name in files:
                        if name == ".DS_Store":
                            continue
                        full = os.path.join(base, name)
                        z.write(full, os.path.relpath(full, ROOT))
            else:
                z.write(path, item)
    print(c("32", f"✓ Packaged: {os.path.relpath(out, ROOT)} "
                  f"({os.path.getsize(out)/1024:.1f} KB) — Web Store upload file"))
    return out


def open_extensions_page():
    system = platform.system()
    try:
        if system == "Darwin":
            subprocess.run(["open", "-a", "Google Chrome", "chrome://extensions"], check=False)
        elif system == "Windows":
            subprocess.run(["cmd", "/c", "start", "chrome", "chrome://extensions"], check=False)
        else:
            subprocess.run(["google-chrome", "chrome://extensions"], check=False)
        print(c("32", "✓ Opened chrome://extensions"))
    except Exception as e:
        print(c("33", f"! Open chrome://extensions yourself ({e})."))


def guided():
    if platform.system() == "Darwin":
        try:
            subprocess.run(["pbcopy"], input=ROOT.encode(), check=False)
            print(c("32", "✓ Folder path copied to your clipboard"))
            subprocess.run(["open", "-R", ROOT], check=False)
            print(c("32", "✓ Folder revealed in Finder"))
        except Exception:
            pass
    open_extensions_page()
    print()
    print(c("1", "Finish in Chrome (the only part a script cannot do):"))
    print("  1. Enable  Developer mode  (top-right toggle)")
    print("  2. Click  Load unpacked")
    if platform.system() == "Darwin":
        print("  3. Press  ⌘⇧G , then ⌘V (path is on your clipboard), Enter → Select")
    else:
        print(f"  3. Select this folder:\n       {ROOT}")
    print("  4. Open ChatGPT / Gemini / Claude — the Calm pill appears bottom-right.")
    print()


def main():
    ap = argparse.ArgumentParser(description="Package/install the Calm extension.")
    ap.add_argument("--zip", action="store_true", help="only build the distributable zip")
    ap.add_argument("--open", action="store_true", help="open chrome://extensions")
    args = ap.parse_args()

    if args.open:
        open_extensions_page()
        return
    manifest = validate()
    build_zip(manifest)
    if args.zip:
        return
    guided()


if __name__ == "__main__":
    main()
