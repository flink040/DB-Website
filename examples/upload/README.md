# Image-Uploader Varianten

Dieses Verzeichnis enthält zwei minimal gehaltene Varianten für einen Bild-Upload von eingeloggten Nutzer:innen. Beide Varianten validieren die Datei client- und serverseitig auf `image/*` und eine maximale Größe von 2&nbsp;MB.

## Gemeinsame Voraussetzungen

- Supabase-Projekt mit einer Tabelle `items` (Spalte `image_url` und einer Spalte mit der Nutzer-ID, z.&nbsp;B. `owner_id`).
- Die im Frontend verwendete Supabase-Anon-Key darf nur auf eigene Datensätze zugreifen (Row Level Security).
- Die Worker nutzen den Service-Role-Key, um das Token aus dem `Authorization`-Header zu verifizieren.

## Variante A – Supabase Storage

- Erstelle in Supabase einen öffentlichen Storage-Bucket `item-images`.
- Aktiviere in den Storage-Richtlinien den Zugriff für authentifizierte Nutzer:innen zum Upload in den Unterordner ihres Profils.
- Frontend-Komponente: [`supabase-storage/frontend.tsx`](./supabase-storage/frontend.tsx)
- Cloudflare-Worker (Route `PUT /api/items/:id/image`): [`supabase-storage/worker.ts`](./supabase-storage/worker.ts)

**Ablauf**

1. Der Client prüft Dateityp (`image/*`) und Größe (≤2&nbsp;MB).
2. Upload direkt in den Bucket `item-images` mittels Supabase-Client.
3. Der Bucket liefert eine public URL, die zusammen mit Metadaten an den Worker gesendet wird.
4. Der Worker verifiziert das Zugriffstoken, validiert Dateityp/Größe und speichert die URL in `items.image_url`.

**Konfiguration**

```bash
SUPABASE_URL=<https://your-project.supabase.co>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
PUBLIC_SUPABASE_URL=$SUPABASE_URL
PUBLIC_SUPABASE_ANON_KEY=<anon-key>
```

Binde den Worker in `wrangler.toml` z.&nbsp;B. so ein:

```toml
[[routes]]
pattern = "example.com/api/items/*/image"
script = "item-image"
```

## Variante B – Cloudflare R2 + Signierter Upload

- R2-Bucket mit public CDN/Custom-Domain (Basis-URL in `R2_PUBLIC_BASE_URL`).
- Worker-Route `POST /api/upload-url`: [`r2-signed-upload/worker.ts`](./r2-signed-upload/worker.ts)
- Frontend-Komponente: [`r2-signed-upload/frontend.tsx`](./r2-signed-upload/frontend.tsx)

**Ablauf**

1. Client prüft Dateityp und Größe wie oben.
2. Client ruft `POST /api/upload-url` mit Item-ID, Dateigröße und Content-Type auf.
3. Worker verifiziert das Supabase-Token, erzeugt eine 5&nbsp;Minuten gültige PUT-Signed-URL für R2 und liefert zusätzlich die spätere public URL.
4. Client lädt die Datei direkt nach R2 hoch.
5. Client schreibt die public URL in `items.image_url` (hier direkt via Supabase-Client, alternativ über denselben Worker wie in Variante&nbsp;A).

**Konfiguration**

```bash
SUPABASE_URL=<https://your-project.supabase.co>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
PUBLIC_SUPABASE_URL=$SUPABASE_URL
PUBLIC_SUPABASE_ANON_KEY=<anon-key>
R2_PUBLIC_BASE_URL=<https://cdn.example.com/item-images>
```

`wrangler.toml` (Auszug):

```toml
[[routes]]
pattern = "example.com/api/upload-url"
script = "item-upload-url"

[[r2_buckets]]
binding = "ITEM_IMAGES"
bucket_name = "item-images"
```

Die Worker geben CORS-Header zurück (`*` für Demonstrationszwecke). Passe die Policy in Produktion an deine Domain an.
