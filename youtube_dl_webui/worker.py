#!/usr/bin/env python
# -*- coding: utf-8 -*-

import re
import logging
import json

try:
    from yt_dlp import YoutubeDL
    from yt_dlp.utils import DownloadError
except ImportError:
    from youtube_dl import YoutubeDL
    from youtube_dl import DownloadError

from multiprocessing import Process
from time import time

class YdlHook(object):
    def __init__(self, tid, msg_cli):
        self.logger = logging.getLogger('ydl_webui')
        self.tid = tid
        self.msg_cli = msg_cli

    def finished(self, d):
        self.logger.debug('finished status')
        d['_percent_str'] = '100%'
        d['speed'] = '0'
        d['elapsed'] = 0
        d['eta'] = 0
        d['downloaded_bytes'] = d.get('total_bytes', d.get('downloaded_bytes', 0))
        return d

    def downloading(self, d):
        self.logger.debug('downloading status')
        return d

    def error(self, d):
        self.logger.debug('error status')
        return d

    def dispatcher(self, d):
        if 'total_bytes_estimate' not in d or d['total_bytes_estimate'] is None:
            d['total_bytes_estimate'] = 0
        if 'tmpfilename' not in d or d['tmpfilename'] is None:
            d['tmpfilename'] = ''
        if 'filename' not in d or d['filename'] is None:
            d['filename'] = ''

        if d['status'] == 'finished':
            d = self.finished(d)
        elif d['status'] == 'downloading':
            d = self.downloading(d)
        elif d['status'] == 'error':
            d = self.error(d)

        # progress hook dicts may carry non-serializable objects (e.g. the
        # info_dict in yt-dlp); strip everything the UI does not consume.
        keep = ('status', 'filename', 'tmpfilename', '_percent_str', 'percent',
                'downloaded_bytes', 'total_bytes', 'total_bytes_estimate',
                'speed', 'eta', 'elapsed')
        slim = {k: d[k] for k in keep if k in d}
        self.msg_cli.put('progress', {'tid': self.tid, 'data': slim})


class LogFilter(object):
    def __init__(self, tid, msg_cli):
        self.logger = logging.getLogger('ydl_webui')
        self.tid = tid
        self.msg_cli = msg_cli

    def debug(self, msg):
        self.logger.debug('debug: %s' %(self.ansi_escape(msg)))
        payload = {'time': int(time()), 'type': 'debug', 'msg': self.ansi_escape(msg)}
        self.msg_cli.put('log', {'tid': self.tid, 'data': payload})

    def warning(self, msg):
        self.logger.debug('warning: %s' %(self.ansi_escape(msg)))
        payload = {'time': int(time()), 'type': 'warning', 'msg': self.ansi_escape(msg)}
        self.msg_cli.put('log', {'tid': self.tid, 'data': payload})

    def error(self, msg):
        self.logger.debug('error: %s' %(self.ansi_escape(msg)))
        payload = {'time': int(time()), 'type': 'error', 'msg': self.ansi_escape(msg)}
        self.msg_cli.put('log', {'tid': self.tid, 'data': payload})

    def ansi_escape(self, msg):
        reg = r'\x1b\[([0-9,A-Z]{1,2}(;[0-9]{1,2})?(;[0-9]{3})?)?[m|K]?'
        return re.sub(reg, '', str(msg))


class FatalEvent(object):
    def __init__(self, tid, msg_cli):
        self.logger = logging.getLogger('ydl_webui')
        self.tid = tid
        self.msg_cli = msg_cli

    def download_error(self, msg):
        self.logger.debug('fatal error: %s' %(msg))
        payload = {'time': int(time()), 'type': 'fatal', 'msg': msg}
        self.msg_cli.put('fatal', {'tid': self.tid, 'data': payload})


class Worker(Process):
    def __init__(self, tid, url, msg_cli, ydl_opts=None, first_run=False):
        super(Worker, self).__init__()
        self.daemon = True
        self.logger = logging.getLogger('ydl_webui')
        self.tid = tid
        self.url = url
        self.msg_cli = msg_cli
        self.ydl_opts = dict(ydl_opts) if ydl_opts else {}
        self.first_run = first_run
        self.log_filter = LogFilter(tid, msg_cli)
        self.ydl_hook = YdlHook(tid, msg_cli)

    def intercept_ydl_opts(self):
        self.ydl_opts['logger'] = self.log_filter
        self.ydl_opts['progress_hooks'] = [self.ydl_hook.dispatcher]
        self.ydl_opts['noplaylist'] = True
        self.ydl_opts['progress_with_newline'] = True
        # resume partially downloaded files instead of restarting
        self.ydl_opts['continuedl'] = True

    def run(self):
        self.intercept_ydl_opts()
        event_handler = FatalEvent(self.tid, self.msg_cli)
        try:
            with YoutubeDL(self.ydl_opts) as ydl:
                if self.first_run:
                    info_dict = ydl.extract_info(self.url, download=False)

                    if info_dict.get('description'):
                        info_dict['description'] = info_dict['description'].replace('\n', '<br />')

                    # only forward the fields the task manager persists;
                    # the full info_dict can be huge (formats, fragments, ...)
                    fields = ('title', 'format', 'ext', 'thumbnail', 'duration',
                              'view_count', 'like_count', 'dislike_count',
                              'average_rating', 'description')
                    slim_info = {k: info_dict[k] for k in fields if info_dict.get(k) is not None}
                    self.msg_cli.put('info_dict', {'tid': self.tid, 'data': slim_info})

                self.logger.info('start downloading, url - %s' %(self.url))
                ydl.download([self.url])
        except DownloadError as e:
            event_handler.download_error('download error: %s' %(str(e)))
            return
        except Exception as e:
            # never let a worker die silently; mark the task invalid instead
            self.logger.exception('unexpected error in worker (tid=%s)', self.tid)
            event_handler.download_error('unexpected error: %s' %(str(e)))
            return

        self.msg_cli.put('worker_done', {'tid': self.tid, 'data': {}})

    def stop(self):
        self.logger.info('Terminating Process ...')
        if self.is_alive():
            self.terminate()
        self.join(timeout=5)
