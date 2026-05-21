# SharkReader

**SharkReader** is a desktop reading app for Windows focused on EPUB/PDF libraries, metadata management, reading progress, customization, achievements and local-first data ownership.

It is built with **Electron**, **React** and **Vite**, and is designed to work both as an installer and as a portable app.

![SharkReader](icon.png)

## Features

### Library Management

- Import individual books or complete folders.
- Supports `.epub`, `.pdf` and `.mobi` files.
- Duplicate detection when importing books or folders.
- Grid and list views.
- Search by title, author, series, tags and metadata.
- Sort by recent reading, title, author, progress, rating, date added and series.
- Organize books by categories.
- Track pending, reading and finished books.
- Virtualized library rendering for better performance with large collections.

### Reading Experience

- EPUB reader with tabs.
- PDF reader integration.
- Reading progress tracking.
- Bookmarks and personal notes.
- Reading statistics.
- Focus mode.
- Reading journal.
- Daily goals and yearly goals.
- Custom reading layout, theme and visual preferences.

### Metadata and Covers

- Automatic EPUB metadata extraction.
- Cover extraction and persistence.
- Manual metadata editor.
- Edit title, author, series, series index, publisher, tags, description and notes.
- Replace book covers manually.
- Restore original metadata.

### Import Flow

- Folder import session with progress feedback.
- Import phases for scanning, importing and metadata processing.
- Cancel import sessions.
- Retry failed files.
- Summary of duplicated and failed books.
- Non-blocking duplicate alerts.

### Profiles, Achievements and Stats

- Local user profile.
- Reading achievements.
- Achievements only activate when a profile exists.
- Reading streaks.
- Reading time analytics.
- Vocabulary list.
- Full reset of account and local data.

### Workshop and External Sources

- Modular Workshop system.
- Addons with state and configuration.
- Initial OPDS and Calibre catalog support.
- External sources are opt-in and user-configured.
- Safe import prompts for external catalog entries.
- Network limits, timeouts and validation for external downloads.

### Sync and Backup

- Export and import app data.
- Folder-based sync file.
- Safer sync merge for progress and metadata.
- Separate timestamps for:
  - `progressUpdatedAt`
  - `metadataUpdatedAt`
  - `updatedAt`
- Deduplication during sync by ID, path and normalized title/author.

### Security and Privacy

- Local-first app.
- Your library and reading data are stored locally.
- Electron `webSecurity` is enabled.
- Insecure content is disabled.
- EPUB scripted content is disabled.
- External downloads are validated before import.
- Local/private network catalog access requires explicit permission.

## Screenshots

Screenshots will be added soon.

## Installation

### Recommended: Installer

1. Go to the [Releases](https://github.com/XsharklinX/SharkReader/releases) page.
2. Download the latest `SharkReader Setup x.x.x.exe`.
3. Run the installer.
4. Launch SharkReader from the Start Menu or desktop shortcut.

### Portable Version

1. Go to the [Releases](https://github.com/XsharklinX/SharkReader/releases) page.
2. Download `SharkReader-Portable-x.x.x.exe`.
3. Run it directly.

The portable version does not require installation.

## Windows SmartScreen Notice

Windows may show a SmartScreen warning because the app is not currently signed with a commercial code-signing certificate.

If you downloaded SharkReader from the official GitHub releases page, you can choose:

1. `More info`
2. `Run anyway`

Commercial code signing may be added in a future release.

## Supported Formats

| Format | Library | Reader |
| --- | --- | --- |
| EPUB | Yes | Yes |
| PDF | Yes | Yes |
| MOBI | Yes | Not yet |

MOBI files can currently be imported and organized in the library, but the internal reader does not support MOBI reading yet.

## Development

### Requirements

- Windows 10 or newer
- Node.js
- pnpm

This project uses `pnpm`. Avoid mixing `npm` and `pnpm` in the same checkout.

### Install Dependencies

```powershell
pnpm install
```

### Run in Development

```powershell
pnpm dev
```

or:

```powershell
pnpm start
```

The development server runs on:

```text
http://127.0.0.1:5173
```

### Build Renderer Only

```powershell
pnpm build:renderer
```

### Build Installer and Portable App

```powershell
pnpm build
```

Generated builds are placed in:

```text
dist/
```

## Project Structure

```text
SharkReader/
├─ main.js                 # Electron main process
├─ preload.js              # Secure IPC bridge
├─ src/
│  ├─ App.jsx              # Main app shell
│  ├─ EpubReader.jsx       # EPUB reader
│  ├─ PdfReader.jsx        # PDF reader
│  ├─ db.js                # IndexedDB persistence layer
│  ├─ bookModel.js         # Book model, hydration and deduplication helpers
│  ├─ backupMerge.js       # Backup and sync merge helpers
│  └─ workshopModules.js   # Workshop addon definitions
├─ styles/
├─ public/
├─ Docs/
└─ package.json
```

## Data Storage

SharkReader stores data locally using IndexedDB.

Current storage model:

- `books`: lightweight book metadata and progress.
- `files`: imported book files.
- `settings`: user settings and profile data.
- `cache`: internal cache data.

This avoids rewriting heavy book files every time progress or metadata changes.

## Documentation

Additional technical documentation is available in the [`Docs`](Docs) folder:

- Architecture
- Data layer
- Build and deploy
- IPC Electron
- EPUB internals
- Workshop addons
- Roadmap and hardening notes

## Roadmap

Planned improvements:

- Full MOBI reader support.
- More advanced OPDS and Calibre support.
- Authentication for private catalog sources.
- Smarter collections and saved filters.
- Batch metadata editing.
- More robust multi-device sync.
- Optional auto-update.
- Commercial code signing.

## Contributing

Issues and suggestions are welcome.

If you want to contribute:

1. Fork the repository.
2. Create a feature branch.
3. Use `pnpm install`.
4. Run `pnpm dev` during development.
5. Verify with `pnpm build:renderer`.
6. Open a pull request.

## License

License information will be added before the first public stable release.

## Disclaimer

SharkReader does not distribute books. External catalog support is intended for personal libraries, public-domain sources, Calibre servers and content the user has the right to access.
