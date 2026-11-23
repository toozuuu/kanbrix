# Self-host Kanbrix

Use the local stack to try Kanbrix on one computer. Use the production stack for a team accessing a virtual server through a domain. Both build the Rust API and React frontend from this repository. Docker runs PostgreSQL and Redis alongside them.

| | Local computer | Linux virtual server |
|---|---|---|
| Compose file | `docker-compose.yml` (default) | `docker-compose.production.yml` |
| Browser address | `http://localhost:5173` | Your public HTTPS origin |
| Initial database | Includes development fixtures | Empty installation, then application migrations |
| Host ports | Loopback 5173, 8080, 5432 | Loopback 5173 behind a TLS proxy |
| Persistent data | PostgreSQL and uploads in Docker volumes | Separate production PostgreSQL and upload volumes |

## 1. Prepare the machine

Install Git and Docker with the Compose v2 plugin. On Windows or macOS, start Docker Desktop. Windows users should select Linux containers. On a Linux server, start Docker Engine and use an account permitted to manage containers. Check both commands before cloning. The first build needs internet access to fetch images and dependencies.

```sh
docker version
docker compose version
git clone https://github.com/toozuuu/kanbrix.git
cd kanbrix
```

Run subsequent commands from this directory. The local commands also work in PowerShell. The production and backup examples use a Linux shell.

## 2A. Run locally

```sh
docker compose up -d --build
docker compose ps
docker compose logs --tail=100 api
```

Open [Kanbrix](http://localhost:5173), select Register, and create an account. Visit [API readiness](http://localhost:8080/ready) to check the backend and [Swagger UI](http://localhost:8080/swagger-ui/) to explore the API. Create or select a workspace, create a project, then create an issue and reopen it. Refresh the page to confirm it was saved.

Stop with `docker compose stop` and resume with `docker compose up -d`. Docker retains the database and uploads across these operations. To modify the application with Vite and Cargo, see the [development guide](DEVELOPMENT.md).

## 2B. Run on a virtual server

1. Point the domain's DNS A record at the server's public IPv4 address. If you publish an AAAA record, it must also reach this server. Allow inbound TCP 80 and 443 at the provider and host firewalls and retain your SSH access.
2. Install a TLS reverse proxy on the host. The example below assumes Caddy runs as a system service on the same Linux host as Docker. Use a dedicated domain such as `board.example.com`.
3. Create the production settings in the repository directory. Replace the example domain with your own. Run this **once on a new installation**. Keep the generated file private and preserve it for recovery.

```sh
( set -C; umask 077
  printf 'SITE_URL=https://board.example.com\nPOSTGRES_PASSWORD=%s\n' "$(openssl rand -hex 32)" > .env.production
)
```

Use the full HTTPS origin without a trailing slash. Compose uses it for the API's browser origin and the web build. PostgreSQL uses the password when it first initializes its volume. Changing the file later also requires updating the database role password.

4. Define a shell shortcut for this deployment. Run this definition again when opening a new shell in the repository.

```sh
kb() { docker compose --env-file .env.production -f docker-compose.production.yml "$@"; }
kb config --quiet
kb up -d --build
kb ps
kb logs --tail=100 api web
curl -I http://127.0.0.1:5173/
```

5. Add this site block to the host's Caddyfile (typically `/etc/caddy/Caddyfile`). Replace the domain here too. The bundled web container forwards API requests and WebSocket upgrades to the private API service.

```caddyfile
board.example.com {
    reverse_proxy 127.0.0.1:5173
}
```

```sh
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

6. Visit your HTTPS domain and register an account. Registration is available through the public web UI. For an internal-only installation, restrict access at the network or proxy before sharing the address. Create an issue, open the same board in a second signed-in window, and move the issue. Check that both windows update. Upload and download a small attachment to verify file storage.

## 3. Back up and restore

For production, keep the database, attachments, private environment file and deployed Git revision together. The commands below use the `kb` function from step 2B. Run during a maintenance window. Stopping the API pauses writes so the database and files represent the same point in time.

```sh
(
  set -eu
  umask 077
  backup="backups/$(date -u +%Y%m%dT%H%M%SZ)"
  mkdir -p "$backup"
  cp .env.production "$backup/"
  git rev-parse HEAD > "$backup/revision"
  kb stop api
  trap 'kb up -d api' EXIT
  kb exec -T postgres pg_dump -U postgres -Fc rusttrack > "$backup/database.dump"
  kb run --rm -T --no-deps --entrypoint tar api -C /app/uploads -czf - . > "$backup/uploads.tar.gz"
  kb exec -T postgres pg_restore --list < "$backup/database.dump" > /dev/null
  tar -tzf "$backup/uploads.tar.gz" > /dev/null
)
```

Store a protected copy off the server. Preserve any local source changes separately if deploying an uncommitted checkout.

**Restore to a fresh host or isolated VM with empty volumes.** Clone the repository, check out the recorded revision, copy the saved environment file into the checkout as `.env.production`, and define `kb` again. Set `backup` to the directory containing the recovered files. The commands assume the destination database is empty.

```sh
(
  set -eu
  backup=/path/to/recovered-backup
  kb up -d --wait postgres redis
  kb build api
  kb exec -T postgres pg_restore --exit-on-error --single-transaction -U postgres -d rusttrack < "$backup/database.dump"
  kb run --rm -T --no-deps --entrypoint tar api -C /app/uploads -xzf - < "$backup/uploads.tar.gz"
  kb up -d --build
)
```

Verify sign-in, an existing issue and a downloaded attachment before switching traffic. For a **local** backup, use the same dump and archive commands with `docker compose` in place of `kb`. Restore a local dump into an empty database, since the local Compose file seeds a fresh database on startup.

## 4. Upgrade and operate

Record the running revision and take a backup first. From a clean deployment checkout, run:

```sh
git pull --ff-only
kb up -d --build
kb ps
kb logs --tail=100 api
```

The API applies database migrations at startup. If an upgrade requires rollback after migrating, restore the pre-upgrade backup with its matching code revision. Use `kb stop` for a temporary shutdown. The `down -v` option deletes the installation's named data volumes.

## Troubleshooting

| Symptom | What to check |
|---|---|
| Docker reports permission denied or cannot connect | Confirm Docker Desktop or Engine is running and `docker version` shows a Server section in the terminal performing the build. |
| Port already allocated | Check for another local or production stack using port 5173. Both Compose files publish the web service on that host port. |
| Web UI opens but configuration, preferences or workflow returns 404 | Inspect the failing request in the browser's Network panel. An empty 404 across several endpoints can indicate an older API image. Rebuild from the same checkout as the frontend using `docker compose up -d --build api` locally or `kb up -d --build` on the server. Inspect API startup logs. |
| Board loads but live updates fail | Verify the public origin exactly matches `SITE_URL` and that the proxy forwards WebSocket upgrades. For local Vite on port 5174, set `$env:CLIENT_ORIGIN = "http://localhost:5174"` in PowerShell before running `docker compose up -d --build api`. |
| HTTPS fails or proxy returns 502 | Check DNS, inbound ports, proxy logs and `curl -I http://127.0.0.1:5173/` on the server. The production proxy target is the web container's loopback port. |
| Login does not persist | Access production through its configured HTTPS domain. The production API sets secure session cookies. |
| Database authentication fails after a configuration change | Compare the deployed secret with the credential used to initialize the existing volume. Recover the original secret or coordinate a database password rotation. |
