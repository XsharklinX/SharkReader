# SharkReader Roadmap Hardening

Branch: `codex/roadmap-hardening`

## Scope

This branch is focused on improving stability and low-risk UX/performance without changing the core reading/import flows that are already working.

## Phase 1 - Reset, account data, startup shell

### Goals

- Make account/data deletion deterministic.
- Stop profile/account state from reappearing after reset.
- Remove destructive account reset from the profile popover.
- Reduce startup flicker and preloader ghosting.
- Remove lazy-loading from tiny shell UI panels that caused visible loading artifacts.

### Implemented

- Moved `Eliminar la cuenta y los datos` into Settings.
- Removed account deletion from the profile dropdown.
- Added `deleteAccountAndData()` in `src/App.jsx`:
  - blocks persistence while resetting
  - clears timers and in-memory state
  - clears local storage keys
  - clears active folder-import state and queues
  - clears dedup refs and reader refs
  - resets tabs, profile, books, stats, achievements, addons, vocabulary and journal
- Changed `resetAllAppData()` in `src/db.js`:
  - clears stores in the main IndexedDB first
  - still removes legacy DB and locations cache DB
  - avoids relying only on `deleteDatabase()` for the active DB
- Added post-reset startup verification:
  - `getAppDataCounts()` checks critical stores after reset reload
  - any residual data triggers a second store cleanup before the library hydrates
- Consolidated critical app state into IndexedDB:
  - profile
  - stats
  - achievements
  - addons
  - vocabulary
  - journal
  - AI provider/key and sync folder
  - goals and UI settings
- Reduced `localStorage` to startup-safe visual preferences and legacy migration fallback.
- Added legacy fallback migration from old `localStorage` keys into IndexedDB without using those keys as the live source of truth.
- Simplified startup shell in `index.html` and `styles/main.css`.
- Preloader now removes itself from the DOM after hiding.
- `SettingsPanel` and `UserMenu` are no longer lazy-loaded.
- Cleaned transient Settings timers so status messages do not update after unmount.

### Verification

- `node -c main.js`
- `node -c preload.js`
- `pnpm build:renderer`

### Risk notes

- The settings and user menu files still contain legacy mojibake in labels. This is cosmetic, not a functional blocker.
- Some minimal visual preferences still use `localStorage` so the first paint can use the right theme before IndexedDB resolves.

## Phase 2 - Import/session stability already on branch

### Goals

- Keep folder import non-blocking.
- Make duplicate detection session-safe.
- Ensure skipped duplicates do not corrupt import progress.
- Improve library performance without changing reader/import behavior.

### Implemented

- Duplicate warnings are toast-based, not blocking alerts.
- Duplicate detection normalizes file stems like `book` vs `book (1)`.
- Duplicate detection also uses native metadata when available (`title + author`).
- Folder import now tracks skipped duplicates as processed items.
- Folder import overlay summary now distinguishes:
  - added books
  - skipped duplicates
- Added library virtualization for large collections:
  - grid virtualization uses visible rows + overscan
  - list virtualization uses visible items + overscan
  - small libraries keep the previous normal render path
- Added a cached search index per book object to reduce repeated lowercase/string work while searching.
- Added memoized library-derived stats for sidebar counts, authors and category counts.
- Improved `ObjectURL` lifecycle:
  - stale URLs are revoked when books disappear from state
  - all tracked URLs are revoked on unmount/reset

### Verification

- `node -c main.js`
- `node -c preload.js`
- `pnpm build:renderer`

### Risk notes

- Duplicate detection is stronger than before, but still heuristic-based for malformed metadata or renamed files with mismatched internals.
- Reader state has not been extracted into a separate controller/store yet. That is a larger architectural change and should be done after the low-risk render path is stable.
- Search results view is not virtualized yet; the main library grid/list path is the priority and has the highest impact.

## Phase 2b - Low-risk rendering/perceived performance already on branch

### Goals

- Reduce visible loading artifacts in shell UI.
- Avoid lazy-loading overhead for very small UI surfaces.

### Implemented

