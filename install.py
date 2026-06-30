#!/usr/bin/env python3
"""
Calm — Reading Mode for AI Chats
Copyright (c) 2026 Yonatan Volsky. All rights reserved.

Package and install the extension.

ONE-LINER (fetches from GitHub and loads into your Chrome, no "Load unpacked"):

    curl -fsSL https://raw.githubusercontent.com/YonatanVol/calm-for-ai-chats/main/install.py | python3 - --auto

Local usage (run inside a checkout):

    python3 install.py            # validate + build dist zip + show steps
    python3 install.py --auto     # fetch + load into your Chrome (no Load unpacked)
    python3 install.py --zip      # only build the Web-Store / sharing zip
    python3 install.py --launch   # load into a throwaway demo profile
    python3 install.py --open     # open chrome://extensions

NOTE ON CHROME'S LIMITS
  Chrome will not let any script silently, permanently install a non-Web-Store
  extension into your normal profile — that is by design. `--auto` loads the
  extension by relaunching Chrome with the --load-extension flag (so it lands in
  your real profile with your logins) and writes a launcher you can reuse. Chrome
  shows a "developer mode extensions" banner, and the extension is present while
  Chrome is started via that launcher. The only fully silent / permanent path is
  publishing to the Chrome Web Store.
"""

import argparse
import json
import os
import platform
import shutil
import ssl
import subprocess
import sys
import tempfile
import time
import urllib.request
import zipfile

REPO = "YonatanVol/calm-for-ai-chats"
BRANCH = "main"
ZIP_URL = f"https://codeload.github.com/{REPO}/zip/refs/heads/{BRANCH}"
CLONE_URL = f"https://github.com/{REPO}.git"
INSTALL_DIR = os.path.expanduser("~/.calm-for-ai-chats")
EXTENSION_FILES = ["manifest.json", "content.js", "content.css", "icons"]

# Directory of this script if it lives next to the extension files; else None.
try:
    HERE = os.path.dirname(os.path.abspath(__file__))
    if not os.path.exists(os.path.join(HERE, "manifest.json")):
        HERE = None
except NameError:  # piped via stdin: __file__ is undefined
    HERE = None


def c(code, text):
    return f"\033[{code}m{text}\033[0m" if sys.stdout.isatty() else text


def die(msg):
    print(c("31", f"✗ {msg}"))
    sys.exit(1)


# ----------------------------------------------------------------------
# Source: use the local checkout, or fetch fresh from GitHub
# ----------------------------------------------------------------------
def fetch_from_github():
    """Clone (preferred) or download+extract the repo into INSTALL_DIR."""
    if shutil.which("git"):
        if os.path.isdir(os.path.join(INSTALL_DIR, ".git")):
            print(c("36", "Updating existing copy…"))
            subprocess.run(["git", "-C", INSTALL_DIR, "pull", "--ff-only", "--quiet"], check=False)
        else:
            if os.path.exists(INSTALL_DIR):
                shutil.rmtree(INSTALL_DIR, ignore_errors=True)
            print(c("36", f"Cloning {REPO}…"))
            subprocess.run(["git", "clone", "--depth", "1", "--quiet", CLONE_URL, INSTALL_DIR], check=True)
    else:
        print(c("36", f"Downloading {REPO} (git not found)…"))
        ctx = ssl.create_default_context()
        with urllib.request.urlopen(ZIP_URL, context=ctx) as r:
            data = r.read()
        tmpzip = os.path.join(tempfile.gettempdir(), "calm.zip")
        with open(tmpzip, "wb") as f:
            f.write(data)
        if os.path.exists(INSTALL_DIR):
            shutil.rmtree(INSTALL_DIR, ignore_errors=True)
        with zipfile.ZipFile(tmpzip) as z:
            tmp = tempfile.mkdtemp()
            z.extractall(tmp)
            inner = os.path.join(tmp, f"calm-for-ai-chats-{BRANCH}")
            shutil.move(inner, INSTALL_DIR)
        os.remove(tmpzip)
    if not os.path.exists(os.path.join(INSTALL_DIR, "manifest.json")):
        die("Fetch failed: manifest.json not found after download.")
    print(c("32", f"✓ Source ready at {INSTALL_DIR}"))
    return INSTALL_DIR


