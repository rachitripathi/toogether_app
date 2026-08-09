# Retired — moved to docs/DATABASE.md

This was a narrative changelog of the `users`→`profiles` rename and related migration work, redundant with the migration files themselves. [`docs/DATABASE.md`](docs/DATABASE.md) §1 now includes a one-line-per-file migration history table instead. The migration SQL files under `migrations/` remain the actual source of truth.

`docs/FUNCTIONALITY.md` is the companion doc for app features/flows. Update those two files going forward; don't create another migration changelog doc — a migration's own header comment is the right place for that context (see the existing convention in `migrations/*.sql`).
