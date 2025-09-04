#!/usr/bin/env python
# -*- coding: utf-8 -*-

import re
import logging

from yt_dlp import YoutubeDL
from yt_dlp.utils import DownloadError

from multiprocessing import Process
from time import time

from .utils import sanitize_filename

class YdlHook(object):
    def __init__(self, tid, msg_cli):
        self.logger = logging.getLogger('ydl_webui')
        self.tid = tid
        self.msg_cli = msg_cli

    def finished(self, d):
        self.logger.debug('finished status')
        self.logger.info(f'Download finished - Final filename: {d.get("filename", "None")}, Final tmpfilename: {d.get("tmpfilename", "None")}')
        
        # Ensure the final filename is the merged file, not intermediate audio/video files
        if 'filename' in d and d['filename']:
            # Check if this is an intermediate file (contains format code like .f140.m4a)
            if '.f' in d['filename'] and d['filename'].endswith(('.m4a', '.mp4')):
                # This is an intermediate file, we need to construct the final merged filename
                # Extract the base name without the format code
                base_name = d['filename'].split('.f')[0]
                final_filename = f"{base_name}.mp4"
                self.logger.info(f'Intermediate file detected, using final filename: {final_filename}')
                self.logger.info(f'Original intermediate filename: {d["filename"]}')
                d['filename'] = final_filename
            else:
                self.logger.info(f'Final file detected (not intermediate): {d["filename"]}')
        
        # Ensure the final filename is properly sanitized
        if 'filename' in d and d['filename']:
            original_filename = d['filename']
            d['filename'] = sanitize_filename(d['filename'])
            if original_filename != d['filename']:
                self.logger.info(f'Final filename sanitized: "{original_filename}" -> "{d["filename"]}"')
        
        # Log the final filename that will be stored in the database
        self.logger.info(f'Final filename to be stored in database: {d.get("filename", "None")}')
        
        d['_percent_str'] = '100%'
        d['speed'] = '0'
        d['elapsed'] = 0
        d['eta'] = 0
        d['downloaded_bytes'] = d['total_bytes']
        return d

    def downloading(self, d):
        self.logger.debug('downloading status')
        return d

    def error(self, d):
        self.logger.debug('error status')
        #  d['_percent_str'] = '100%'
        return d

    def dispatcher(self, d):
        if 'total_bytes_estimate' not in d:
            d['total_bytes_estimate'] = 0
        if 'tmpfilename' not in d:
            d['tmpfilename'] = ''

        if d['status'] == 'finished':
            d = self.finished(d)
        elif d['status'] == 'downloading':
            d = self.downloading(d)
        elif d['error'] == 'error':
            d = self.error(d)
        self.msg_cli.put('progress', {'tid': self.tid, 'data': d})


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
        payload = {'time': int(time()), 'type': 'warning', 'msg': self.ansi_escape(msg)}
        self.msg_cli.put('log', {'tid': self.tid, 'data': payload})

    def ansi_escape(self, msg):
        reg = r'\x1b\[([0-9,A-Z]{1,2}(;[0-9]{1,2})?(;[0-9]{3})?)?[m|K]?'
        return re.sub(reg, '', msg)


class FatalEvent(object):
    def __init__(self, tid, msg_cli):
        self.logger = logging.getLogger('ydl_webui')
        self.tid = tid
        self.msg_cli = msg_cli

    def invalid_url(self, url):
        self.logger.debug('fatal error: invalid url')
        payload = {'time': int(time()), 'type': 'fatal', 'msg': 'invalid url: %s' %(url)}
        self.msg_cli.put('fatal', {'tid': self.tid, 'data': payload})


class Worker(Process):
    def __init__(self, tid, url, msg_cli, ydl_opts=None, first_run=False):
        super(Worker, self).__init__()
        self.logger = logging.getLogger('ydl_webui')
        self.tid = tid
        self.url = url
        self.msg_cli = msg_cli
        self.ydl_opts = ydl_opts
        self.first_run = first_run
        self.log_filter = LogFilter(tid, msg_cli)
        self.ydl_hook = YdlHook(tid, msg_cli)

    def intercept_ydl_opts(self):
        self.ydl_opts['logger'] = self.log_filter
        self.ydl_opts['progress_hooks'] = [self.ydl_hook.dispatcher]
        self.ydl_opts['noplaylist'] = "false"
        self.ydl_opts['progress_with_newline'] = True

    def run(self):
        self.intercept_ydl_opts()
        with YoutubeDL(self.ydl_opts) as ydl:
            try:
                if self.first_run:
                    info_dict = ydl.extract_info(self.url, download=False)

                    #  self.logger.debug(json.dumps(info_dict, indent=4))

                    if "description" in info_dict:
                        info_dict['description'] = info_dict['description'].replace('\n', '<br />');
                    payload = {'tid': self.tid, 'data': info_dict}
                    self.msg_cli.put('info_dict', payload)

                # Prefetch the title and sanitize the filename before download
                if 'outtmpl' in self.ydl_opts and '%(title)s' in self.ydl_opts['outtmpl']:
                    # Extract info to get the title
                    info_dict = ydl.extract_info(self.url, download=False)
                    title = info_dict.get('title', 'video')
                    
                    # Create a completely sanitized filename template
                    sanitized_title = sanitize_filename(title)
                    # Create a custom filename without any template variables
                    custom_filename = f"{sanitized_title}.%(ext)s"
                    # Update the options with the custom filename
                    self.ydl_opts['outtmpl'] = custom_filename
                    
                    self.logger.info(f'Original title: {title}')
                    self.logger.info(f'Original outtmpl: {self.ydl_opts.get("outtmpl", "None")}')
                    self.logger.info(f'Custom filename template: {custom_filename}')
                    self.logger.info(f'Updated ydl_opts outtmpl: {self.ydl_opts["outtmpl"]}')
                    
                    # Re-apply the progress hooks to ensure they use the updated options
                    ydl.opts.update(self.ydl_opts)

                self.logger.info('start downloading, url - %s' %(self.url))
                ydl.download([self.url])
            except DownloadError as e:
                # url error
                event_handler = FatalEvent(self.tid, self.msg_cli)
                event_handler.invalid_url(self.url);

        self.msg_cli.put('worker_done', {'tid': self.tid, 'data': {}})

    def stop(self):
        self.logger.info('Terminating Process ...')
        self.terminate()
        self.join()

