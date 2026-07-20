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

- Completed: critical legacy `localStorage` values are removed after a verified migration to IndexedDB.
- Remaining: consider moving startup-only visual preferences to a tiny settings cache if we want to remove `localStorage` entirely.

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

## Phase 7 - Stability and state coherence

### Goals

- Prevent deleted state from reappearing.
- Make reader restoration deterministic.
- Make folder-import cancellation stop late work and stale IPC updates.
- Avoid global IPC cleanup from removing listeners owned by other panels.
- Keep file-association opening reliable during renderer startup.

### Implemented

- Added normalized reader-session snapshots:
  - duplicate/stale tabs are removed
  - invalid active/right tabs are repaired
  - stale target CFIs are discarded
  - session writes are debounced and stored only in IndexedDB
- Added exact IPC subscriptions in `preload.js`; cleanup now removes only the listener created by each component.
- Added a renderer-ready handshake and pending-file queue in the main process, so file-association events cannot be lost before React subscribes.
- Folder imports now await each book metadata task before advancing progress.
- Cancellation invalidates the active session immediately, clears queued batches and cancels the main-process scan.
- Concurrent folder-import sessions are rejected instead of replacing the active session silently.
- Completed import sessions are removed from main-process memory immediately.
- Total account/data reset now:
  - blocks persistence while cleanup runs
  - clears runtime timers, imports, overlays, tabs, caches and object URLs
  - resets all relevant React state in memory
  - clears all app `localStorage`
  - verifies IndexedDB stores without depending on a reload to finish
- Legacy critical state is removed from `localStorage` only after its IndexedDB migration succeeds.
- Legacy book migration markers are no longer written when the migration itself fails.
- Tutorial hints no longer advance or disappear automatically.

### Verification

- `node --check main.js`
- `node --check preload.js`
- `pnpm test` (209/209)
- `pnpm build:renderer`

### Remaining risks

- `App.jsx` still owns too many modal booleans and reset setters. A dedicated app-session/account-state hook is the next safe extraction.
- Cancellation stops queued work, but a file already committed before the cancel click remains imported; this is intentional to avoid destructive rollback.
- Real installed-app regression testing is still required for file associations and very large folder imports.

## Phase 8 - Architectural decomposition

### Goals

- Keep `App.jsx` focused on composition and visible application behavior.
- Give startup, persistence, reset and background jobs explicit owners.
- Preserve the existing React state model without introducing a risky global-store rewrite.

### Implemented

- `App.jsx` reduced from 3,243 to 2,665 lines.
- Added `useAppHydration` to coordinate reset verification, book loading, legacy migration and state restoration.
- Added `useAppPersistence` to own IndexedDB writes, settings, user data, addons, local sync, WebDAV and close-time flush.
- Added `useAccountReset` with a guarded `try/finally` reset transaction.
- Added `useContentIndexing` for cache hydration and the background indexing queue.
- Added `useMetadataRepair` for delayed EPUB cover/metadata recovery.
- Removed seven persistence/sync timer refs from `App.jsx`.
- Pending idle writes are cancelled during total reset.
- Metadata repair stops before writing when a total reset is active.
- Corrected local-folder sync merge to consume the IPC `content` field.

### Verification

- `pnpm test` (209/209)
- `pnpm build:renderer`
- `node --check main.js`
- `node --check preload.js`

### Remaining risks

- `App.jsx` still owns many feature-level modal states and command callbacks.
- `useBookImport` and `useLibrary` should only be split by real subdomain boundaries.
- `EpubReader.jsx` and `PdfReader.jsx` remain large independent applications and need staged decomposition.

## Phase 9 - Premium reader hardening

### Goals

- Prevent EPUB/PDF state from leaking between tabs.
- Make internal search deterministic and safe.
- Persist EPUB typography with the book instead of only in browser storage.
- Make PDF annotations compatible with the unified library annotation model.

### Implemented

- Reader components are keyed by `book.id`, so switching between two EPUBs or PDFs cannot reuse stale search, typography, TTS or panel state.
- Added `useReaderSearchTask`:
  - every search gets an identity
  - old searches cannot overwrite newer results
  - closing/unmounting invalidates pending work
- EPUB search now unloads every spine item in `finally` and enforces the 50-result limit exactly.
- PDF search now checks cancellation between pages and ignores stale results.
- `Ctrl+F` opens SharkReader search in PDF, EPUB and inside the EPUB iframe.
- Reader keyboard navigation ignores inputs, textareas, selects and editable content.
- Added `ReaderSearchExcerpt` to highlight matches with React nodes instead of `dangerouslySetInnerHTML`.
- EPUB reader preferences now persist in the book model:
  - font family and size
  - line height and margins
  - paragraph/letter spacing
  - justification, indentation and hyphenation
  - custom colors
  - column width
