# DB-Website Deployment Leitfaden

Dieser Leitfaden fasst die notwendigen Schritte zusammen, um das Projekt auf Cloudflare Pages zu betreiben und die dazugehörigen Automatisierungen einzurichten.

## Schritt-für-Schritt-Anleitung

1. **Repository vorbereiten** – Projekt klonen und die lokalen Abhängigkeiten installieren (z. B. `npm install`, `pnpm install` oder `yarn install`, je nach verwendetem Paketmanager).
2. **Lokale Variablen setzen** – Die Datei [`.dev.vars`](.dev.vars) mit individuellen Werten befüllen. Wrangler lädt diese Werte automatisch für `wrangler dev`.
3. **Wrangler-Konfiguration anpassen** – In [`wrangler.toml`](wrangler.toml) die Platzhalter (`PUBLIC_SUPABASE_URL`, `API_BASE`, `ITEMS_DISCORD_ID_COLUMN`, `ITEM_CACHE`) durch die realen Projektwerte ersetzen. Der `PUBLIC_SUPABASE_ANON_KEY` wird nicht mehr fest in der Datei hinterlegt, sondern zur Buildzeit über eine Umgebungsvariable gesetzt (siehe Schritt 4).
4. **Cloudflare-Secrets und Environment Variablen speichern** – Hinterlege `PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET` und bei Bedarf `DISCORD_REDIRECT_URI` per Wrangler oder in deinem CI/CD-System, siehe Abschnitt „Secrets in Cloudflare setzen“.
5. **GitHub Actions konfigurieren** – In GitHub die Secrets `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_PAGES_PROJECT_NAME` (und optional `CF_PAGES_WORKER_BINDINGS`) hinterlegen. Danach sorgt der Workflow automatisch für Linting/Typechecking bei Pull Requests sowie für Deployments beim Push auf `main`.
6. **Deployment testen** – Lokal mit `wrangler dev` prüfen und anschließend einen Commit nach `main` pushen. Der GitHub-Workflow übernimmt das Pages-Deployment.

## Konfigurationsdateien

### `wrangler.toml`

```toml
name = "db-website-api"
compatibility_date = "2023-12-01"

[vars]
PUBLIC_SUPABASE_URL = "https://your-supabase-project.supabase.co"
PUBLIC_SUPABASE_ANON_KEY = "{{ env:PUBLIC_SUPABASE_ANON_KEY }}"
API_BASE = "https://api.example.com"
ITEMS_DISCORD_ID_COLUMN = "created_by_discord_id"

[[kv_namespaces]]
binding = "ITEM_CACHE"
id = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
preview_id = "yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy"
```

- `PUBLIC_*` Variablen stehen im Frontend zur Verfügung. Hinterlege den Wert von `PUBLIC_SUPABASE_ANON_KEY` über eine Umgebungsvariable (z. B. `wrangler secret put PUBLIC_SUPABASE_ANON_KEY` oder einen CI/CD-Secret/Environment-Eintrag).
- `API_BASE` wird für interne API-Aufrufe genutzt.
- `ITEMS_DISCORD_ID_COLUMN` legt fest, in welcher Spalte der Tabelle `items` die Discord-ID gespeichert wird (Standard: `created_by_discord_id`).
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
ITEMS_DISCORD_ID_COLUMN="created_by_discord_id"
```

Diese Datei dient als Vorlage und kann lokal angepasst werden. Für produktive Umgebungen sollten sensible Secrets (z. B. das Discord-Client-Secret) ausschließlich via `wrangler secret` gesetzt werden.

## Benötigte Platzhalter & Beispielwerte

| Variable | Sichtbarkeit | Beschreibung | Beispielwert |
| --- | --- | --- | --- |
| `PUBLIC_SUPABASE_URL` | Öffentlich (Frontend) | Supabase-Projekt-URL, die vom Browser genutzt wird. | `https://your-supabase-project.supabase.co` |
| `PUBLIC_SUPABASE_ANON_KEY` | Öffentlich (Frontend) | Öffentlicher Supabase-Anon-Key für Client-Anfragen. | `public-anon-key` |
| `SUPABASE_URL` | Secret (Functions) | Interne Supabase-URL für Cloudflare Functions. | `https://your-supabase-project.supabase.co` |
| `SUPABASE_ANON_KEY` | Secret (Functions) | Supabase-Anon-Key für serverseitige Aufrufe. | `public-anon-key` |
| `API_BASE` | Öffentlich (Functions) | Basis-URL des Pages-Deployments für API-Aufrufe. | `https://db-website-24f.pages.dev` |
| `ITEMS_DISCORD_ID_COLUMN` | Öffentlich (Functions) | Name der `items`-Spalte, in der die Discord-ID der Ersteller:innen gespeichert wird. | `created_by_discord_id` |
| `DISCORD_CLIENT_ID` | Secret (Functions) | Discord-OAuth Client ID (Supabase → Auth → Providers). | `1414567063221178429` |
| `DISCORD_CLIENT_SECRET` | Secret (Functions) | Discord-OAuth Client Secret. | `zJY-4MIyIzBU7xSGfduhmxKPff95zTOT` |
| `DISCORD_REDIRECT_URI` | Secret (Functions, optional) | Weiterleitungs-URL nach der Discord-Anmeldung; muss mit Discord/Supabase übereinstimmen. | `https://db-website-24f.pages.dev` |

