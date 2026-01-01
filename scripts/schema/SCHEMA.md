# drawKISS Database Schema

## Overview

All drawKISS tables live in a dedicated `drawkiss` PostgreSQL schema to isolate them from other projects sharing the same Supabase instance.

## Schema: `drawkiss`

### Table: `categories`

Organizes images into groups for the gallery.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | uuid | PK, default gen_random_uuid() | Primary key |
| `name` | text | NOT NULL | Category name (e.g. "Portraits") |
| `description` | text | | Optional description |
| `sort_order` | int | default 0 | Display order in gallery |
| `created_at` | timestamptz | default now() | Record creation time |

---

### Table: `images`

Stores metadata for captured raw images.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | uuid | PK, default gen_random_uuid() | Primary key |
| `category_id` | uuid | FK → categories.id, nullable | Optional category |
| `title` | text | | User-editable title |
| `date_taken` | timestamptz | | When photo was captured |
| `raw_path` | text | NOT NULL | Storage path: `raw/{id}.png` |
| `thumbnail_path` | text | | Storage path: `thumbs/{id}.png` |
| `width` | int | | Original image width in pixels |
| `height` | int | | Original image height in pixels |
| `file_size_bytes` | int | | Raw file size |
| `created_at` | timestamptz | default now() | Record creation time |

---

### Table: `layers`

Stores processed image layers for the easel stack (like Photoshop layers).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | uuid | PK, default gen_random_uuid() | Primary key |
| `image_id` | uuid | FK → images.id, NOT NULL | Parent image |
| `name` | text | | User label: "Edges - bold", "Soft blur" |
| `type` | text | NOT NULL | Layer type: 'posterize', 'edges', 'blur', 'threshold' |
| `storage_path` | text | NOT NULL | Storage path: `layers/{id}.png` |
| `param_value` | int | | Primary parameter for this type |
| `layer_order` | int | default 0 | Z-index for stacking (higher = on top) |
| `visible` | boolean | default true | Layer visibility toggle |
| `opacity` | int | default 100 | Layer opacity (0-100) |
| `created_at` | timestamptz | default now() | Record creation time |

**Layer types and their param_value meaning:**

| type | param_value meaning | range |
|------|---------------------|-------|
| posterize | levels | 2-8 |
| edges | threshold | 0-255 |
| blur | radius | 0-10 |
| threshold | cutoff | 0-255 |

---

## Supabase Storage

**Bucket:** `drawkiss`

| Setting | Value |
|---------|-------|
| public | true |
| file_size_limit | 10MB |
| allowed_mime_types | jpeg, png, webp |

| Folder | Contents |
|--------|----------|
| `raw/` | Original captured images (`{uuid}.png`) |
| `thumbs/` | Gallery thumbnails (`{uuid}.png`) |
| `layers/` | Processed layer images (`{uuid}.png`) |

**RLS Policies:** Public read/write (personal tool, no auth required)

---

## Relationships

```
categories (1) ──────< (many) images (1) ──────< (many) layers
```

- One category has many images
- One image has many layers (like Photoshop layer stack)
- Each layer has `visible` toggle, `opacity`, and `layer_order` for stacking in easel

---

## Type Generation

Generate TypeScript types for frontend:

```powershell
npx --yes supabase@2.67.1 gen types typescript \
  --db-url "postgresql://postgres:...@supabase.instantgis.cloud:5432/postgres" \
  --schema drawkiss \
  > frontend/src/types/drawkiss.ts
```

---

## Migration Files

| File | Purpose |
|------|---------|
| `001_create_schema.sql` | Create `drawkiss` schema with permissions |
| `002_categories_table.sql` | Create `drawkiss.categories` |
| `003_images_table.sql` | Create `drawkiss.images` with FK |
| `004_layers_table.sql` | Create `drawkiss.layers` with FK |
| `005_storage_bucket.sql` | Create `drawkiss` storage bucket + RLS policies |

---

## Notes

- All tables use `uuid` primary keys for Supabase compatibility
- No JSONB columns - all settings are explicit columns for type safety
- Schema is isolated from `public` to avoid conflicts with other projects

