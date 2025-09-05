# For ubuntu, the latest tag points to the LTS version, since that is
# recommended for general use.
FROM python:3.11-slim

# install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    wget \
    ca-certificates \
    xz-utils \
    && rm -rf /var/lib/apt/lists/*

# install gosu for easy step-down from root
RUN wget -O /usr/local/bin/gosu "https://github.com/tianon/gosu/releases/download/1.16/gosu-$(dpkg --print-architecture)" \
    && chmod +x /usr/local/bin/gosu \
    && gosu nobody true

# install ffmpeg from a working source
RUN wget -O /tmp/ffmpeg.tar.xz "https://github.com/yt-dlp/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-linux64-gpl.tar.xz" \
    && cd /tmp \
    && tar -xf ffmpeg.tar.xz \
    && cp ffmpeg-master-latest-linux64-gpl/bin/ffmpeg /usr/bin/ \
    && cp ffmpeg-master-latest-linux64-gpl/bin/ffprobe /usr/bin/ \
    && rm -rf /tmp/ffmpeg*

# install yt-dlp and flask
RUN pip install --no-cache-dir yt-dlp flask

# install youtube-dl-webui
ENV YOUTUBE_DL_WEBUI_SOURCE /usr/src/youtube_dl_webui
WORKDIR $YOUTUBE_DL_WEBUI_SOURCE

# Copy source code
COPY . $YOUTUBE_DL_WEBUI_SOURCE/

# Create config symlink
RUN ln -s $YOUTUBE_DL_WEBUI_SOURCE/example_config.json /etc/youtube-dl-webui.json

# Copy config file
COPY dockerfile/default_config.json /config.json

# Set environment variables
ENV CONF_FILE=/config.json
ENV HOST=0.0.0.0
ENV PORT=5000

CMD ["python", "-m", "youtube_dl_webui", "-c", "/config.json", "--host", "0.0.0.0", "--port", "5000"]
