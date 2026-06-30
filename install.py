#!/usr/bin/env python3
"""
Calm — Reading Mode for AI Chats
Copyright (c) 2026 Yonatan Volsky. All rights reserved.

One-command helper to package and install the extension.

Usage:
    python3 install.py            # validate + build dist zip + show install steps
    python3 install.py --zip      # only build the Web-Store / sharing zip
    python3 install.py --launch   # load the extension into a fresh Chrome window
    python3 install.py --open     # open chrome://extensions in your Chrome

The most common path: run `python3 install.py`, then in Chrome go to
chrome://extensions, enable Developer mode, and click "Load unpacked"
(or drag the generated .zip onto the page).
"""

import argparse
import json
import os
import platform
import shutil
import subprocess
import sys
import tempfile
import zipfile

ROOT = os.path.dirname(os.path.abspath(__file__))
# Files that make up the actual extension (everything else is repo scaffolding).
EXTENSION_FILES = ["manifest.json", "content.js", "content.css", "icons"]


def c(code, text):
    return f"\033[{code}m{text}\033[0m" if sys.stdout.isatty() else text


def read_manifest():
    with open(os.path.join(ROOT, "manifest.json"), encoding="utf-8") as f:
        return json.load(f)


def validate():
    missing = [p for p in EXTENSION_FILES if not os.path.exists(os.path.join(ROOT, p))]
    if missing:
        print(c("31", f"✗ Missing required files: {', '.join(missing)}"))
        sys.exit(1)
    m = read_manifest()
    if m.get("manifest_version") != 3:
        print(c("31", "✗ manifest_version must be 3"))
        sys.exit(1)
    print(c("32", f"✓ Valid extension: {m['name']} v{m['version']}"))
    return m


def build_zip(manifest):
    dist = os.path.join(ROOT, "dist")
    os.makedirs(dist, exist_ok=True)
    slug = "calm-for-ai-chats"
    out = os.path.join(dist, f"{slug}-v{manifest['version']}.zip")
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
    size = os.path.getsize(out) / 1024
    print(c("32", f"✓ Packaged: {os.path.relpath(out, ROOT)} ({size:.1f} KB)"))
    print("  → This is the file you upload to the Chrome Web Store.")
    return out


def chrome_binary():
    system = platform.system()
    candidates = {
        "Darwin": ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"],
        "Windows": [
            r"C:\Program Files\Google\Chrome\Application\chrome.exe",
            r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
        ],
        "Linux": ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser"],
    }.get(system, [])
    for cand in candidates:
        if os.path.exists(cand) or shutil.which(cand):
            return cand
    return None


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
        print(c("33", f"! Could not open Chrome automatically ({e}). Open chrome://extensions yourself."))


def launch_demo():
    """Load the unpacked extension into a throwaway Chrome profile for a quick demo."""
    binary = chrome_binary()
    if not binary:
        print(c("31", "✗ Could not find Google Chrome. Install it or use Load unpacked manually."))
        sys.exit(1)
    profile = tempfile.mkdtemp(prefix="calm-demo-profile-")
    print(c("36", "Launching Chrome with Calm loaded (separate demo profile)…"))
    print("  Note: this is a clean profile — sign in to ChatGPT/Gemini to try it,")
    print("  or use Load unpacked in your normal profile to keep your sessions.")
    subprocess.Popen(
        [binary, f"--load-extension={ROOT}", f"--user-data-dir={profile}",
         "https://chatgpt.com"],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )


def print_manual_steps():
    print()
    print(c("1", "Install in your normal Chrome (keeps your logins):"))
    print("  1. Open  chrome://extensions")
    print("  2. Turn on  Developer mode  (top-right)")
    print(f"  3. Click  Load unpacked  and choose:\n       {ROOT}")
    print("  4. Open ChatGPT or Gemini — the controls appear bottom-right.")
    print()


def main():
    ap = argparse.ArgumentParser(description="Install/package the Calm extension.")
    ap.add_argument("--zip", action="store_true", help="only build the distributable zip")
    ap.add_argument("--launch", action="store_true", help="load into a fresh Chrome window")
    ap.add_argument("--open", action="store_true", help="open chrome://extensions")
    args = ap.parse_args()

    manifest = validate()

    if args.launch:
        launch_demo()
        return
    if args.open:
        open_extensions_page()
        return

    out = build_zip(manifest)
    if args.zip:
        return

    print_manual_steps()
    print(c("2", f"Tip: `python3 install.py --launch` to try it instantly in a demo profile."))
    print(c("2", f"     `python3 install.py --zip`    to rebuild {os.path.basename(out)} for the Web Store."))


if __name__ == "__main__":
    main()
