# Deploying Kalaai Code to a VPS (behind an existing Traefik)

This guide deploys the app to a Hostinger (or any Linux) VPS that **already runs Traefik** on
ports 80/443 (the Hostinger n8n template does). Kalaai Code joins that Traefik with Docker
labels, so your existing apps keep working and nothing else needs the ports.

```
Browser ──HTTPS──▶ Traefik ──/api/*──▶ api (FastAPI :8000) ──▶ db (Postgres)
                      └────everything else──▶ web (nginx :8080, the React app)
```

Public address used below: **https://77-37-45-4.sslip.io** (a free name that resolves to
`77.37.45.4`). Replace the IP everywhere if your server's IP is different.

> No Traefik on your server? This override does not apply. Run the base stack behind
> any reverse proxy that terminates HTTPS and forwards `/api` to `api:8000` and the rest to
> `web:8080`, or ask for a Caddy variant.

---

## 0. Before you start

- The VPS is running, you can SSH in (or use Hostinger's browser terminal).
- Ports **80 and 443** are open in the Hostinger firewall (plus 22 for SSH). Do **not** open
  3000, 5432 or 8000: this setup keeps them closed on purpose.
- At least ~2 GB of free RAM (the frontend build uses about 1 GB). Check with `free -h`. If it
  is tight, add swap: `fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile`.
- Docker Compose **2.24 or newer**: `docker compose version`.

## 1. Get the code onto the server

The repo is private, so give the server read-only access with a **deploy key**:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/kalaai_deploy -N "" -C "kalaai-vps"
cat ~/.ssh/kalaai_deploy.pub
```

On GitHub open the repo → **Settings → Deploy keys → Add deploy key**, paste the public key,
leave "Allow write access" **unchecked**. Then:

```bash
GIT_SSH_COMMAND="ssh -i ~/.ssh/kalaai_deploy -o IdentitiesOnly=yes" \
  git clone git@github.com:Saran081291/kalaai-code-ai.git
cd kalaai-code-ai
git config core.sshCommand "ssh -i ~/.ssh/kalaai_deploy -o IdentitiesOnly=yes"
```

(If you make the repo public you can skip the key and clone over HTTPS.)

## 2. Find your Traefik settings

```bash
bash deploy/discover-traefik.sh
```

It prints the Traefik container, its Docker **network**, the **certificate resolver** name and
the HTTPS **entrypoint**. Typical values for the Hostinger n8n template:
`TRAEFIK_NETWORK=root_default`, `TRAEFIK_CERTRESOLVER=mytlschallenge`, `TRAEFIK_ENTRYPOINT=websecure`.
Use what the script prints, not these examples.

## 3. Create `.env`

```bash
bash deploy/make-env.sh        # generates SECRET_KEY and POSTGRES_PASSWORD
nano .env
```

Fill in:

| Variable | Value |
|----------|-------|
| `TRAEFIK_NETWORK`, `TRAEFIK_CERTRESOLVER` | from step 2 |
| `OPENAI_API_KEY` | your key (or set `AI_PROVIDER=anthropic` and `ANTHROPIC_API_KEY`) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | optional, see step 6 |

Keep `.env` private (the script already sets permissions to 600).

## 4. Start it

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps
```

The first build takes a few minutes. Migrations run automatically when the API starts.
Traefik requests the HTTPS certificate on the first visit; allow up to a minute.

Tip: save yourself typing with `export COMPOSE_FILE=docker-compose.yml:docker-compose.prod.yml`
so plain `docker compose ...` commands use both files.

## 5. Check it works

```bash
curl -sI https://77-37-45-4.sslip.io | head -1                   # HTTP/2 200  (the app)
curl -s  https://77-37-45-4.sslip.io/api/v1/auth/me               # 401 JSON  (the API answers)
```

Then open https://77-37-45-4.sslip.io in a browser, register an instructor, create a course
and an assignment, register a student, and submit some code.

## 6. Google sign-in (optional)

In Google Cloud Console → APIs & Services → Credentials → your OAuth client:

- **Authorized JavaScript origins:** `https://77-37-45-4.sslip.io`
- **Authorized redirect URIs:** `https://77-37-45-4.sslip.io/api/v1/auth/google/callback`

While the consent screen is in *Testing*, only listed **Test users** can sign in. Put the
client ID/secret in `.env`, then `docker compose ... up -d api`.

## 7. Before you invite testers

- **Spending limit.** Anyone using the site spends *your* AI credits (`gpt-5.5` is the costliest
  option). Set a monthly limit on the key in the OpenAI dashboard.
- **Sign-up is open.** Anyone with the URL can register. Share the link only with people you
  trust, or change the keys later to cut access.
- **Back up the database** (the courses, accounts and roasts live in the `postgres_data` volume):
  ```bash
  docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' | gzip > kalaai-$(date +%F).sql.gz
  ```
  Run it from cron (`crontab -e`) and copy the file off the server.

## Updating

```bash
cd ~/kalaai-code-ai
git pull
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

Logs: `docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f api`.

---

## Troubleshooting

| Symptom | Likely cause and fix |
|---------|----------------------|
| Plain `404 page not found` from the site | Traefik is not routing to the containers. Check `TRAEFIK_NETWORK` matches Traefik's network, then `docker compose ... up -d` again. `docker logs <traefik-container>` shows router errors. |
| Browser warns the certificate is invalid / self-signed | The resolver name is wrong or the certificate is not issued yet. Check `TRAEFIK_CERTRESOLVER`, wait a minute, and read `docker logs <traefik-container> \| grep -i acme`. Let's Encrypt limits how many certificates one domain family can get per week; `sslip.io` is shared by many users, so if issuance is refused, switch to a DuckDNS name and change `KALAAI_HOST`, `FRONTEND_URL`, `ALLOWED_ORIGINS`, `VITE_API_URL` and `GOOGLE_REDIRECT_URI` to match. |
| App loads but every request fails | `VITE_API_URL` was wrong when the image was built. Fix `.env` and rebuild: `docker compose ... up -d --build web`. |
| `compose` error about `!reset` | Docker Compose is older than 2.24. Update Docker. |
| `network ... not found` | `TRAEFIK_NETWORK` is wrong. List networks: `docker network ls`. |
| Google error `redirect_uri_mismatch` | The redirect URI in Google Cloud Console must match `.env` exactly (https, no trailing slash). |
| Sign-in blocked "Access blocked" | The account is not on the consent screen's Test users list. |
