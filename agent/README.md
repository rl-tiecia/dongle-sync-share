# Lovable Cloud — Local Delivery Agent

This small agent runs on a machine inside your network. It pulls finished
backup files from the Lovable Cloud and pushes them to a configured **SMB**
or **NFS** share. The Cloud handles authentication, retries with backoff
and deduplication — the agent only needs to know its `AGENT_TOKEN`.

## Setup

```bash
cd agent
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
```

Create a `.env` (or export env vars):

```bash
export LOVABLE_API_BASE="https://cofvhqmkekclgdbxadgn.functions.supabase.co"
export AGENT_TOKEN="<paste from dashboard → Agentes>"
export POLL_INTERVAL=15
# For NFS shares, mount them on the host first, e.g.:
#   sudo mount -t nfs 192.168.1.10:/backups /mnt/192.168.1.10_backups
export NFS_MOUNT_BASE=/mnt
```

Run:

```bash
python lovable_agent.py
```

## How it works

1. **Polls** `POST /agent-claim-jobs` every `POLL_INTERVAL` seconds. The
   server returns up to 10 jobs whose delivery is due, each containing a
   short-lived signed URL to the backup file plus the SMB/NFS destination
   credentials.
2. **Downloads** the file from Cloud Storage and verifies the **MD5** to
   guarantee integrity.
3. **Pushes** the file to the share:
   - **SMB**: native client via `smbprotocol`.
   - **NFS**: copies to the local mountpoint (you must `mount` the share
     beforehand). The expected mount path is
     `${NFS_MOUNT_BASE}/{host}_{share}`.
4. **Reports** the result via `POST /agent-report-delivery`. The Cloud
   schedules an exponential-backoff retry (30s, 1m, 2m, … capped at 6h)
   and stops after 8 attempts marking the delivery as `failed`.

## Error codes returned by the agent

| Code | Meaning |
|------|---------|
| `DOWNLOAD_FAILED` | could not download the file from Cloud Storage |
| `MD5_MISMATCH` | downloaded file MD5 differs from what the dongle reported |
| `AGENT_MISSING_SMB_LIB` | `smbprotocol` not installed |
| `SMB_WRITE_FAILED` | SMB authentication or write failed |
| `NFS_NOT_MOUNTED` | expected mountpoint not found on the host |
| `NFS_WRITE_FAILED` | copy to the mountpoint failed |
| `UNKNOWN_PROTOCOL` | destination protocol unsupported |
