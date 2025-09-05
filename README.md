# yt-dlp-webui

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
- **Batch Operations**: Manage multiple downloads simultaneously
- **File Download**: Direct download of completed files through the web interface

### User Interface
- **Modern Design**: Clean, responsive interface with Vue.js
- **Task Filtering**: Filter tasks by status (All, Downloading, Finished, Paused, Invalid)
- **Detailed Information**: View comprehensive task details including thumbnails, descriptions, and logs
- **Real-time Updates**: Automatic refresh of task status and progress

### Configuration
- **Web-based Settings**: Configure download paths, formats, and other options through the UI
- **Custom HTML Support**: Add custom HTML content to the About modal
- **Format Presets**: Pre-defined format options for common use cases
- **Persistent Settings**: All preferences are saved and restored between sessions

### Advanced Features
- **Proxy Support**: Configure proxy settings for downloads
- **Rate Limiting**: Control download speed to avoid overwhelming your connection
- **Custom Output Templates**: Define custom filename patterns
- **Logging**: Comprehensive logging with configurable log size
- **Database Storage**: SQLite database for persistent task storage

## Screenshot

![screenshot1](screen_shot/1.gif)

## Prerequisites

- **Python 3.6+** (tested with Python 3.6, but should work with newer versions, tested up to 3.11)
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

- **Add Task**: Click "Add" to start a new download
- **Remove Task**: Select a task and click "Remove" to delete it
- **Pause/Resume**: Control active downloads
- **Download Files**: Download completed files directly from the browser
- **Preferences**: Configure application settings through the web interface
- **Filter Tasks**: Use the sidebar to filter tasks by status

## Docker Deployment

### Using Docker Hub

```bash
# Pull the image
docker pull d0u9/youtube-dl-webui

# Run the container
docker run -d \
  --name youtube-dl-webui \
  -p 5000:5000 \
  -v /path/to/downloads:/tmp/youtube_dl \
  -v /path/to/config:/config.json \
  d0u9/youtube-dl-webui
```

### Building from Source

```bash
# Build the image
docker build -t youtube-dl-webui .

# Run the container
docker run -d \
  --name youtube-dl-webui \
  -p 5000:5000 \
  -v /path/to/downloads:/tmp/youtube_dl \
  youtube-dl-webui
```

### Docker Environment Variables

- `CONF_FILE`: Path to configuration file (default: `/config.json`)
- `HOST`: Server host (default: `0.0.0.0`)
- `PORT`: Server port (default: `5000`)
- `PUID`: User ID for file permissions
- `PGID`: Group ID for file permissions

## API

The application provides a REST API for programmatic access:

- `GET /task/list` - List all tasks
- `POST /task` - Create a new task
- `DELETE /task/tid/{tid}` - Delete a task
- `PUT /task/tid/{tid}?act=pause` - Pause a task
- `PUT /task/tid/{tid}?act=resume` - Resume a task
- `GET /task/tid/{tid}/status` - Get task details
- `GET /config` - Get configuration
- `POST /config` - Update configuration
- `GET /download/{tid}` - Download completed file

See `REST_API.txt` for detailed API documentation.

## Troubleshooting

### Common Issues

1. **ffmpeg not found**: Install ffmpeg and ensure it's in your PATH
2. **Permission errors**: Check file permissions for download directory and database
3. **Port already in use**: Change the port in your configuration file
4. **Proxy issues**: Verify proxy settings in your configuration

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