# Upload storage layout

Binary files (listing photos, part images, payment proofs, etc.) are stored in **MongoDB GridFS**, not on disk.

The folders below mirror upload categories (`UploadFolder` in the API). They exist in git via `.gitkeep` so the layout stays documented; only placeholders are committed.

- Set `MONGODB_URI` in `.env` (see `.env.example`).
- Files are served at `GET /uploads/<folder>/<filename>` (streams from GridFS).
- Re-seed listing demo images: `npm run db:seed` (requires `docs/images/`).
