# List Management System

English | [简体中文](README.md)

A list management application built with **Vue 3 + Element Plus + Axios + Koa 2**, supporting both **blacklist and whitelist** entries. Data is persisted in a local JSON file, with search, type filtering, pagination, create, update, and soft delete. It also includes **WC3 lobby screenshot scanning**: upload a lobby screenshot and the app recognizes player names and checks them against both lists.

![Application preview](docs/i18n-preview.png)

## Features

- Shows only records where `isDeleted !== true`, sorted by `addTime` descending
- Filter by list type: all / blacklist / whitelist
- Fixed page size of 10 records with pagination
- Fuzzy search by `name` or `map` using OR logic, case-insensitive
- 300 ms search debounce; empty filters return all records
- Create / edit dialogs support choosing a list type, with client-side and server-side validation
- Blacklist names render in red and whitelist names in green, with a type badge
- Confirmation before deletion; records are soft-deleted and kept in the JSON file
- Unified request loading state and success / error toast notifications
- Auto-incrementing string IDs that are never reused after deletion
- Server-generated `addTime`
- `async-lock`-serialized reads and writes to prevent lost updates
- Automatically creates `data/blacklist.json`; legacy records are migrated to the blacklist
- **WC3 lobby screenshot OCR**: locates both teams, recognizes player names, and returns separate whitelist / blacklist matches
- OCR results can be corrected manually and matched again; screenshots are processed in memory only
- Frontend styles use **SCSS**, with separate components for forms and screenshot scanning
- Built-in **English / Chinese** internationalization, defaulting to English with a language switch in the top-right corner

## Tech Stack

| Layer | Technologies |
| --- | --- |
| Frontend | Vue 3, Vite 5, Element Plus, Axios, SCSS, Vue I18n |
| Backend | Koa 2, @koa/router, @koa/cors, koa-bodyparser, async-lock |
| Screenshot OCR | Tesseract.js 5, Sharp, bundled English trained data |
| Persistence | Local JSON file: `data/blacklist.json` |

## Internationalization

The app defaults to English on first visit. Use the `EN` / `中文` switch in the top-right corner to change languages.

- Translations are managed with `vue-i18n` and stored in `src/i18n/locales/`
- Element Plus component locale changes together with the page language
- The `<html lang>` attribute and browser tab title are updated automatically
- The selected language is saved under the `blacklist-locale` key in `localStorage`
- To reset back to the default English, run the following in the browser console:

  ```js
  localStorage.removeItem('blacklist-locale')
  location.reload()
  ```

## Frontend Components

| Component | Responsibility |
| --- | --- |
| `views/BlacklistView.vue` | List view, type filter, search, pagination, deletion, and page layout |
| `components/BlacklistFormDialog.vue` | Add / edit dialog, list type selection, form validation, and submission |
| `components/Wc3ScanDialog.vue` | Screenshot upload, OCR, separate whitelist / blacklist matches, and manual correction |

## Project Structure

```text
blacklist/
├─ data/
│  └─ blacklist.json          # Data file (created automatically on first run)
├─ server/
│  ├─ app.js                  # Koa instance, middleware, unified error responses
│  ├─ index.js                # Server entry point
│  ├─ blacklistStore.js       # JSON persistence, incrementing IDs, soft delete
│  ├─ routes/
│  │  └─ blacklist.js         # RESTful routes + screenshot scanning endpoints
│  ├─ services/
│  │  ├─ wc3Scan.js           # Color-block detection, image preprocessing, OCR, name cleanup
│  │  └─ blacklistMatcher.js  # Name normalization, exact and fuzzy matching
│  └─ utils/
│     ├─ errors.js            # HttpError
│     ├─ listTypes.js         # List type constants and legacy fallback
│     └─ validation.js        # Request validation
├─ src/
│  ├─ api/
│  │  ├─ request.js           # Axios wrapper and response interceptor with i18n errors
│  │  └─ blacklist.js         # Blacklist API functions
│  ├─ components/
│  │  ├─ BlacklistFormDialog.vue  # Create / edit dialog
│  │  └─ Wc3ScanDialog.vue        # WC3 screenshot scanning dialog
│  ├─ i18n/
│  │  ├─ index.js             # i18n initialization, switching, and persistence
│  │  └─ locales/
│  │     ├─ en-US.js          # English messages (default)
│  │     └─ zh-CN.js          # Chinese messages
│  ├─ styles/
│  │  ├─ index.scss           # Global SCSS
│  │  └─ _dialogs.scss        # Shared dialog heading mixin
│  ├─ views/BlacklistView.vue # Main list page
│  ├─ App.vue
│  └─ main.js
├─ docs/
│  ├─ preview.png
│  ├─ i18n-preview.png
│  ├─ player-row-example.png
│  ├─ scan-preview.png
│  └─ scan-upload.png
├─ index.html
├─ vite.config.js
├─ package.json
└─ .npmrc
```

