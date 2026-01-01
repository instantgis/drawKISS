# drawKISS - Build Plan & Status

**DEADLINE**: January 3, 2026 | **USER**: Single artist in Mauritius | **GOAL**: 2-3 sketches/day

---

## 🎉 CURRENT STATUS: MVP COMPLETE (Jan 1, 2026)

### ✅ What's Working
- **Capture Page** (`/capture`): Take photo, preview filters, save to Supabase
- **Image Processing**: Client-side filters (threshold, posterize, edges, blur)
- **Layer System**: Save multiple processed versions of each image
- **Database**: Images + layers persisted to VPS Supabase (`drawkiss` schema)
- **Storage**: Raw images + layer PNGs stored in `drawkiss` bucket

### 🔧 Remaining for V1
- [ ] Easel page (`/easel`) - Full-screen view with SVG grid overlay
- [ ] Grid controls (rows/cols sliders)
- [ ] Click-to-focus grid cell
- [ ] Auth guard (single user)

---

## TECH STACK
- **Frontend**: Angular 21 (Zoneless + Signals) → **Netlify**
- **Backend**: Netlify Functions (Python/FastAPI) - *deferred, using client-side processing*
- **Database**: Supabase Postgres (VPS self-hosted) - `drawkiss` schema
- **Storage**: Supabase Storage (VPS) - `drawkiss` bucket
- **Tools**: pgkiss v1.2.1 for DB queries

---

## DATABASE SCHEMA (`drawkiss`)

### `images` table
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| title | text | User-provided title |
| raw_path | text | Storage path to original image |
| thumbnail_path | text | Storage path to thumbnail |
| width, height | int | Image dimensions |
| file_size_bytes | int | File size |
| category_id | uuid | FK to categories |
| date_taken | timestamp | When photo was taken |
| created_at | timestamp | Record creation time |

### `layers` table
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| image_id | uuid | FK to images |
| type | text | Filter type (threshold, posterize, edges, blur) |
| param_value | int | Filter parameter value |
| storage_path | text | Storage path to layer PNG |
| layer_order | int | Stack order |
| opacity | float | Layer opacity (0-1) |
| visible | boolean | Layer visibility |
| name | text | Optional layer name |
| created_at | timestamp | Record creation time |

### `categories` table
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| name | text | Category name |
| description | text | Optional description |
| sort_order | int | Display order |
| created_at | timestamp | Record creation time |

---

## STORAGE STRUCTURE (`drawkiss` bucket)
```
drawkiss/
├── raw/           # Original captured images
│   └── {image_id}.png
├── thumbs/        # Thumbnails (future)
│   └── {image_id}.png
└── layers/        # Processed layer images
    └── {layer_id}.png
```

---

## IMAGE PROCESSING (Client-Side)

### Available Filters
| Filter | Parameter | Description |
|--------|-----------|-------------|
| `threshold` | cutoff (0-255) | B&W threshold - values below = black |
| `posterize` | levels (2-8) | Reduce to N gray levels for pencil mapping |
| `edges` | threshold (0-255) | Sobel edge detection |
| `blur` | radius (1-20) | Gaussian blur for noise reduction |

### Pencil Mapping (4 levels)
- Level 0: Paper white (no pencil)
- Level 1: 5H (light)
- Level 2: 2B (mid)
- Level 3: 8B/14B (dark/black)

---

## KEY FILES

### Frontend
- `frontend/src/app/capture/` - Capture component
- `frontend/src/app/image-processor.service.ts` - Filter algorithms
- `frontend/src/app/supabase.service.ts` - DB + storage operations
- `frontend/src/types/drawkiss.ts` - Generated TypeScript types

### Scripts
- `scripts/db/use-vps-supabase.ps1` - Set DATABASE_URL for VPS
- `scripts/schema/` - Database schema SQL

---

## DEVELOPMENT

### Run locally
```bash
cd frontend
npm start
# Opens http://localhost:4200
```

### Query database
```powershell
# Always combine in ONE command
. .\scripts\db\use-vps-supabase.ps1; npm run db:sql:json -- "SELECT * FROM drawkiss.images"
```

### Regenerate types
```bash
npm run db:types
```

---

## SUCCESS CRITERIA (Jan 3)
1. ✅ Take photo on phone
2. ✅ See processed B&W + edges in <5s
3. ✅ Save layers to database
4. ⬜ View on Mac with grid
5. ⬜ Click grid cell to focus
6. ⬜ Start sketching with correct proportions

---

## KEY NOTES
- User is color blind → B&W is intentional
- Mauritius subjects → unique niche
- 5H to 14B pencils → posterization critical
- Single user first → no multi-tenant complexity
- **Rule**: If tech takes >4h, it's a distraction

