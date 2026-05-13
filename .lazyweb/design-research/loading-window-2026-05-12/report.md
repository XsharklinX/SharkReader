# Loading Window Research

Date: 2026-05-12
Topic: Desktop loading window for SharkReader
Method: Web research only. Lazyweb MCP was not available in this session, so this report is based on official docs and public product patterns.

## TL;DR

The best startup pattern for SharkReader is not a dramatic splash screen. It is:

1. Show the app shell immediately.
2. Use the app's real background color from the first frame.
3. Render a lightweight library skeleton instead of a blocking hero screen.
4. Reserve full-screen progress overlays for explicit long tasks like folder import or metadata repair.

This is more stable, feels faster, and matches how modern desktop products hide startup latency.

## Current State

The app currently uses a dedicated startup overlay. That overlay can become a failure point when startup logic, IndexedDB, or renderer mount timing stalls. Even if the app itself could continue, the user perceives a freeze because the overlay owns the entire screen.

## Findings

### 1. Electron startup should prefer immediate shell paint

Electron's BrowserWindow docs recommend using `backgroundColor` to avoid white flashes and note that `ready-to-show` can make the app feel later to appear for heavy pages.

Implication for SharkReader:

- Show the main window immediately.
- Match the first paint to the final app theme.
- Avoid a separate full-screen startup flow unless there is a real blocking task.

Source:

- https://www.electronjs.org/docs/latest/api/browser-window

### 2. Skeletons outperform ornamental loading screens

Modern apps that load content-heavy surfaces usually render the real layout with placeholders instead of switching to an isolated splash. This reduces perceived latency because the user sees where content will appear.

Implication for SharkReader:

- Render topbar, sidebar, and book placeholders immediately.
- Use 4-8 skeleton book cards.
- Keep status text small and technical, not promotional.

### 3. Loading states should reflect real work

The best loading screens communicate actual system state. Generic prose and decorative motion often feel fake, especially in desktop software.

Implication for SharkReader:

- Startup: use one quiet status line.
- Importing a folder: show exact counts and stages.
- Metadata repair: show a narrow progress banner or modal with real numbers.

### 4. Reduce startup risk by making the overlay non-authoritative

A startup overlay should never be the thing that decides whether the app feels alive.

Implication for SharkReader:

- The renderer should be able to hide the preload shell from multiple paths:
  - after React mount
  - after timeout fallback
  - after error fallback
- The app must remain usable even if IndexedDB is slow.

## Recommended Direction For SharkReader

### Startup

Replace the idea of a "loading window" with a "loading shell":

- Real topbar
- Real sidebar scaffold
- Skeleton book grid
- One small status line: `Cargando biblioteca`
- Thin progress bar only if there is a measurable task

### Full-screen blocking only for real long tasks

Use dedicated full overlays only for:

- large folder import
- mass metadata extraction
- database repair or migration
- export/import of user backups

### Visual language

The loading surface should feel like a serious desktop product:

- dark solid surfaces
- restrained contrast
- no floating hero card
- no glassmorphism-heavy center composition
- no decorative blobs or pseudo-marketing copy
- status text should be operational, not emotional

## Proposed Copy

Startup:

- `Cargando biblioteca`
- `Recuperando libros y estado de lectura`

Heavy task overlays:

- `Importando carpeta`
- `Extrayendo metadatos`
- `Reparando biblioteca`

## Concrete Next Step

The next iteration should remove the notion of a separate splash as the primary startup UI and turn the current preloader into a minimal app shell skeleton that disappears as soon as React mounts.

## References

- Electron BrowserWindow docs: https://www.electronjs.org/docs/latest/api/browser-window
- React lazy loading docs: https://react.dev/reference/react/lazy