## Getting Started

Requirements: Node.js >= 18.17, pnpm 9 recommended.

```bash
# Install dependencies
pnpm install

# Start both the Koa API (port 3000) and the Vite frontend (port 5173)
pnpm dev
```

> Server auto-restart is disabled by default to avoid the Windows / Node 20.9 `node --watch` FSWatcher crash. After changing backend code, restart `pnpm dev` manually.

- Frontend: <http://127.0.0.1:5173>
- API: <http://127.0.0.1:3000/api/blacklist>
- Data file: `data/blacklist.json`

Production build and local preview:

```bash
# Terminal 1: start the API
pnpm start

# Terminal 2: build and preview the frontend on port 4173
pnpm build
pnpm preview
```

> `.npmrc` uses the npmmirror registry and `node-linker=hoisted`. Adjust these settings if you use a different registry.
>
> OCR trained data is bundled with `@tesseract.js-data/eng`, so no network access is required at runtime.

### Optional Environment Variables

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `3000` | Koa server port |
| `VITE_API_BASE_URL` | `/api` | Axios base URL for the frontend |

## WC3 Lobby Screenshot Scanning

Click **Scan screenshot** in the toolbar and upload the full WC3 lobby screenshot. The app recognizes every player row and extracts only the player names, ignoring UI text such as the race and `100%`.

If one row is obscured by the UI and fails recognition, you can crop that single player row and upload it for better accuracy. The row below is recognized as `KUROSHIRO789`:

![Optional player-row screenshot](docs/player-row-example.png)

![Screenshot scanning result](docs/scan-preview.png)

Processing flow:

1. Sharp normalizes the image format and size, then uses each row's player color block to locate players.
2. Morphological erosion removes thin UI borders that can merge with a color block and hide a row (for example, the purple player).
3. Only the name area to the right of each color block is cropped, excluding race, random, and percentage fields.
4. Each player-name region is enlarged, inverted, contrast-enhanced, and sharpened.
5. Tesseract.js performs OCR locally and filters out computer players and UI noise.
6. Names are matched exactly first, then with punctuation / whitespace ignored, and finally with length-limited fuzzy matching.
7. Matches are grouped into whitelist and blacklist sections; OCR mistakes can be corrected manually and matched again.

Limitations:

- Supports full lobby screenshots and single player-row screenshots; minimum size is 300 × 40
- Supports PNG / JPG / WebP up to 8 MB
- The first OCR request needs to initialize the engine, usually taking 2–5 seconds
- Screenshots are processed in server memory and are never written to disk
- OCR and fuzzy matching are not 100% accurate; confirm results manually before taking action
- Only English OCR data is bundled. Chinese, Korean, or symbol-only names may not be recognized correctly; add or correct them manually when needed

Upload screen:

![Screenshot upload](docs/scan-upload.png)

## Data Fields

| Field | Type | Required | Generated by | Constraints |
| --- | --- | --- | --- | --- |
| `id` | string | Yes | Backend | Numeric string: max ID across all records (including soft-deleted) + 1 |
| `name` | string | Yes | Frontend | 1–50 characters after trimming |
| `listType` | string | Yes | Frontend | `black` for blacklist or `white` for whitelist; legacy records default to `black` |
| `map` | string | Yes | Frontend | 1–50 characters after trimming; entered manually |
| `reason` | string | Yes | Frontend | 1–200 characters after trimming |
| `addTime` | string | Yes | Backend | `YYYY-MM-DD HH:mm:ss` |
| `isDeleted` | boolean | Yes | Backend | Defaults to `false`; `true` means soft-deleted |

