#!/usr/bin/env python
# -*- coding: utf-8 -*-

import logging

from urllib.parse import urlparse, parse_qs

try:
    from yt_dlp import YoutubeDL
    from yt_dlp.utils import DownloadError
except ImportError:
    from youtube_dl import YoutubeDL
    from youtube_dl import DownloadError

YOUTUBE_HOSTS = ('youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com')


class PlaylistError(Exception):
    def __init__(self, msg):
        super(PlaylistError, self).__init__(msg)
        self.msg = msg


def is_playlist_url(url):
    """True for a URL that names a playlist only (no specific video).

    watch?v=X&list=Y is left alone: the worker runs with noplaylist, so it
    downloads just that one video, which is what the user pasted.
    """
    try:
        parsed = urlparse(url)
    except ValueError:
        return False

    if (parsed.hostname or '').lower() not in YOUTUBE_HOSTS:
        return False

    query = parse_qs(parsed.query)
    return 'list' in query and 'v' not in query


def expand_playlist(url, proxy=None):
    """Return the video URLs of a playlist, in playlist order.

    Uses a flat extraction, so only the playlist pages are fetched -- the
    individual videos are resolved later, each by its own task.
    """
    logger = logging.getLogger('ydl_webui')
    opts = {'quiet': True, 'no_warnings': True, 'skip_download': True,
            'extract_flat': 'in_playlist'}
    if proxy:
        opts['proxy'] = proxy

    try:
        with YoutubeDL(opts) as ydl:
            info = ydl.extract_info(url, download=False)
    except DownloadError as e:
        raise PlaylistError(str(e))

    urls = []
    for entry in (info or {}).get('entries') or []:
        if not entry:
            continue
        video_url = entry.get('url') or entry.get('webpage_url')
        if not video_url and entry.get('id'):
            video_url = 'https://www.youtube.com/watch?v={}'.format(entry['id'])
        if video_url and video_url not in urls:
            urls.append(video_url)

    logger.info('playlist %s expanded to %d videos', url, len(urls))
    return urls
