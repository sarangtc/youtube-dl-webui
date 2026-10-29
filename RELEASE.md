# RELEASE LOG

---

## 0.1.0

This is the first version.

## 0.1.1

Bug fixes.

- Fix #6
- Update README.md
- Add RELEASE.md

## 0.2.0

Lot of updates here in this new version.

- Refactor entire architecture.
- Add about button.
- Can set independent youtube-dl options for each task.
- Some UI improvement.

## 0.2.1

Some bugs fix.

## 1.0.0

Major stability and UI/UX overhaul.

- Migrate from the unmaintained `youtube-dl` to `yt-dlp`.
- Fix a dispatcher bug where a failing event handler would hang every future
  web request.
- Fix mutable-default-argument bugs in the database layer that made every
  task record the same stale timestamp.
- Fix a crash in task detail lookups and several other silent failures
  (bad URLs, non-numeric config values, empty delete-with-file prefixes).
- Add a `GET /download/{tid}` endpoint to serve completed files.
- Preference updates now merge into the existing configuration instead of
  wiping out sections that weren't part of the update.
- The database's parent directory is now created automatically on first run.
- Redesign the web UI: modern styling, quality presets on the Add dialog,
  disabled/enabled toolbar buttons based on selection and task state, an
  empty-state message, and clearer error/success toasts.
- Add a right-click context menu on task rows (Pause, Resume, Download, Remove).
- The About modal now shows the installed yt-dlp version and checks PyPI for
  a newer release, with a one-click Update button that appears only when an
  update is actually available.
- Fix `dockerfile/Dockerfile`: it built from a remote GitHub zip snapshot
  instead of the local working tree, installed `youtube-dl` instead of
  `yt-dlp`, and GPG-verified `gosu` against a keyserver that's been dead
  since 2021 (build would hang/fail). Now builds from the local checkout,
  installs `gosu` and `ffmpeg` via apt, and adds a `docker-compose.yml` with
  a single bind-mounted `/data` directory that auto-seeds its own config on
  first run.
- Fix a startup crash under any restricted-permission deployment (e.g. the
  new Docker image running as a non-root user via `gosu`): `logging.json`'s
  file handlers used relative paths that resolved against whatever the
  process's starting CWD happened to be, which isn't always writable. Log
  files now always resolve against the OS temp directory.
- Restore server-configurable format presets (dropdown + custom syntax
  field, in both Add Task and Preferences) and the About modal's custom
  HTML field — both existed on a different branch that got swapped out
  mid-development and were missing from the redesigned UI.
- Video thumbnails are now proxied through the server (`GET
  /thumbnail/{tid}`) instead of being loaded directly by the browser, so the
  UI works when the browser has no direct internet access but the server
  does (e.g. an intranet-only deployment).

## Unreleased

- Playlist support: adding a YouTube playlist URL creates one task per
  video, skipping videos already in the list. At most
  `general.max_concurrent` (default 3) download at once; the rest wait as
  paused tasks and start as slots free up. `POST /task` returns
  `tids`/`added`/`skipped` for playlists.
- Multi-row selection in the task list: a checkbox column, Ctrl/Cmd+click,
  Shift+click ranges, Ctrl+A and Esc. Pause, Resume, Remove, Remove with
  file and File (download) in the toolbar and right-click menu now act on
  every selected task, using the existing `/task/batch/*` endpoints, and
  report partial failures in a toast.