Auto-incrementing string ID example:

```json
[
  { "id": "1", "name": "Alice", "listType": "black", "isDeleted": true },
  { "id": "2", "name": "Bob", "listType": "white", "isDeleted": false }
]
```

The next record receives `id: "3"`. Even though `id: "1"` was soft-deleted, it is never reused.

## API

All endpoints return the same response shape:

```json
{
  "code": 0,
  "data": {},
  "msg": "success"
}
```

On failure, `code` is the corresponding HTTP status code (400 / 404 / 413 / 422 / 500), `data` is `null`, and `msg` describes the error.

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/blacklist?name=&map=&listType=&page=1&pageSize=10` | Filter by name, map, and list type + pagination; `listType` can be `black`, `white`, or `all` |
| POST | `/api/blacklist` | Add an entry; body: `{ name, listType, map, reason }` |
| PUT | `/api/blacklist/:id` | Update an active entry; body: `{ name, listType, map, reason }` |
| DELETE | `/api/blacklist/:id` | Soft-delete by setting `isDeleted` to `true` |
| POST | `/api/blacklist/scan` | Upload a WC3 screenshot for whitelist / blacklist OCR matching; body: `{ image: "data:image/png;base64,..." }` |
| POST | `/api/blacklist/match` | Match corrected names again; body: `{ names: ["SANGUINIUS"] }` |

### Screenshot Scanning Response

```json
{
  "code": 0,
  "data": {
    "names": [
      { "name": "LYDM1453", "confidence": 21, "source": "host" },
      { "name": "SANGUINIUS", "confidence": 39, "source": "player" }
    ],
    "matches": [
      {
        "detectedName": "SANGUINIUS",
        "recognizedText": "SANGUINIUS",
        "matchType": "exact",
        "similarity": 1,
        "record": {
          "id": "9",
          "name": "Sanguinius",
          "listType": "white",
          "map": "dalaran",
          "reason": "Trusted player, no violations",
          "addTime": "2026-11-04 22:37:37"
        }
      }
    ],
    "summary": {
      "recognizedCount": 2,
      "matchedCount": 1,
      "blackMatchedCount": 0,
      "whiteMatchedCount": 1
    }
  },
  "msg": "success"
}
```

Possible `matchType` values:

- `exact`: identical after case normalization
- `normalized`: identical after ignoring spaces and punctuation, e.g. `solt.....` and `solt`
- `fuzzy`: fuzzy match for OCR mistakes; manual review recommended

### Query Response

```json
{
  "code": 0,
  "data": {
    "list": [
      {
        "id": "2",
        "name": "Bob",
        "listType": "white",
        "map": "dalaran",
        "reason": "Trusted player",
        "addTime": "2026-10-24 15:12:41",
        "isDeleted": false
      }
    ],
    "total": 1,
    "page": 1,
    "pageSize": 10
  },
  "msg": "success"
}
```

### curl Examples

```bash
# Add a whitelist entry
curl -X POST http://127.0.0.1:3000/api/blacklist \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Alice\",\"listType\":\"white\",\"map\":\"dalaran\",\"reason\":\"trusted\"}"

# Filter by name and list type + pagination
curl "http://127.0.0.1:3000/api/blacklist?name=ali&listType=white&page=1&pageSize=10"

# Change the list type
curl -X PUT http://127.0.0.1:3000/api/blacklist/1 \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Alice\",\"listType\":\"black\",\"map\":\"dalaran\",\"reason\":\"verified violation\"}"

# Soft delete
curl -X DELETE http://127.0.0.1:3000/api/blacklist/1
```

## Soft Delete and Validation

- Deletion only sets `isDeleted` to `true`; records are never physically removed
- List queries, updates, and subsequent deletes all filter out deleted records
- Repeated deletion, updating a deleted record, or using a missing ID returns `404`
- Missing required fields, length violations, invalid pagination parameters, or invalid list types return `400`
- Creating a new record after deletion continues from the highest historical numeric ID
- Legacy records without `listType` are migrated to `black` on first read