Passe die Werte für deine eigene Umgebung an. Die hier aufgeführten Beispielwerte entsprechen der aktuellen Konfiguration.

### Supabase Tabelle `items`

Die Items-API erwartet, dass die Supabase-Tabelle `items` Metadaten zu den Ersteller:innen speichert. Standardmäßig werden folgende Spalten genutzt:

- `created_by_user_id` – verweist auf die Supabase-User-ID der Person, die den Datensatz angelegt hat.
- `created_by_discord_id` – speichert die Discord-ID der Person und wird über `ITEMS_DISCORD_ID_COLUMN` konfigurierbar gemacht.

Passe den Wert von `ITEMS_DISCORD_ID_COLUMN` an, falls die Spalte in deiner Datenbank anders heißt. Stelle außerdem sicher, dass die Rolle, mit der die API auf Supabase zugreift, Schreibrechte für diese Spalte besitzt.

### GitHub Actions Workflow

Der Workflow liegt unter [`.github/workflows/ci-pages-deploy.yml`](.github/workflows/ci-pages-deploy.yml) und besteht aus zwei Job-Typen:

- **Lint/Typecheck** – Läuft bei Pull Requests und führt (falls vorhanden) `npm run lint` sowie `npm run typecheck` aus.
- **Pages Deploy** – Läuft bei Pushes auf `main`, baut das Projekt und deployt es via `wrangler pages deploy`. Optional können Worker-Bindings über das Secret `CF_PAGES_WORKER_BINDINGS` (z. B. `--binding ITEM_CACHE=...`) durchgereicht werden.

## Secrets in Cloudflare setzen

Mit Wrangler werden Secrets pro Umgebung hinterlegt:

```bash
wrangler secret put PUBLIC_SUPABASE_ANON_KEY
# Eingabe: public-anon-key
wrangler secret put SUPABASE_URL
# Eingabe: https://your-supabase-project.supabase.co
wrangler secret put SUPABASE_ANON_KEY
# Eingabe: public-anon-key
wrangler secret put DISCORD_CLIENT_ID
# Eingabe: 1414567063221178429
wrangler secret put DISCORD_CLIENT_SECRET
# Eingabe: zJY-4MIyIzBU7xSGfduhmxKPff95zTOT
wrangler secret put DISCORD_REDIRECT_URI
# Eingabe: https://db-website-24f.pages.dev
```

Der Befehl fordert interaktiv den jeweiligen Wert an und speichert ihn im Projekt. Wiederhole den Vorgang für alle notwendigen Secrets.

Für CI/CD-Deployments (z. B. GitHub Actions) muss `PUBLIC_SUPABASE_ANON_KEY` außerdem als Environment-Variable exportiert werden, damit `wrangler pages deploy` den Wert zur Buildzeit injizieren kann:

```yaml
- name: Deploy to Cloudflare Pages
  env:
    PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.PUBLIC_SUPABASE_ANON_KEY }}
  run: wrangler pages deploy
```

Dank des Platzhalters `{{ env:PUBLIC_SUPABASE_ANON_KEY }}` greift Wrangler ausschließlich auf die gesetzte Umgebungsvariable zu. Du kannst das lokal testen, indem du den Wert explizit setzt:

```bash
PUBLIC_SUPABASE_ANON_KEY=public-anon-key wrangler pages dev
```

Ohne diese Variable bricht der Build bzw. das Deployment mit einem Hinweis auf den fehlenden Wert ab – so stellst du sicher, dass keine Repository-Werte mehr verwendet werden.

## Hinweis zum Discord Bot

Der Discord Bot wird unabhängig von Cloudflare Pages betrieben. Nutze dafür eine separate Plattform wie Railway, Fly.io, Docker-Container oder eine eigene VM und deploye ihn losgelöst von der Pages-Anwendung.
