# Toogether — repo notes

## Documentation convention

This project maintains exactly **two** living docs, both under `docs/`:

- [`docs/DATABASE.md`](docs/DATABASE.md) — schema, RLS policies, functions, migrations history, Cloudinary/storage, env config.
- [`docs/FUNCTIONALITY.md`](docs/FUNCTIONALITY.md) — screens, feature flows, what's real vs. mock/local-only, dev tools, product concept.

**Whenever you change the schema (new migration) or app behavior (new/changed screen, flow, gate), update the relevant doc in the same change.** Don't create a new topic-specific doc file (no more `CREDIT_SYSTEM.md`, `SETUP_GUIDE.md`, etc.) — fold new content into one of these two instead. A pile of older, now-retired docs at the repo root and in `docs/` were consolidated into these two because they went stale independently and started contradicting each other and the code; keep that from happening again.
