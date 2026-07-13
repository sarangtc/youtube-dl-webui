#!/bin/bash
set -e

puid=${PUID:-$(id -u root)}
pgid=${PGID:-$(id -g root)}

conf=${CONF_FILE:-"/config.json"}
host=${HOST:-"0.0.0.0"}
port=${PORT:-5000}

if [[ "$*" == python*-m*youtube_dl_webui* ]]; then
    conf_dir=$(dirname "$conf")
    mkdir -p "$conf_dir"

    if [ ! -f "$conf" ]; then
        # first run: bootstrap a config next to itself, so a single
        # bind-mounted directory (holding $conf) is enough to get started --
        # downloads and the database land right alongside it
        cat > "$conf" <<CONFEOF
{
    "general": {
        "download_dir": "$conf_dir/downloads",
        "db_path": "$conf_dir/youtube_dl_webui.db",
        "log_size": 10
    },
    "server": {
        "host": "0.0.0.0",
        "port": 5000
    },
    "youtube_dl": {
    }
}
CONFEOF
        chown -R "$puid:$pgid" "$conf_dir"
    fi

    exec gosu "$puid:$pgid" "$@" -c "$conf" --host "$host" --port "$port"
fi

exec "$@"
