# DB-Website Deployment Leitfaden

Dieser Leitfaden fasst die notwendigen Schritte zusammen, um das Projekt auf Cloudflare Pages zu betreiben und die dazugehörigen Automatisierungen einzurichten.

## Schritt-für-Schritt-Anleitung

1. **Repository vorbereiten** – Projekt klonen und die lokalen Abhängigkeiten installieren (z. B. `npm install`, `pnpm install` oder `yarn install`, je nach verwendetem Paketmanager).
2. **Lokale Variablen setzen** – Die Datei [`.dev.vars`](.dev.vars) mit individuellen Werten befüllen. Wrangler lädt diese Werte automatisch für `wrangler dev`.
3. **Wrangler-Konfiguration anpassen** – In [`wrangler.toml`](wrangler.toml) die Platzhalter (`PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY`, `API_BASE`, `ITEM_CACHE`) durch die realen Projektwerte ersetzen.
4. **Cloudflare-Secrets speichern** – Für geheime Werte (z. B. Service-Keys) die Wrangler CLI verwenden, siehe Abschnitt „Secrets in Cloudflare setzen“.
5. **GitHub Actions konfigurieren** – In GitHub die Secrets `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_PAGES_PROJECT_NAME` (und optional `CF_PAGES_WORKER_BINDINGS`) hinterlegen. Danach sorgt der Workflow automatisch für Linting/Typechecking bei Pull Requests sowie für Deployments beim Push auf `main`.
6. **Deployment testen** – Lokal mit `wrangler dev` prüfen und anschließend einen Commit nach `main` pushen. Der GitHub-Workflow übernimmt das Pages-Deployment.

## Konfigurationsdateien

### `wrangler.toml`

```toml
name = "db-website-api"
compatibility_date = "2023-12-01"

[vars]
PUBLIC_SUPABASE_URL = "https://your-supabase-project.supabase.co"
PUBLIC_SUPABASE_ANON_KEY = "public-anon-key"
API_BASE = "https://api.example.com"

[[kv_namespaces]]
binding = "ITEM_CACHE"
id = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
preview_id = "yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy"
```

- `PUBLIC_*` Variablen stehen im Frontend zur Verfügung.
- `API_BASE` wird für interne API-Aufrufe genutzt.
- `ITEM_CACHE` bindet das Cloudflare KV-Namespace an das Projekt; `preview_id` ist optional, aber hilfreich für Staging-Deployments.

### `.dev.vars`

```bash
# Lokale Entwicklungswerte
PUBLIC_SUPABASE_URL="https://your-supabase-project.supabase.co"
PUBLIC_SUPABASE_ANON_KEY="public-anon-key"
API_BASE="http://localhost:8788"
```

Diese Datei dient als Vorlage und kann lokal angepasst werden. Sensible Secrets gehören nicht hier hinein, sondern werden über `wrangler secret` gesetzt.

### GitHub Actions Workflow

Der Workflow liegt unter [`.github/workflows/ci-pages-deploy.yml`](.github/workflows/ci-pages-deploy.yml) und besteht aus zwei Job-Typen:

- **Lint/Typecheck** – Läuft bei Pull Requests und führt (falls vorhanden) `npm run lint` sowie `npm run typecheck` aus.
- **Pages Deploy** – Läuft bei Pushes auf `main`, baut das Projekt und deployt es via `wrangler pages deploy`. Optional können Worker-Bindings über das Secret `CF_PAGES_WORKER_BINDINGS` (z. B. `--binding ITEM_CACHE=...`) durchgereicht werden.

## Secrets in Cloudflare setzen

Mit Wrangler werden Secrets pro Umgebung hinterlegt:

```bash
wrangler secret put SUPABASE_SERVICE_ROLE_KEY
wrangler secret put DISCORD_WEBHOOK_URL
```

Der Befehl fordert interaktiv den jeweiligen Wert an und speichert ihn im Projekt. Wiederhole den Vorgang für alle notwendigen Secrets.

## Hinweis zum Discord Bot

Der Discord Bot wird unabhängig von Cloudflare Pages betrieben. Nutze dafür eine separate Plattform wie Railway, Fly.io, Docker-Container oder eine eigene VM und deploye ihn losgelöst von der Pages-Anwendung.