def get_source(prefer_remote=False):
    if HERE and not prefer_remote:
        return HERE
    return fetch_from_github()


def read_manifest(ext_dir):
    with open(os.path.join(ext_dir, "manifest.json"), encoding="utf-8") as f:
        return json.load(f)


def validate(ext_dir):
    missing = [p for p in EXTENSION_FILES if not os.path.exists(os.path.join(ext_dir, p))]
    if missing:
        die(f"Missing required files: {', '.join(missing)}")
    m = read_manifest(ext_dir)
    if m.get("manifest_version") != 3:
        die("manifest_version must be 3")
    print(c("32", f"✓ Valid extension: {m['name']} v{m['version']}"))
    return m


def build_zip(ext_dir, manifest):
    dist = os.path.join(ext_dir, "dist")
    os.makedirs(dist, exist_ok=True)
    out = os.path.join(dist, f"calm-for-ai-chats-v{manifest['version']}.zip")
    if os.path.exists(out):
        os.remove(out)
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
        for item in EXTENSION_FILES:
            path = os.path.join(ext_dir, item)
            if os.path.isdir(path):
                for base, _, files in os.walk(path):
                    for name in files:
                        if name == ".DS_Store":
                            continue
                        full = os.path.join(base, name)
                        z.write(full, os.path.relpath(full, ext_dir))
            else:
                z.write(path, item)
    print(c("32", f"✓ Packaged: {out} ({os.path.getsize(out)/1024:.1f} KB)"))
    return out


# ----------------------------------------------------------------------
# Chrome discovery / control
# ----------------------------------------------------------------------
def chrome_binary():
    system = platform.system()
    cands = {
        "Darwin": ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"],
        "Windows": [
            r"C:\Program Files\Google\Chrome\Application\chrome.exe",
            r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
        ],
        "Linux": ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser"],
    }.get(system, [])
    for cand in cands:
        if os.path.exists(cand):
            return cand
        found = shutil.which(cand)
        if found:
            return found
    return None


def chrome_running():
    try:
        if platform.system() == "Windows":
            out = subprocess.run(["tasklist"], capture_output=True, text=True).stdout.lower()
            return "chrome.exe" in out
        return subprocess.run(["pgrep", "-x",
                               "Google Chrome" if platform.system() == "Darwin" else "chrome"],
                              capture_output=True).returncode == 0
    except Exception:
        return False


def quit_chrome():
    system = platform.system()
    try:
        if system == "Darwin":
            subprocess.run(["osascript", "-e", 'quit app "Google Chrome"'], check=False)
        elif system == "Windows":
            subprocess.run(["taskkill", "/IM", "chrome.exe", "/F"], check=False)
        else:
            subprocess.run(["pkill", "chrome"], check=False)
    except Exception:
        pass
    for _ in range(20):
        if not chrome_running():
            return True
        time.sleep(0.25)
    return not chrome_running()


def make_launcher(ext_dir, binary):
    """Write a reusable launcher that starts Chrome with Calm loaded."""
    system = platform.system()
    if system == "Windows":
        path = os.path.join(INSTALL_DIR, "Calm-Chrome.bat")
        body = f'@echo off\r\nstart "" "{binary}" --load-extension="{ext_dir}" %*\r\n'
    else:
        path = os.path.join(INSTALL_DIR, "calm-chrome.command")
        body = f'#!/bin/bash\nexec "{binary}" --load-extension="{ext_dir}" "$@"\n'
    os.makedirs(INSTALL_DIR, exist_ok=True)
    with open(path, "w") as f:
        f.write(body)
    if system != "Windows":
        os.chmod(path, 0o755)
    return path


