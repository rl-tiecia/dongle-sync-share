# CI RLS check

Validate Row-Level Security and function grants before deploying changes.

## Run locally

```bash
export SUPABASE_DB_URL="postgres://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres"
deno run --allow-net --allow-env --allow-read scripts/ci-rls-check.ts
```

The script exits with code `1` if any of the following is detected:

- A `public` table without `ROW LEVEL SECURITY` enabled
- A `SECURITY DEFINER` function used by RLS missing `GRANT EXECUTE TO authenticated`
- A sensitive table (`profiles`, `user_roles`, `device_secrets`, `delivery_agents`, `network_destinations`, `access_audit_log`) with a `SELECT` policy using `USING (true)`
- A `SECURITY DEFINER` function without `SET search_path`

## GitHub Actions

```yaml
name: RLS check
on: [pull_request]
jobs:
  rls:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: denoland/setup-deno@v1
        with:
          deno-version: v1.x
      - name: Run RLS check
        env:
          SUPABASE_DB_URL: ${{ secrets.SUPABASE_DB_URL }}
        run: deno run --allow-net --allow-env --allow-read scripts/ci-rls-check.ts
```

Add the `SUPABASE_DB_URL` secret in your GitHub repository settings (Settings → Secrets and variables → Actions).
