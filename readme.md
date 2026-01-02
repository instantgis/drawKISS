# drawKISS

A reference tool for traditional B&W artists. Take a photo, apply filters (threshold, posterize, edges, blur), and display with a grid overlay for accurate sketching.

## Quick Start

```bash
cd frontend
npm install
npm start
# Opens http://localhost:4200
```

## Features

- **Capture**: Take photo on phone, apply processing filters
- **Filters**: Threshold, posterize, edges, blur - all client-side
- **Layers**: Save multiple processed versions per image
- **Storage**: Images + layers saved to Supabase (VPS)

## Tech Stack

- **Frontend**: Angular 21 (Zoneless + Signals)
- **Database**: Supabase Postgres (`drawkiss` schema)
- **Storage**: Supabase Storage (`drawkiss` bucket)
- **Deploy**: Netlify

## Database Commands

⚠️ **DO NOT use psql** - use pgKISS scripts instead:

```powershell
# Always combine in ONE command with semicolon
. .\scripts\db\use-vps-supabase.ps1; npm run db:sql:json -- "SELECT * FROM drawkiss.images LIMIT 5"
```

## TypeScript Types

**NEVER edit `frontend/src/types/drawkiss.ts` directly** - it is auto-generated from the database schema:

```powershell
npm run types:generate
```

Run this after any schema changes to keep types in sync with the database.


## Project Structure

```
drawKISS/
├── frontend/           # Angular 21 app
│   └── src/
│       ├── app/
│       │   ├── capture/    # Photo capture + filters
│       │   ├── easel/      # Grid overlay view (WIP)
│       │   └── *.service.ts
│       └── types/
│           └── drawkiss.ts # Generated DB types
├── scripts/
│   └── db/            # Database helper scripts
└── docs/
    └── BUILD_PLAN.md  # Full spec + status
```

## Documentation

See [docs/BUILD_PLAN.md](docs/BUILD_PLAN.md) for full spec, database schema, and current status.