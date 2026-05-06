#!/usr/bin/env python3
"""
Lovable Cloud → SMB/NFS local delivery agent
============================================

Polls the Lovable Cloud `agent-claim-jobs` endpoint, downloads finished
backup files from Cloud Storage and pushes them to the configured SMB or
NFS share. Reports success/failure (with retry handling on the server) via
the `agent-report-delivery` webhook.

Environment variables (or .env file in the same folder):
    LOVABLE_API_BASE   e.g. https://cofvhqmkekclgdbxadgn.functions.supabase.co
    AGENT_TOKEN        token issued from the dashboard (Agentes page)
    POLL_INTERVAL      seconds between polls (default: 15)
    NFS_MOUNT_BASE     optional, base dir where NFS shares are mounted (default: /mnt)

Dependencies:
    pip install requests smbprotocol

NFS strategy: relies on the OS having the share mounted at
``{NFS_MOUNT_BASE}/{host}_{share}``. The agent only writes to the local
mountpoint — it does not implement the NFS protocol.
"""
from __future__ import annotations

import hashlib
import os
import shutil
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import requests

try:
    import smbclient  # smbprotocol package
except ImportError:
    smbclient = None  # SMB jobs will fail with a clear error code

API_BASE = os.environ.get("LOVABLE_API_BASE", "").rstrip("/")
AGENT_TOKEN = os.environ.get("AGENT_TOKEN", "")
POLL_INTERVAL = int(os.environ.get("POLL_INTERVAL", "15"))
NFS_MOUNT_BASE = os.environ.get("NFS_MOUNT_BASE", "/mnt")
DOWNLOAD_DIR = Path(os.environ.get("DOWNLOAD_DIR", "/tmp/lovable-agent"))
DOWNLOAD_DIR.mkdir(parents=True, exist_ok=True)

if not API_BASE or not AGENT_TOKEN:
    sys.exit("LOVABLE_API_BASE and AGENT_TOKEN are required")


@dataclass
class Result:
    ok: bool
    error: str | None = None
    error_code: str | None = None
    delivered_path: str | None = None


def claim_jobs() -> list[dict[str, Any]]:
    r = requests.post(
        f"{API_BASE}/agent-claim-jobs",
        headers={"X-Agent-Token": AGENT_TOKEN},
        timeout=30,
    )
    r.raise_for_status()
    return r.json().get("jobs", [])


def report(backup_id: str, res: Result) -> None:
    body = {
        "backup_id": backup_id,
        "success": res.ok,
        "error": res.error,
        "error_code": res.error_code,
        "delivered_path": res.delivered_path,
    }
    try:
        requests.post(
            f"{API_BASE}/agent-report-delivery",
            headers={"X-Agent-Token": AGENT_TOKEN, "Content-Type": "application/json"},
            json=body,
            timeout=30,
        )
    except Exception as e:
        print(f"[warn] report failed: {e}")


def download(url: str, dest: Path) -> str:
    h = hashlib.md5()
    with requests.get(url, stream=True, timeout=300) as r:
        r.raise_for_status()
        with open(dest, "wb") as f:
            for chunk in r.iter_content(1024 * 256):
                if chunk:
                    f.write(chunk)
                    h.update(chunk)
    return h.hexdigest()


def deliver_smb(local: Path, dest: dict[str, Any], filename: str) -> Result:
    if smbclient is None:
        return Result(False, "smbprotocol not installed", "AGENT_MISSING_SMB_LIB")
    try:
        smbclient.ClientConfig(
            username=f"{dest.get('domain') + '\\\\' if dest.get('domain') else ''}{dest.get('username') or ''}",
            password=dest.get("password") or "",
        )
        host = dest["host"]
        share = dest["share"]
        remote = (dest.get("remote_path") or "/").strip("/").replace("/", "\\")
        remote_dir = rf"\\{host}\{share}" + (f"\\{remote}" if remote else "")
        try:
            smbclient.makedirs(remote_dir, exist_ok=True)
        except Exception:
            pass
        target = remote_dir + "\\" + filename
        with open(local, "rb") as src, smbclient.open_file(target, mode="wb") as dst:
            shutil.copyfileobj(src, dst)
        return Result(True, delivered_path=target)
    except Exception as e:
        return Result(False, str(e), "SMB_WRITE_FAILED")


def deliver_nfs(local: Path, dest: dict[str, Any], filename: str) -> Result:
    try:
        host = dest["host"]
        share = dest["share"]
        mount = Path(NFS_MOUNT_BASE) / f"{host}_{share}".replace("/", "_")
        if not mount.exists():
            return Result(
                False,
                f"NFS mount {mount} not found. Mount the share first.",
                "NFS_NOT_MOUNTED",
            )
        sub = (dest.get("remote_path") or "/").strip("/")
        target_dir = mount / sub if sub else mount
        target_dir.mkdir(parents=True, exist_ok=True)
        target = target_dir / filename
        shutil.copy2(local, target)
        return Result(True, delivered_path=str(target))
    except Exception as e:
        return Result(False, str(e), "NFS_WRITE_FAILED")


def process(job: dict[str, Any]) -> None:
    backup_id = job["backup_id"]
    filename = job["filename"]
    expected_md5 = (job.get("md5") or "").lower() or None
    dest = job["destination"]
    proto = (dest.get("protocol") or "").lower()
    print(f"[job {backup_id}] {filename} -> {proto.upper()} {dest.get('host')}")

    local = DOWNLOAD_DIR / f"{backup_id}_{filename}"
    try:
        actual_md5 = download(job["download_url"], local)
    except Exception as e:
        report(backup_id, Result(False, f"download: {e}", "DOWNLOAD_FAILED"))
        return

    if expected_md5 and actual_md5 != expected_md5:
        report(backup_id, Result(False, f"md5 mismatch {actual_md5}", "MD5_MISMATCH"))
        local.unlink(missing_ok=True)
        return

    if proto == "smb":
        res = deliver_smb(local, dest, filename)
    elif proto == "nfs":
        res = deliver_nfs(local, dest, filename)
    else:
        res = Result(False, f"protocol {proto}", "UNKNOWN_PROTOCOL")

    report(backup_id, res)
    local.unlink(missing_ok=True)


def main() -> None:
    print(f"Lovable agent starting. API={API_BASE} interval={POLL_INTERVAL}s")
    while True:
        try:
            jobs = claim_jobs()
            if jobs:
                print(f"Claimed {len(jobs)} job(s)")
            for job in jobs:
                process(job)
        except requests.HTTPError as e:
            print(f"[error] HTTP {e.response.status_code}: {e.response.text[:200]}")
        except Exception as e:
            print(f"[error] {e}")
        time.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    main()
