# Graph Report - E:/Programacion/SharkReader-main  (2026-05-07)

## Corpus Check

- 27 files · ~57,936 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary

- 169 nodes · 216 edges · 22 communities (13 shown, 9 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 7 edges (avg confidence: 0.82)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)

- [[_COMMUNITY_Achievements & Analytics|Achievements & Analytics]]
- [[_COMMUNITY_Workshop Addons|Workshop Addons]]
- [[_COMMUNITY_Data Layer & Storage|Data Layer & Storage]]
- [[_COMMUNITY_Electron Main Process|Electron Main Process]]
- [[_COMMUNITY_Build & Dev Environment|Build & Dev Environment]]
- [[_COMMUNITY_IPC & Sync Layer|IPC & Sync Layer]]
- [[_COMMUNITY_Book Library Hook|Book Library Hook]]
- [[_COMMUNITY_AI Integration|AI Integration]]
- [[_COMMUNITY_EPUB Error Boundary|EPUB Error Boundary]]
- [[_COMMUNITY_React Error Boundary|React Error Boundary]]
- [[_COMMUNITY_Workshop Panel UI|Workshop Panel UI]]
- [[_COMMUNITY_App Entry & CDN Deps|App Entry & CDN Deps]]
- [[_COMMUNITY_IndexedDB Layer|IndexedDB Layer]]
- [[_COMMUNITY_Brand Identity|Brand Identity]]
- [[_COMMUNITY_CSS & Animations|CSS & Animations]]
- [[_COMMUNITY_Vite Build Output|Vite Build Output]]
- [[_COMMUNITY_Achievements System|Achievements System]]
- [[_COMMUNITY_Library View|Library View]]
- [[_COMMUNITY_Multi-Tab System|Multi-Tab System]]
- [[_COMMUNITY_Library Search|Library Search]]
- [[_COMMUNITY_Series Feature|Series Feature]]

## God Nodes (most connected - your core abstractions)

1. `App.jsx (React Root / Global State)` - 13 edges
2. `WorkshopPanel.jsx (Addons Panel)` - 12 edges
3. `main.js (Electron Main Process)` - 8 edges
4. `AI Assistant Panel (In-Reader)` - 8 edges
5. `localStorage (Metadata Storage)` - 7 edges
6. `EpubReader.jsx (EPUB Reader Component)` - 7 edges
7. `Icons` - 6 edges
8. `EpubReaderBoundary` - 5 edges
9. `ErrorBoundary` - 5 edges
10. `safeParse()` - 5 edges

## Surprising Connections (you probably didn't know these)

- `src/main.jsx (React entry)` --calls--> `App.jsx (React Root / Global State)`  [EXTRACTED]
  index.html → Docs/architecture.md
- `WorkshopPanel.jsx (Addons Panel)` --references--> `Addon: Smart Quotes with AI (Upcoming)`  [EXTRACTED]
  Docs/architecture.md → Docs/addons-workshop.md
- `IPC Security Config (nodeIntegration:true, contextIsolation:false, webSecurity:false)` --conceptually_related_to--> `AI API Security (client-direct, no proxy, keys in localStorage)`  [INFERRED]
  Docs/ipc-electron.md → Docs/ai-integration.md
- `App()` --calls--> `safeParse()`  [EXTRACTED]
  src/App.jsx → src/db.js
- `UserMenu()` --calls--> `renderAvatar()`  [EXTRACTED]
  src/UserMenu.jsx → src/icons.jsx

## Hyperedges (group relationships)

- **SharkReader Core Technology Stack** — arch_electron, arch_vite, arch_react, arch_epubjs_lib, arch_pdfjs, arch_electron_builder [EXTRACTED 1.00]
- **SharkReader Local Storage Layer** — arch_indexeddb, arch_localstorage, data_sharkreaderdb, data_bookmeta, data_stats [EXTRACTED 1.00]
- **Reader-Context Addons** — addon_focusmode, addon_autobookmark, addon_dyslexiafont, addon_xray, addon_smarttoc [EXTRACTED 1.00]
- **Supported AI Providers** — ai_groq, ai_gemini, ai_openrouter, ai_xai [EXTRACTED 1.00]
- **Registered IPC Channels** — ipc_pick_folder, ipc_write_sync, ipc_read_sync, ipc_register_assoc, ipc_remove_assoc, ipc_open_file [EXTRACTED 1.00]
- **Gamification & Progress Tracking Features** — feat_achievements, feat_streak, feat_annual_goal, feat_reading_journal, feat_analytics [INFERRED 0.85]
- **Production Build Outputs** — build_nsis_installer, build_portable, build_dist_renderer [EXTRACTED 1.00]

## Communities (22 total, 9 thin omitted)

### Community 0 - "Achievements & Analytics"

Cohesion: 0.11
Nodes (18): ACHIEVEMENTS, checkNewAchievements(), RARITY, AnalyticsView(), DAYS_SHORT, fmtTime(), MONTHS_SHORT, App() (+10 more)

### Community 1 - "Workshop Addons"

