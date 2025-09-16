# DB-Website Deployment Leitfaden

Dieser Leitfaden fasst die notwendigen Schritte zusammen, um das Projekt auf Cloudflare Pages zu betreiben und die dazugehörigen Automatisierungen einzurichten.

## Schritt-für-Schritt-Anleitung

1. **Repository vorbereiten** – Projekt klonen und die lokalen Abhängigkeiten installieren (z. B. `npm install`, `pnpm install` oder `yarn install`, je nach verwendetem Paketmanager).
2. **Lokale Variablen setzen** – Die Datei [`.dev.vars`](.dev.vars) mit individuellen Werten befüllen. Wrangler lädt diese Werte automatisch für `wrangler dev`.
3. **Wrangler-Konfiguration anpassen** – In [`wrangler.toml`](wrangler.toml) die Platzhalter (`PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY`, `API_BASE`, `ITEM_CACHE`) durch die realen Projektwerte ersetzen.
4. **Cloudflare-Secrets speichern** – Hinterlege `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET` und bei Bedarf `DISCORD_REDIRECT_URI` per Wrangler, siehe Abschnitt „Secrets in Cloudflare setzen“.
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
SUPABASE_URL="https://your-supabase-project.supabase.co"
SUPABASE_ANON_KEY="public-anon-key"
API_BASE="http://localhost:8788"
DISCORD_CLIENT_ID="1414567063221178429"
DISCORD_CLIENT_SECRET="zJY-4MIyIzBU7xSGfduhmxKPff95zTOT"
DISCORD_REDIRECT_URI="https://db-website-24f.pages.dev"
```

Diese Datei dient als Vorlage und kann lokal angepasst werden. Für produktive Umgebungen sollten sensible Secrets (z. B. das Discord-Client-Secret) ausschließlich via `wrangler secret` gesetzt werden.

## Benötigte Platzhalter & Beispielwerte

| Variable | Sichtbarkeit | Beschreibung | Beispielwert |
| --- | --- | --- | --- |
| `PUBLIC_SUPABASE_URL` | Öffentlich (Frontend) | Supabase-Projekt-URL, die vom Browser genutzt wird. | `https://taejvzqmlswbgsknthxz.supabase.com` |
| `PUBLIC_SUPABASE_ANON_KEY` | Öffentlich (Frontend) | Öffentlicher Supabase-Anon-Key für Client-Anfragen. | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9…` |
| `SUPABASE_URL` | Secret (Functions) | Interne Supabase-URL für Cloudflare Functions. | `https://taejvzqmlswbgsknthxz.supabase.com` |
| `SUPABASE_ANON_KEY` | Secret (Functions) | Supabase-Anon-Key für serverseitige Aufrufe. | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9…` |
| `API_BASE` | Öffentlich (Functions) | Basis-URL des Pages-Deployments für API-Aufrufe. | `https://db-website-24f.pages.dev` |
| `DISCORD_CLIENT_ID` | Secret (Functions) | Discord-OAuth Client ID (Supabase → Auth → Providers). | `1414567063221178429` |
| `DISCORD_CLIENT_SECRET` | Secret (Functions) | Discord-OAuth Client Secret. | `zJY-4MIyIzBU7xSGfduhmxKPff95zTOT` |
| `DISCORD_REDIRECT_URI` | Secret (Functions, optional) | Weiterleitungs-URL nach der Discord-Anmeldung; muss mit Discord/Supabase übereinstimmen. | `https://db-website-24f.pages.dev` |

Passe die Werte für deine eigene Umgebung an. Die hier aufgeführten Beispielwerte entsprechen der aktuellen Konfiguration.

### GitHub Actions Workflow

Der Workflow liegt unter [`.github/workflows/ci-pages-deploy.yml`](.github/workflows/ci-pages-deploy.yml) und besteht aus zwei Job-Typen:

- **Lint/Typecheck** – Läuft bei Pull Requests und führt (falls vorhanden) `npm run lint` sowie `npm run typecheck` aus.
- **Pages Deploy** – Läuft bei Pushes auf `main`, baut das Projekt und deployt es via `wrangler pages deploy`. Optional können Worker-Bindings über das Secret `CF_PAGES_WORKER_BINDINGS` (z. B. `--binding ITEM_CACHE=...`) durchgereicht werden.

## Secrets in Cloudflare setzen

Mit Wrangler werden Secrets pro Umgebung hinterlegt:

```bash
wrangler secret put SUPABASE_URL
# Eingabe: https://taejvzqmlswbgsknthxz.supabase.com
wrangler secret put SUPABASE_ANON_KEY
# Eingabe: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9…
wrangler secret put DISCORD_CLIENT_ID
# Eingabe: 1414567063221178429
wrangler secret put DISCORD_CLIENT_SECRET
# Eingabe: zJY-4MIyIzBU7xSGfduhmxKPff95zTOT
wrangler secret put DISCORD_REDIRECT_URI
# Eingabe: https://db-website-24f.pages.dev
```

Der Befehl fordert interaktiv den jeweiligen Wert an und speichert ihn im Projekt. Wiederhole den Vorgang für alle notwendigen Secrets.

## Hinweis zum Discord Bot

Der Discord Bot wird unabhängig von Cloudflare Pages betrieben. Nutze dafür eine separate Plattform wie Railway, Fly.io, Docker-Container oder eine eigene VM und deploye ihn losgelöst von der Pages-Anwendung.
