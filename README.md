# Image API

A small REST API for uploading, processing and serving images.

Built with **NestJS** (TypeScript), **PostgreSQL** (via TypeORM), **sharp** for image
processing and a pluggable **filesystem** storage layer. Ships with Docker Compose,
Swagger/OpenAPI v3 docs, and unit + e2e tests.

---

## Features

- `POST /images` — upload an image (multipart), set a title, resize/crop to a target
  size, optimize, store the file and persist a DB record.
- `GET /images` — list images with `id`, `url`, `title`, `width`, `height`; supports a
  case-insensitive *title contains* filter and pagination.
- `GET /images/:id` — fetch a single image object.
- `GET /images/:id/file` — download the processed binary (used by the `url` field).
- Storage is behind a `StorageService` interface, so swapping the filesystem driver for
  S3/Azure/GCS is a one-file change.

## Tech choices

| Concern          | Choice                                                        |
|------------------|---------------------------------------------------------------|
| Runtime          | Node.js 22 LTS                                                 |
| Framework        | NestJS 10                                                      |
| Database         | PostgreSQL 16 (TypeORM)                                        |
| Storage          | Local filesystem (abstracted via `StorageService`)            |
| Image processing | sharp (resize with `cover` fit + format-specific optimization)|
| Docs             | Swagger / OpenAPI v3 at `/docs`                               |
| Tests            | Jest (unit) + Supertest (e2e, in-memory SQLite)               |
| Dev env          | Docker Compose (api + postgres)                               |

---

## Quick start (Docker Compose)

The fastest path — no local Node or Postgres needed:

```bash
docker compose up --build
```

Then open:

- API:     http://localhost:3000
- Swagger: http://localhost:3000/docs
- OpenAPI JSON: http://localhost:3000/docs-json

The database schema is created automatically on boot (`DB_SYNCHRONIZE=true`).
Uploaded files persist in the `uploads_data` Docker volume; the DB in `db_data`.

## Local development (without Docker for the app)

Requires Node.js 22 LTS and a reachable PostgreSQL instance.

```bash
# 1. Install deps
npm install

# 2. Configure env
cp .env.example .env        # edit DB_* if needed

# 3. (Optional) start only Postgres via compose
#    By default the compose db does NOT expose a host port. To connect to it
#    from your host (e.g. for `npm run start:dev`), uncomment the `ports:`
#    line under the `db` service in docker-compose.yml first.
docker compose up -d db

# 4. Run in watch mode
npm run start:dev
```

---

## Configuration

All configuration is via environment variables (see `.env.example`):

| Variable              | Default                  | Description                                  |
|-----------------------|--------------------------|----------------------------------------------|
| `PORT`                | `3000`                   | HTTP port                                    |
| `APP_BASE_URL`        | `http://localhost:3000`  | Base URL used to build `url` in responses    |
| `DB_HOST`             | `localhost`              | PostgreSQL host                              |
| `DB_PORT`             | `5432`                   | PostgreSQL port                              |
| `DB_USERNAME`         | `postgres`               | PostgreSQL user                              |
| `DB_PASSWORD`         | `postgres`               | PostgreSQL password                          |
| `DB_NAME`             | `images`                 | PostgreSQL database                          |
| `DB_SYNCHRONIZE`      | `true`                   | Auto-create schema (use migrations in prod)  |
| `STORAGE_DRIVER`      | `filesystem`             | Storage driver                               |
| `STORAGE_DIR`         | `./uploads`              | Filesystem storage directory                 |
| `MAX_FILE_SIZE_BYTES` | `15728640` (15 MB)       | Max upload size                              |

---

## API

Interactive docs (with a "try it out" form for uploads) live at **`/docs`**.

### `POST /images`

`multipart/form-data`:

| Field    | Type    | Required | Notes                                              |
|----------|---------|----------|----------------------------------------------------|
| `file`   | binary  | yes      | jpeg, png, webp, gif, tiff, avif, ...              |
| `title`  | string  | yes      | max 255 chars                                      |
| `width`  | integer | no       | 1–10000                                            |
| `height` | integer | no       | 1–10000                                            |

Resize behaviour: if both `width` and `height` are given the image is scaled and
**cropped (cover, centered)** to that exact box; if only one is given the other is
derived from the aspect ratio; if neither is given the original dimensions are kept.
The output is re-encoded with format-appropriate optimization and EXIF orientation is
baked in.

```bash
curl -X POST http://localhost:3000/images \
  -F "title=Sunset over the bay" \
  -F "width=800" \
  -F "height=600" \
  -F "file=@/path/to/photo.jpg"
```

Response `201`:

```json
{
  "id": "b3b1e6e2-1f2a-4c8e-9f3d-2a1b6c7d8e9f",
  "title": "Sunset over the bay",
  "url": "http://localhost:3000/images/b3b1e6e2-1f2a-4c8e-9f3d-2a1b6c7d8e9f/file",
  "width": 800,
  "height": 600
}
```

### `GET /images`

Query params: `title` (contains, case-insensitive), `page` (default `1`),
`limit` (default `20`, max `100`).

```bash
curl "http://localhost:3000/images?title=sunset&page=1&limit=20"
```

```json
{
  "data": [
    {
      "id": "b3b1e6e2-...",
      "title": "Sunset over the bay",
      "url": "http://localhost:3000/images/b3b1e6e2-.../file",
      "width": 800,
      "height": 600
    }
  ],
  "meta": { "total": 1, "page": 1, "limit": 20, "totalPages": 1 }
}
```

### `GET /images/:id`

```bash
curl http://localhost:3000/images/b3b1e6e2-1f2a-4c8e-9f3d-2a1b6c7d8e9f
```

### `GET /images/:id/file`

Streams the raw processed image bytes with the correct `Content-Type`. This is the URL
returned in the `url` field.

---

## Tests

```bash
npm test          # unit tests
npm run test:e2e  # e2e tests (boots the app against in-memory SQLite)
npm run test:cov  # coverage
```

- **Unit:** `ImageProcessorService` (sharp resize/crop behaviour, invalid input) and
  `ImagesService` (create + file rollback, pagination meta, not-found).
- **E2E:** full HTTP flow for every endpoint — upload + resize, validation (non-image
  rejected, missing title rejected), pagination, title filtering, single fetch, file
  download, and 404 handling. Runs against in-memory SQLite so no external services are
  required.

## Project structure

```
src/
  config/                 # typed configuration loader
  storage/                # StorageService interface + filesystem driver (+ module)
  images/
    dto/                  # request/response DTOs with validation + Swagger metadata
    entities/image.entity.ts
    image-processor.service.ts   # sharp wrapper
    images.service.ts            # business logic
    images.controller.ts         # routes
    images.module.ts
  app.module.ts
  main.ts                 # bootstrap + global pipes + Swagger
test/
  images.e2e-spec.ts
```

---

## Production notes / trade-offs

These were intentionally kept simple for the scope of this task:

- **Schema:** `DB_SYNCHRONIZE=true` auto-syncs the schema. In production use TypeORM
  migrations instead.
- **Storage:** files are served through the Node process (`/images/:id/file`). With an
  object store (S3/GCS) you'd typically serve via the CDN/bucket URL or pre-signed URLs;
  the `StorageService` interface is the single seam to make that change.
- **GIF** inputs are normalized to PNG (animation is dropped) to keep processing simple.
- **Auth** is out of scope and not implemented.
