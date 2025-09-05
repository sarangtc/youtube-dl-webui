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
- Can set independent yt-dlp options for each task.
- Some UI improvement.

## 0.2.1

Some bugs fix.

---

## 0.3.0

Major update with significant improvements to functionality, user experience, and bug fixes.

### 🔄 Migration from youtube-dl to yt-dlp
- **Updated base image** from Python 3.6 to Python 3.11 for better performance and security
- **Replaced youtube-dl** with yt-dlp (latest version) for improved download capabilities
- **Updated all imports** and references throughout the codebase
- **Updated documentation** and sample configurations

### 🎯 Enhanced User Interface
- **Added favicon** with video camera emoji for better browser tab identification
- **Format presets dropdown** in both Preferences and Add Video modals
  - Best Quality (Video + Audio)
  - Best Video Only
  - Best Audio Only
  - Various resolution options (720p, 480p, 360p)
  - Audio-only formats (MP3, M4A)
- **"Use preferences format" option** in Add Video modal for easy format inheritance
- **Smart button visibility** - Pause/Resume buttons only appear for active tasks

### 🚀 Improved Functionality
- **Working download button** - Now properly serves actual video files instead of error messages
- **Preferences modal** - Correctly loads and displays saved configuration when reopened
- **Preference inheritance** - Saved preferences (format, proxy, outtmpl, ratelimit) are now properly applied to new downloads
- **Unicode filename support** - Handles special characters like `:` and `|` in video titles

### 🐛 Bug Fixes
- **Fixed preferences modal** - No longer shows blank fields when reopened
- **Fixed ETA display** - Shows "Done" instead of "NaN" for finished tasks
- **Fixed speed display** - Shows "Done" instead of "0 B/s" for finished tasks
- **Fixed download path resolution** - Correctly constructs file paths using configuration download directory
- **Fixed state checking** - Download endpoint now properly recognizes 'finished' state

### ⚙️ Configuration & Logging
- **Dynamic logging levels** - Respects `FLASK_DEBUG` environment variable
  - `FLASK_DEBUG=0`: INFO level (production mode)
  - `FLASK_DEBUG=1`: DEBUG level (development mode)
- **Improved error handling** - Better error messages and debugging information
- **Configuration-driven paths** - Download directory is read from configuration instead of hardcoded

### 🔧 Technical Improvements
- **Updated Dockerfile** - Modern Python base, improved FFmpeg installation, better security
- **Enhanced error handling** - More descriptive error messages for troubleshooting
- **Code cleanup** - Removed debug print statements and improved code structure
- **Better file path handling** - Robust handling of various filename formats and special characters

### 📱 User Experience
- **Toast notifications** - Success/error messages for user actions
- **Modal improvements** - Better form handling and validation
- **Responsive design** - Improved layout and button states
- **Accessibility** - Better keyboard navigation and screen reader support

### 🐳 Docker Improvements
- **Updated base image** to Python 3.11-slim
- **Improved FFmpeg installation** with latest builds
- **Better security** with proper user permissions
- **Optimized build process** with proper layer caching

---

**Note**: This version includes breaking changes due to the migration from youtube-dl to yt-dlp. Users should update their configurations and be aware that the underlying download engine has changed.