- Removed lazy-loading from `SettingsPanel` and `UserMenu`.
- Kept lazy-loading for the heavy panels and readers:
  - `EpubReader`
  - `PdfReader`
  - `AnalyticsView`
  - `WorkshopPanel`

### Verification

- Covered by `pnpm build:renderer`

### Risk notes

- Main renderer bundle is still large.
- Virtualization is now active for the main library grid/list path; search results still use the simpler render path.

## Phase 3 - Product quality hardening

### Goals

- Make mass import feel production-ready.
- Improve metadata editing without changing reader behavior.
- Persist library organization choices.
- Make Windows file associations coherent for public builds.

### Implemented

- Folder import now tracks failed files separately from duplicate skips.
- Completed imports with failures stay visible instead of auto-closing immediately.
- Import overlay now shows an omitted count and a short failed-files list.
- Added `Reintentar fallidos` from the import overlay for paths that can be read again.
- Import accepts `.epub`, `.pdf` and `.mobi` consistently in:
  - native file picker
  - HTML fallback input
  - folder scan
  - renderer validation
- Metadata editor improvements:
  - clearer title/author fields
  - replace cover from local image file
  - restore original title/author/cover
  - save writes immediately to IndexedDB
- Library management improvements:
  - added sort by series/series index
  - persisted current filter and sort mode through IndexedDB
- Windows associations hardened:
  - `.epub`, `.pdf` and `.mobi` share the SharkReader ProgId pattern
  - registered content types per extension
  - packaged app open command no longer passes the app directory as an extra argument
  - removal handles missing keys without failing the whole cleanup

### Verification

- `node -c main.js`
- `node -c preload.js`
- `pnpm build:renderer`

### Risk notes

- Batch metadata editing is not implemented yet. It needs multi-select state and bulk operation UI, so it should be its own focused phase.
- MOBI import stores and lists files, but metadata extraction and internal reading are still EPUB/PDF-only. MOBI opening now shows a non-blocking warning instead of routing it into the PDF reader.
- Search results view remains non-virtualized; normal library grid/list is the optimized path.

## Phase 4 - Safe integrations and Workshop modules

### Goals

- Let Workshop grow without ad-hoc addon definitions inside UI components.
- Prepare safe external sources without distributing copyrighted content.
- Make sync/export payloads more explicit and easier to merge later.

### Implemented

- Added `src/workshopModules.js` as the registry for Workshop modules:
  - addon metadata
  - default enabled state
  - default config
  - toggle validation
  - migration/normalization helpers
- Rebuilt `WorkshopPanel` to consume the registry instead of owning addon definitions.
- Added persisted addon config under IndexedDB:
  - `addonConfig`
  - combined `workshop` payload
- Added persisted external source config:
  - OPDS
  - Calibre server
  - personal cloud URL
  - public-domain sources
- Added default safe source templates:
  - Standard Ebooks OPDS
  - local Calibre OPDS endpoint
- Added a real Workshop module for `externalSources`.
- Reminder addon now reads its threshold from addon config instead of hardcoding one hour.
- Export and sync payloads now use `schemaVersion`, `app`, `exportedAt`, and `workshop` sections.
- Sync folder writes now use the same portable backup schema as manual export.
- Sync writes are separated into their own debounce instead of piggybacking on the books persistence timer.

### Verification

- `node -c main.js`
- `node -c preload.js`
- `pnpm build:renderer`

### Risk notes

- External sources now support OPDS/Calibre browsing and explicit import. Remaining work is authentication, pagination polish and broader feed compatibility.
- Real conflict resolution now has `updatedAt` and conservative sync merging. Next step is separate `progressUpdatedAt` and field-level merge rules for multi-device use.
- Workshop config migration is v1; future addon data migrations should increment `WORKSHOP_SCHEMA_VERSION`.

## Phase 5 - External catalog browsing and safe import

### Goals

- Make external sources useful without distributing books inside the app.
- Keep all network access bounded and explicit.
- Let users preview OPDS/Calibre entries before importing.

### Implemented

- Added main-process IPC for external sources:
  - `fetch-external-catalog`
  - `download-external-book`