def auto_install(prefer_remote):
    ext_dir = get_source(prefer_remote=prefer_remote)
    validate(ext_dir)
    binary = chrome_binary()
    if not binary:
        die("Google Chrome not found. Install Chrome, or use Load unpacked manually.")

    launcher = make_launcher(ext_dir, binary)
    print(c("32", f"✓ Launcher created: {launcher}"))

    interactive = sys.stdin.isatty()
    if chrome_running():
        if interactive:
            ans = input(c("33", "Chrome is open. Quit and relaunch it with Calm now? [y/N] ")).strip().lower()
            if ans == "y":
                print("Quitting Chrome…")
                quit_chrome()
            else:
                print(c("36", "Skipped relaunch. Start Calm anytime with the launcher above."))
                _final_notes(launcher)
                return
        else:
            # piped (curl | python3 -): can't prompt; don't kill the user's browser.
            print(c("33", "Chrome is currently running — not closing it automatically."))
            print(c("36", "Quit Chrome, then run the launcher above to start with Calm."))
            _final_notes(launcher)
            return

    print(c("36", "Launching Chrome with Calm loaded…"))
    subprocess.Popen([binary, f"--load-extension={ext_dir}"],
                     stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1)
    _final_notes(launcher)


def _final_notes(launcher):
    print()
    print(c("1", "Done. Calm is loaded into your Chrome (your real profile/logins)."))
    print("  • Open ChatGPT or Gemini — controls appear bottom-right.")
    print("  • Chrome shows a 'developer mode extensions' banner — that's expected for")
    print("    sideloaded extensions; you can close it.")
    print(f"  • To start Chrome with Calm again later, run:\n      {launcher}")
    print(c("2", "  • For a permanent, banner-free, one-click install for everyone:"))
    print(c("2", "    publish to the Chrome Web Store (see STORE_LISTING.md)."))


def open_extensions_page():
    try:
        if platform.system() == "Darwin":
            subprocess.run(["open", "-a", "Google Chrome", "chrome://extensions"], check=False)
        elif platform.system() == "Windows":
            subprocess.run(["cmd", "/c", "start", "chrome", "chrome://extensions"], check=False)
        else:
            subprocess.run(["google-chrome", "chrome://extensions"], check=False)
    except Exception as e:
        print(c("33", f"! Open chrome://extensions yourself ({e})."))


def launch_demo():
    ext_dir = get_source()
    binary = chrome_binary() or die("Google Chrome not found.")
    profile = tempfile.mkdtemp(prefix="calm-demo-profile-")
    print(c("36", "Launching Chrome with Calm in a throwaway demo profile…"))
    subprocess.Popen([binary, f"--load-extension={ext_dir}",
                      f"--user-data-dir={profile}", "https://chatgpt.com"],
                     stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def manual_steps(ext_dir):
    print()
    print(c("1", "Install in your normal Chrome (keeps your logins):"))
    print("  1. Open  chrome://extensions")
    print("  2. Turn on  Developer mode  (top-right)")
    print(f"  3. Click  Load unpacked  and choose:\n       {ext_dir}")
    print("  4. Open ChatGPT or Gemini — controls appear bottom-right.")
    print()
    print(c("2", "  Prefer no clicking?  python3 install.py --auto"))


def main():
    ap = argparse.ArgumentParser(description="Install/package the Calm extension.")
    ap.add_argument("--auto", action="store_true", help="fetch + load into your Chrome (no Load unpacked)")
    ap.add_argument("--remote", action="store_true", help="force fetching from GitHub even inside a checkout")
    ap.add_argument("--zip", action="store_true", help="only build the distributable zip")
    ap.add_argument("--launch", action="store_true", help="load into a throwaway demo profile")
    ap.add_argument("--open", action="store_true", help="open chrome://extensions")
    args = ap.parse_args()

    if args.auto:
        auto_install(prefer_remote=args.remote)
        return
    if args.launch:
        launch_demo()
        return
    if args.open:
        open_extensions_page()
        return

    ext_dir = get_source(prefer_remote=args.remote)
    manifest = validate(ext_dir)
    build_zip(ext_dir, manifest)
    if args.zip:
        return
    manual_steps(ext_dir)


if __name__ == "__main__":
    main()