- Existing `sr_font_<bookId>` preferences migrate automatically when the book is opened.
- Reader preferences participate in IndexedDB persistence, backup/import and timestamp-aware sync merge.
- Structured PDF highlights now expose real text, color and page in the unified annotation panel/export.
- Opening a PDF annotation from the library now targets its page.
- Annotation deletion now uses the exact raw payload for both EPUB and PDF.

### Verification

- `pnpm test` (217/217)
- `pnpm build:renderer`
- `git diff --check`

### Remaining risks

- EPUB search still scans spine resources on demand; very large books may benefit from the existing background content index in a later phase.
- PDF search is cancellation-safe but still performs page text extraction on the renderer thread.
- EPUB and PDF topbars still duplicate substantial UI and should be unified only after interaction regression tests.

## Phase 10 - Large-library performance

### Goals

- Keep library interactions responsive while unrelated application state changes.
- Prevent background content indexing from competing with user input.
- Reduce unnecessary browser resources retained for every imported book.
- Capture real renderer stalls in exported diagnostics.

### Implemented

- Stabilized file/folder picker and drag/drop callbacks so `LibraryView` memoization is effective.
- Removed unused drag state props from `LibraryView`; the global category drop tray keeps its existing behavior.
- Added memoized grid wrappers and list rows so unchanged books do not rerender when another visible item changes.
- Series grouping is memoized and off-screen series groups use `content-visibility`.
- Manual collection counts now use precomputed membership-set sizes instead of scanning every collection for every book.
- Content indexing now queues four books at a time and waits for browser idle windows before and between expensive extraction jobs.
- Removed per-book `ObjectURL` creation because EPUB/PDF readers consume the stored `File` directly.
- Diagnostics now capture renderer long tasks over 180 ms for installed-app investigation.

### Verification

- `pnpm test` (218/218)
- `pnpm build:renderer`

### Remaining risks

- PDF text extraction and EPUB parsing still execute in the renderer; idle scheduling reduces contention but a dedicated worker remains the long-term solution.
- Series view avoids off-screen layout/paint but is not geometrically virtualized because group heights are variable.
- Real measurements with 300, 1,000 and 3,000-book libraries are still needed to tune thresholds and overscan.

## Phase 11 - Backup, sync and data integrity

### Goals

- Reject malformed or unrelated backups before changing application state.
- Make sync merges idempotent and allow explicit removals to propagate.
- Prevent local bulk deletions from reappearing after restart.
- Keep local sync recoverable if a cloud-folder write is interrupted.

### Implemented

- Backup schema advanced to v3.
- Added `backupValidation` as the trust boundary for JSON/ZIP restore and sync input.
- Future schema versions and unrelated JSON payloads are rejected.
- Invalid book records are skipped with a user-visible warning.
- ZIP manifests are validated before any embedded EPUB/PDF is read.
- Full ZIP restore processes files in batches of eight and waits for metadata completion.
- Restore writes are awaited and reported instead of continuing after partial persistence failures.
- Merge timestamps no longer advance on every merge, making repeated sync idempotent.
- Favorite, finished, category, custom cover, reader preferences and other nullable fields follow their newest field timestamp, including `false` and `null`.
- Added `annotationsUpdatedAt`; deleted annotations no longer revive through permanent array union.
- Added persistent book deletion tombstones:
  - local single/bulk/duplicate deletion records a deletion timestamp
  - startup filters and purges stale IndexedDB records
  - backup/sync merge rejects books older than their tombstone
  - a deliberately newer reimport can supersede an older tombstone
- Bulk deletion paths now delete both the `books` and `files` IndexedDB records.
- Local sync uses temporary writes plus a `.bak` recovery copy.
- Sync reads automatically fall back to a valid `.bak` when the primary JSON is missing or corrupt.
- Local and WebDAV write failures are preserved in diagnostics instead of being silently ignored.

### Verification

- `pnpm test` (227/227)
- `pnpm build:renderer`
- `node --check main.js`
- `node --check preload.js`
- `git diff --check`

### Remaining risks

- Category and collection deletion still use conservative union merge and do not yet have their own tombstones.
- WebDAV atomicity depends on the remote server implementation.
- A full restore validates and persists safely, but IndexedDB has no single transaction spanning books, settings and files stores.