- Network access is restricted to `http` and `https`.
- Public sources are protected against SSRF by blocking localhost/private-network targets unless the source explicitly allows private network access.
- Calibre/local sources can opt into private-network access without opening that permission for all OPDS feeds.
- Added catalog timeout and response-size limits:
  - catalogs: 2 MB
  - book downloads: 250 MB
  - catalog timeout: 15 seconds
  - book timeout: 30 seconds
- Added basic redirect handling with a maximum redirect depth.
- Book downloads validate the actual file header before import. Unknown/non-book responses are rejected instead of being stored as broken books.
- Added OPDS/Atom parser for:
  - catalog title
  - entries
  - authors
  - summaries
  - acquisition/download links
  - cover/thumbnail links
  - navigation/subsection links
- Workshop external sources can now:
  - explore enabled sources
  - navigate catalog subsections
  - preview up to 30 book entries
  - import a selected entry explicitly
- Import flow reuses the existing `processFiles` path, so duplicate detection, metadata extraction and IndexedDB persistence remain centralized.
- Import confirmation warns users to import only owned, public-domain, or authorized content.
- Folder sync now merges the existing `sharkreader_sync.json` before writing, instead of blindly replacing it.
- Books now carry `updatedAt`, `progressUpdatedAt` and `metadataUpdatedAt`, so sync/import can compare progress separately from metadata.
- Electron `webSecurity` is enabled again and insecure content is disabled.
- EPUB scripted content is disabled in the reader; normal text/image EPUBs continue to work, but embedded book scripts no longer execute.

### Verification

- `node -c main.js`
- `node -c preload.js`
- `pnpm build:renderer`

### Risk notes

- OPDS parsing is intentionally conservative and dependency-free. It supports common Atom/OPDS feeds, but unusual feeds may need parser hardening later.
- Authentication for private Calibre/cloud sources is not implemented yet.
- Sync merge is safer than the previous overwrite, but still not a full multi-device CRDT. It merges progress fields by `progressUpdatedAt`, metadata fields by `metadataUpdatedAt`, merges categories/stats conservatively, and deduplicates books by id plus normalized path/title identity.

## Phase 6 - App.jsx decomposition and field-level sync

### Goals

- Reduce `App.jsx` size without changing visible behavior.
- Move pure library/persistence logic into isolated modules.
- Make sync conflicts less destructive by separating reading progress from editable metadata.

### Implemented

- Added `src/bookModel.js` for:
  - book hydration/persistence mapping
  - duplicate keys
  - search index cache
  - list update helper
  - import metadata application
- Added `src/backupMerge.js` for:
  - portable backup creation
  - backup/sync merge
  - field-level book merge
  - conservative stats/category merge
- `App.jsx` now imports those helpers instead of owning all pure book/sync logic inline.
- Metadata edits, cover replacement, category changes, favorites and bookmarks now update `metadataUpdatedAt`.
- Open/read/progress/finish actions now update `progressUpdatedAt`.

### Verification

- `node -c main.js`
- `node -c preload.js`
- `pnpm build:renderer`

### Risk notes

- This is still an incremental decomposition. `App.jsx` remains large because UI state, import session state and reader orchestration are still together.
- Next safe extraction target is import orchestration into a `useFolderImport`/`useBookImport` hook.

## Next phases

### Phase 4 - Library rendering performance

Recommended next:

- Virtualize search results if real libraries produce very large result sets.
- Measure large-library scroll in development with 500+ synthetic books.

### Phase 5 - Persistence cleanup follow-up

- Add an explicit one-time cleanup for old legacy `localStorage` keys after successful migration.
- Consider moving startup visual preferences to a tiny preload-safe settings cache if we want to remove `localStorage` entirely.

### Phase 6 - Release hardening

- Code signing setup preparation.
- Import/report diagnostics for real users.
- Regression checklist for:
  - file import
  - folder import
  - duplicate handling
  - reset
  - file association opening

## Open risks

- `src/App.jsx` is still too large and centralizes too much app state.
- The app still mixes shell UI, library logic, account state, import state and reader orchestration in one component.
- Several files still contain encoding issues in user-facing strings.
