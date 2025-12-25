# unicorn-draw

Super simple pixel paint program: draw on a **32×32** grid, pick a color, share/export, and use **read mode** to render the drawing from a URL or JSON file.

This repo is designed to deploy as a **single service** on Coolify using **Nixpacks** (Node server with shared drawing persistence).

## Pages

- **Draw**: `index.html`
- **Read**: `read.html`

## Data formats (for your Pico)

Read mode supports:

- **URL payload**: `read.html#p=<payload>` (no server needed; payload is in the URL hash)
- **JSON fetch**: `read.html?src=/drawings/latest.json`

### JSON schema

`/drawings/latest.json` should look like:

```json
{
  "w": 32,
  "h": 32,
  "palette": ["#000000", "#ffffff"],
  "pixels": [0,0,0,1, ... 1024 entries total ...]
}
```

Where `pixels` is a flat array of palette indices in row-major order.

## Run locally

With Node.js:

```bash
node server.mjs
```

Then open `http://localhost:8080/`.

Or use any static file server (but you won't have Load/Save functionality):

```bash
python3 -m http.server 5173
```

## Deploy on Coolify

### Recommended: Nixpacks (single service)

Deploy as a single Node.js service with shared drawing persistence.

**Coolify setup:**

- **Build pack**: Nixpacks (auto-detects Node from `package.json`)
- **Expose port**: `8080` (or set `PORT` env var)
- **Persistent storage**: Mount a volume to `/data` (so saves survive redeploys)
- **Environment variable**: Set `DATA_DIR=/data` (optional; defaults to `/data` if not set)
- **Healthcheck**: Optional (`/` or `/read.html`)

**What you get:**

- **Draw page**: `/` — Load/Save buttons to work with the shared drawing
- **Read page**: `/read.html` — View the shared drawing
- **API endpoints**:
  - `GET /api/latest` — Read the current shared drawing
  - `POST /api/latest` — Save a new shared drawing
  - `GET /drawings/latest.json` — Back-compat alias for `/api/latest`
- All endpoints serve with `Cache-Control: no-store` for fresh data

**Alternative: Dockerfile**

If you prefer Docker, use `Dockerfile.app`:

- **Build pack**: Dockerfile (select `Dockerfile.app`)
- **Expose port**: `8080`
- **Persistent storage**: Mount a volume to `/data`

## Micropython Examples

See the [`examples/`](./examples/) directory for Micropython scripts to display drawings on hardware like the Pimoroni Cosmic Unicorn.

The example script (`examples/cosmic_unicorn.py`) fetches the shared drawing from your server and displays it on a 32×32 LED matrix, updating every few seconds.


