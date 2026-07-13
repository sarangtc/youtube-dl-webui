# Builds the web UI from this repository's working tree (not a remote
# snapshot), so local changes are actually reflected in the image.
#
# The build context must be the repository ROOT, not this dockerfile/
# directory, e.g.:
#   docker build -f dockerfile/Dockerfile -t youtube-dl-webui .
# See docker-compose.yml at the repo root for the recommended way to run it.
FROM python:3.11-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg gosu ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/youtube_dl_webui

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

COPY dockerfile/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 5000
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["python", "-m", "youtube_dl_webui"]