Cohesion: 0.11
Nodes (24): Addon: Auto Bookmark, Addon: Cloud Sync (Upcoming), Addon: Dyslexia Font (OpenDyslexic), Addon: Focus Mode, Addon: Netflix View, Addon: Reading Journal (Auto-log), Addon: Daily Reading Reminders, Addon: Smart Floating TOC (+16 more)

### Community 2 - "Data Layer & Storage"

Cohesion: 0.13
Nodes (15): AnalyticsView.jsx (Statistics Dashboard), localStorage (Metadata Storage), Bookmark (CFI-based bookmark structure), BookMeta (localStorage sharkreader_meta), Highlight (Text highlight with color), JournalEntry (Reading session log), Global Stats (sharkreader_stats), VocabEntry (Vocabulary word entry) (+7 more)

### Community 3 - "Electron Main Process"

Cohesion: 0.17
Nodes (12): { app, BrowserWindow, ipcMain, dialog }, appDir, content, createWindow(), { execSync }, exePath, filePath, formats (+4 more)

### Community 4 - "Build & Dev Environment"

Cohesion: 0.18
Nodes (12): scripts/dev.cjs (Dev Launcher), Electron 41.x (Desktop Shell), electron-builder 26.x (Packager), React 19.x (UI Framework), Vite + @vitejs/plugin-react (Bundler), ELECTRON_RUN_AS_NODE (VS Code Env Var), VITE_DEV=1 (Environment Variable), npm run build (Production Build) (+4 more)

### Community 5 - "IPC & Sync Layer"

Cohesion: 0.2
Nodes (11): main.js (Electron Main Process), UserMenu.jsx (User Profile Menu), sharkreader_sync.json (Local Sync File), User Profiles & Backup, IPC: open-file Event (Main â†’ Renderer), IPC: pick-folder Channel, IPC: read-sync-file Channel, IPC: register-file-associations Channel (+3 more)

### Community 6 - "Book Library Hook"

Cohesion: 0.38
Nodes (7): useBooks(), deleteFileFromDB(), fileToBase64(), initDB(), loadFilesFromDB(), safeParse(), saveFileToDB()

### Community 7 - "AI Integration"

Cohesion: 0.22
Nodes (9): Addon: Smart Quotes with AI (Upcoming), Google Gemini (gemini-2.0-flash), Groq (llama-3.3-70b-versatile), OpenRouter (User-configurable model), AI Assistant Panel (In-Reader), AI API Security (client-direct, no proxy, keys in localStorage), xAI Grok (grok-3-mini), epub.js 0.3.93 (EPUB Reader Library) (+1 more)

### Community 10 - "Workshop Panel UI"

Cohesion: 0.4
Nodes (3): ADDONS, CATEGORIES, CONTEXT_LABELS

### Community 11 - "App Entry & CDN Deps"

Cohesion: 0.4
Nodes (5): epub.js (CDN), JSZip (CDN), src/main.jsx (React entry), SharkReader App Entry (index.html), Tailwind CSS (CDN)

### Community 12 - "IndexedDB Layer"

Cohesion: 0.4
Nodes (5): db.js (IndexedDB Helpers), IndexedDB (Binary Storage), files (IndexedDB Object Store), Legacy DB Migration (SharkReaderDB_v4 â†’ v2), SharkReaderDB (IndexedDB Database v2)

### Community 13 - "Brand Identity"

Cohesion: 0.6
Nodes (5): Blue Color Scheme, SharkReader Brand Identity, Open Book Design Element, Shark Mascot Character, SharkReader App Icon

## Knowledge Gaps

- **67 isolated node(s):** `{ app, BrowserWindow, ipcMain, dialog }`, `path`, `fs`, `{ execSync }`, `gotLock` (+62 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **9 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions

_Questions this graph is uniquely positioned to answer:_

- **Why does `App.jsx (React Root / Global State)` connect `Workshop Addons` to `Data Layer & Storage`, `App Entry & CDN Deps`, `IPC & Sync Layer`?**
  _High betweenness centrality (0.102) - this node is a cross-community bridge._
- **Why does `localStorage (Metadata Storage)` connect `Data Layer & Storage` to `Workshop Addons`, `AI Integration`?**
  _High betweenness centrality (0.077) - this node is a cross-community bridge._
- **Why does `main.js (Electron Main Process)` connect `IPC & Sync Layer` to `Build & Dev Environment`?**
  _High betweenness centrality (0.074) - this node is a cross-community bridge._
- **What connects `{ app, BrowserWindow, ipcMain, dialog }`, `path`, `fs` to the rest of the system?**
  _67 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Achievements & Analytics` be split into smaller, more focused modules?**
  _Cohesion score 0.11 - nodes in this community are weakly interconnected._
- **Should `Workshop Addons` be split into smaller, more focused modules?**
  _Cohesion score 0.11 - nodes in this community are weakly interconnected._
- **Should `Data Layer & Storage` be split into smaller, more focused modules?**
  _Cohesion score 0.13 - nodes in this community are weakly interconnected._