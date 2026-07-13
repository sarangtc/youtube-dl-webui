# yt-dlp-webui

**Current version: 1.0.0**

A modern, lightweight web interface for yt-dlp powered by Flask and Vue.js.

[yt-dlp][1] is a powerful command-line based tool that downloads videos
from YouTube.com and many other sites. However, it lacks a manager to control
and schedule downloading tasks separately. For users who prefer to deploy
downloading tasks on a home server, the ability to manage tasks remotely is essential.

This project provides a clean, modern web interface that makes yt-dlp accessible
to users who prefer graphical interfaces over command-line tools.

**Issues and contributions are welcomed!**

## Features

### Core Functionality
- **Task Management**: Add, remove, pause, and resume download tasks
- **Real-time Progress**: Live progress tracking with download speed and ETA
- **Multiple Format Support**: Pre-configured format presets and custom format options
- **File Download**: Direct download of completed files through the web interface

### User Interface
- **Modern Design**: Clean, responsive interface with Vue.js
- **Right-click Context Menu**: Right-click any task for quick access to Pause, Resume,
  Download, and Remove without selecting it first
- **Task Filtering**: Filter tasks by status (All, Downloading, Finished, Paused, Invalid)
- **Detailed Information**: View comprehensive task details including thumbnails, descriptions, and logs.
  Thumbnails are proxied through the server rather than loaded directly by the browser (see
  [Network Requirements](#network-requirements))
- **Real-time Updates**: Automatic refresh of task status and progress every 3 seconds
- **Toast Notifications**: Clear success/error feedback for every action

### Configuration
- **Web-based Settings**: Configure download paths, formats, and other options through the UI
- **Custom HTML Support**: Add custom HTML content to the About modal
- **Format Presets**: A dropdown of format options (best, 1080p, 720p, 480p, audio-only,
  or a custom yt-dlp format selector) in both the Add Task and Preferences dialogs.
  The preset list itself is server-configurable via `format_options` in your config
  file — sensible defaults ship out of the box
- **Persistent Settings**: All preferences are saved and restored between sessions;
  saving a partial change (e.g. from the Preferences dialog) no longer resets the
  sections you didn't touch

### Advanced Features
- **Proxy Support**: Configure proxy settings for downloads
- **Rate Limiting**: Control download speed to avoid overwhelming your connection
- **Custom Output Templates**: Define custom filename patterns
- **Logging**: Comprehensive per-task logging with configurable log size
- **Database Storage**: SQLite database for persistent task storage
- **Resilient Core**: A crash in one request handler no longer hangs the whole server;
  a failed or unreachable URL is reported back as an "Invalid" task instead of
  silently killing the worker
- **yt-dlp Version Check & Update**: The About modal shows the installed yt-dlp
  version and checks PyPI for a newer release, with a one-click Update button
  that only appears when an update is actually available (see
  [Updating yt-dlp](#updating-yt-dlp) for details and caveats)

## Screenshot

![screenshot1](screen_shot/1.gif)

## Network Requirements

**The server needs internet access; the browser using the UI does not.**
Everything the browser loads — the page itself, CSS/JS/fonts, and video
thumbnails — is served from this app's own origin. The only things fetched
directly by the browser are the GitHub/yt-dlp/license links in the About
modal, and only if you click them; nothing auto-loads from them.

Specifically:
- **Video thumbnails** are fetched by the *server* (`GET /thumbnail/{tid}`)
  and streamed to the browser — the browser never requests the original
  CDN URL (e.g. `i.ytimg.com`) directly. This matters if your browser is on
  an intranet with no direct path to the public internet, while the server
  itself does have one.
- **yt-dlp version checks** (the About modal's "up to date" / "update
  available" indicator) also run entirely server-side — see
  [Updating yt-dlp](#updating-yt-dlp).
- **Downloading videos** obviously requires the *server* to reach the
  source site.

If your browser truly cannot reach the server for some other reason (e.g. a
strict egress-only intranet where even the server's own origin is
unreachable from client machines), that's a network/firewall configuration
issue outside this app's control — the app itself makes no assumption that
the browser has internet access.

## Prerequisites

- **Python 3.6+** (should work with any modern Python 3 version)
- **[ffmpeg](https://www.ffmpeg.org/download.html)** for post-processing (required for video merging and format conversion)
- **[yt-dlp](https://github.com/yt-dlp/yt-dlp)** (installed automatically with the package)

## Installation

### From Source
```bash
# Clone the repository
git clone https://github.com/d0u9/youtube-dl-webui.git
cd youtube-dl-webui

# Install dependencies
pip install -r requirements.txt

# Install the package
python setup.py install
```

### Using pip
```bash
pip install youtube-dl-webui
```

## Configuration

### Configuration Files

The application uses JSON configuration files. There are several configuration files available:

- **`example_config.json`**: Template configuration file with all available options
- **`dockerfile/default_config.json`**: Default configuration used in Docker containers
- **Your own config file**: Specify with the `-c` option when running

### Configuration Priority

The application loads configuration in this order:
1. **Command Line Arguments** (highest priority)
2. **Main Config File** (specified with `-c` or `--config`)
3. **Default Values** (from the config classes)

### Key Configuration Options

```json
{
    "general": {
        "download_dir": "/path/to/downloads",
        "db_path": "/path/to/database.db",
        "log_size": 10,
        "about_custom_html": "<p>Your custom HTML content here</p>"
    },
    "server": {
        "host": "0.0.0.0",
        "port": 5000
    },
    "youtube_dl": {
        "format": "best",
        "proxy": "socks5://127.0.0.1:1080",
        "ratelimit": 1048576,
        "outtmpl": "%(title)s.%(ext)s"
    },
    "format_options": [
        { "label": "Best Quality", "value": "best" },
        { "label": "720p MP4", "value": "best[height<=720][ext=mp4]/best[height<=720]/best" }
    ]
}
```

### Custom HTML in About Modal

You can add custom HTML content to the About modal by setting the `about_custom_html` field in your configuration:

```json
{
    "general": {
        "about_custom_html": "<p>Welcome to our custom instance!</p><p>Visit our <a href='https://example.com'>website</a> for more information.</p>"
    }
}
```

This HTML will be displayed in the About modal below the standard application information.

## Usage

### Basic Usage

1. **Create a configuration file** based on `example_config.json`
2. **Start the server**:
   ```bash
   youtube-dl-webui -c /path/to/your/config.json
   ```
3. **Open your browser** and navigate to `http://localhost:5000`
4. **Add download tasks** using the "Add" button
5. **Monitor progress** in the main interface
6. **Download completed files** using the "Download" button

### Command Line Options

```bash
youtube-dl-webui -c CONFIG_FILE [OPTIONS]

Options:
  -c, --config CONFIG_FILE    Path to configuration file
  --host HOST                 Server host address (default: 0.0.0.0)
  --port PORT                 Server port (default: 5000)
  -h, --help                  Show help message
```

### Web Interface

- **Add Task**: Click "Add" to start a new download, optionally picking a quality preset
- **Remove Task**: Select a task and click "Remove", or right-click it, to delete it
- **Pause/Resume**: Control active downloads from the toolbar or the right-click menu
- **Download Files**: Download completed files directly from the browser
- **Right-click Menu**: Right-click any row in the task list for quick access to
  Pause, Resume, Download, and Remove — no need to select the row first
- **Preferences**: Configure application settings through the web interface
- **Filter Tasks**: Use the sidebar to filter tasks by status

### Updating yt-dlp

Sites change frequently, so an outdated yt-dlp is one of the most common
causes of downloads suddenly failing. The About modal (the "About" button
in the toolbar) shows the installed yt-dlp version and, when a newer one is
available on PyPI, an **Update** button appears next to it.

- **When the check runs**: only when you open the About modal — there's no
  background polling. The installed-version check is always fresh; the
  "latest version on PyPI" lookup is cached server-side for **1 hour** so
  repeatedly opening/closing About doesn't hammer PyPI or stall on a slow
  network.
- **What clicking Update does**: the server runs
  `pip install --upgrade yt-dlp` in its own Python environment, then
  re-checks the installed version and reports it back.

**Caveats:**
- **Requires outbound internet access** from the machine running the server
  (to reach PyPI) and write access to its Python environment's site-packages.
- **Restart the server after updating.** Whether a newly-started download
  picks up the new version without a restart depends on your OS's
  `multiprocessing` start method — on Windows (`spawn`) it usually does; on
  Linux/Docker (`fork`, the default) already-imported code stays in memory,
  so the old version keeps being used until the server process restarts.
  The update confirmation message says this explicitly.
- **No authentication.** Like every other endpoint in this app, `/ydl/update`
  is unauthenticated — anyone who can reach the web UI can trigger a pip
  install. This matches the app's existing trust model (the same is true of
  adding/removing tasks or reading config), but it's worth knowing if you
  expose this server beyond your local network.

## Docker Deployment

`dockerfile/Dockerfile` builds the image **from this repository's working
tree** (`COPY . .` at the repo root), so it always reflects whatever is on
the branch/commit being built — not a separate, potentially-stale snapshot.
`docker-compose.yml` at the repo root is the recommended way to run it: it
builds from that Dockerfile and bind-mounts a single `./data` directory that
holds everything the app writes (config, downloads, the sqlite database).

### Using Docker Compose

```bash
docker compose up -d --build
```

On first start, if `./data/config.json` doesn't exist yet, the container
creates one automatically (downloads and the database land right alongside
it in `./data`). Edit `docker-compose.yml` first if you want different
`PUID`/`PGID` values (they should match a real user on the host — check with
`id -u` / `id -g` — so downloaded files aren't owned by root) or a different
port/host bind mount path.

### Deploying with Portainer

1. **Push this repo (or your fork) to a git remote Portainer's host can
   reach** (GitHub, GitLab, a self-hosted git server, ...). Portainer builds
   directly from the repo, so nothing needs to be pre-built or pushed to a
   registry.
2. In Portainer: **Stacks → Add stack**.
3. Set **Build method** to **Repository**.
4. Fill in:
   - **Repository URL**: your repo's clone URL (e.g.
     `https://github.com/<you>/youtube-dl-webui.git`)
   - **Repository reference**: the branch to deploy, e.g.
     `refs/heads/master`
   - **Compose path**: `docker-compose.yml` (the default — matches the file
     at the repo root)
   - If it's a private repo, add the authentication Portainer asks for.
5. Click **Deploy the stack**. Portainer clones the repo, builds the image
   from `dockerfile/Dockerfile`, and starts the container.
6. To pick up new changes later, use Portainer's **Pull and redeploy** (or
   set up a webhook under the stack's settings for auto-deploy on push).

The `./data` bind mount in `docker-compose.yml` resolves relative to
wherever Portainer checks the repo out on its host (its stack working
directory) — that's fine and persists across redeploys of the same stack.
If you'd rather point it at a specific host path, edit the `volumes:` line
in `docker-compose.yml` to an absolute path (e.g. `/srv/youtube-dl-webui:/data`)
before deploying.

### Manual `docker build` / `docker run`

```bash
# from the repository root
docker build -f dockerfile/Dockerfile -t youtube-dl-webui .

docker run -d \
  --name youtube-dl-webui \
  -p 5000:5000 \
  -e PUID=1000 \
  -e PGID=1000 \
  -e CONF_FILE=/data/config.json \
  -v /path/on/host:/data \
  youtube-dl-webui
```

### Using the Upstream Docker Hub Image

The upstream project also publishes a prebuilt image, separate from anything
built from this repo — it won't include any of this fork's fixes unless
they've been merged upstream:

```bash
docker pull d0u9/youtube-dl-webui
docker run -d \
  --name youtube-dl-webui \
  -p 5000:5000 \
  -v /path/to/downloads:/tmp/youtube_dl \
  -v /path/to/config:/config.json \
  d0u9/youtube-dl-webui
```

### Docker Environment Variables

- `CONF_FILE`: Path to configuration file (default: `/config.json`)
- `HOST`: Server host (default: `0.0.0.0`)
- `PORT`: Server port (default: `5000`)
- `PUID`: User ID the app runs as inside the container (default: root)
- `PGID`: Group ID the app runs as inside the container (default: root)

## API

The application provides a REST API for programmatic access:

- `GET /task/list?state={all|downloading|finished|paused|invalid}` - List tasks
- `POST /task` - Create a new task, body: `{"url": "...", "ydl_opts": {"format": "..."}}`
- `DELETE /task/tid/{tid}` - Delete a task
- `DELETE /task/tid/{tid}?del_file=true` - Delete a task and its downloaded file
- `PUT /task/tid/{tid}?act=pause` - Pause a task
- `PUT /task/tid/{tid}?act=resume` - Resume (or retry) a task
- `GET /task/tid/{tid}/status` - Get full task details, including logs
- `GET /task/state_counter` - Get the number of tasks in each state
- `GET /config` - Get the current configuration
- `POST /config` - Update the configuration (merges into the existing config)
- `GET /download/{tid}` - Download the completed file for a finished task
- `GET /ydl/version` - Get the installed yt-dlp version, the latest version on
  PyPI (cached for 1 hour), and whether an update is available
- `POST /ydl/update` - Run `pip install --upgrade yt-dlp` on the server and
  report the resulting version (see [Updating yt-dlp](#updating-yt-dlp) for
  caveats)

Every response is JSON with a `status` field (`success` or `error`); error
responses also include an `errmsg` field.

See `REST_API.txt` for the older, partially out-of-date endpoint reference.

## Troubleshooting

### Common Issues

1. **ffmpeg not found**: Install ffmpeg and ensure it's in your PATH
2. **Permission errors**: Check file permissions for download directory and database
3. **Port already in use**: Change the port in your configuration file
4. **Proxy issues**: Verify proxy settings in your configuration
5. **Database won't open on first run**: the app now creates the database's parent
   directory automatically; if it still fails, check that the process can write to
   the configured `db_path`
6. **"Update" button doesn't appear, or update fails**: this needs outbound
   internet access to PyPI and write access to the server's Python
   environment — check both if it fails. If the server truly has no internet
   access, update manually instead: `pip install --upgrade yt-dlp` in the
   same environment, then restart the server. See
   [Updating yt-dlp](#updating-yt-dlp) for details.

### Logs

Check the application logs for detailed error information. Logs are stored in the configured log file and can be viewed through the web interface.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the GPL-2.0 License - see the LICENSE file for details.

## Links

- [yt-dlp](https://github.com/yt-dlp/yt-dlp) - The underlying download tool
- [Flask](https://github.com/pallets/flask) - Web framework
- [Docker Hub](https://hub.docker.com/r/d0u9/youtube-dl-webui/) - Docker image
- [Original Youtube-dl-WebUI](https://github.com/avignat/Youtube-dl-WebUI) - PHP-based alternative

[1]: https://github.com/yt-dlp/yt-dlp
