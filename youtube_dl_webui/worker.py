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
    def __init__(self, tid, msg_cli, download_dir=None):
        self.logger = logging.getLogger('ydl_webui')
        self.tid = tid
        self.msg_cli = msg_cli
        self.download_dir = download_dir

    def finished(self, d):
        self.logger.debug('finished status')
        self.logger.info(f'Download finished - Final filename: {d.get("filename", "None")}, Final tmpfilename: {d.get("tmpfilename", "None")}')
        
        # Ensure the final filename is the merged file, not intermediate audio/video files
        if 'filename' in d and d['filename']:
            # Check if this is an intermediate file (contains format code like .f140.m4a or .f299.mp4)
            # Intermediate files typically have format codes like .f140, .f299, etc.
            import re
            if re.search(r'\.f\d+\.(m4a|mp4|webm|mkv)$', d['filename']):
                # This is an intermediate file, we need to construct the final merged filename
                # Extract the base name without the format code
                base_name = re.sub(r'\.f\d+\.(m4a|mp4|webm|mkv)$', '', d['filename'])
                final_filename = f"{base_name}.mp4"  # Assume final format is mp4
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
        
        # Get the actual file size from the filesystem
        import os
        import time
        
        # Try to get the actual file size
        try:
            filename = d['filename']
            
            # Try different possible locations
            possible_paths = [
                filename,  # Current directory
                os.path.join(os.getcwd(), filename),  # Current working directory
            ]
            
            # If we have a download directory, try that too
            if self.download_dir:
                possible_paths.append(os.path.join(self.download_dir, filename))
                # Also try to find the file in subdirectories of the download directory
                try:
                    for root, dirs, files in os.walk(self.download_dir):
                        if filename in files:
                            possible_paths.append(os.path.join(root, filename))
                            break
                except Exception as e:
                    self.logger.debug(f'Error walking download directory: {e}')
            
            # If the filename contains a path separator, it might be relative to the download directory
            if os.path.sep in filename:
                possible_paths.append(filename)
            
            actual_file_size = None
            final_file_path = None
            
            # Try to find the file, with a small delay for merged files
            for attempt in range(3):  # Try up to 3 times with delays
                for path in possible_paths:
                    if os.path.exists(path):
                        actual_file_size = os.path.getsize(path)
                        final_file_path = path
                        break
                
                if actual_file_size is not None:
                    break
                
                # If this is the first attempt and we didn't find the file, wait a bit
                # This helps with merged files that might not be ready yet
                if attempt == 0:
                    time.sleep(0.5)  # Wait 500ms for file to be ready
            
            if actual_file_size is not None:
                self.logger.info(f'Found final file at: {final_file_path}')
                self.logger.info(f'Actual file size: {actual_file_size} bytes (was {d.get("total_bytes", 0)} bytes)')
                d['total_bytes'] = actual_file_size
                d['downloaded_bytes'] = actual_file_size
            else:
                # If we still can't find the file, try to find any file with a similar name
                # This handles cases where the final filename might be slightly different
                self.logger.warning(f'Could not find final file to get actual size. Tried paths: {possible_paths}')
                
                # Try to find files with similar names in the download directory
                if self.download_dir and os.path.exists(self.download_dir):
                    try:
                        base_name = os.path.splitext(filename)[0]
                        for file in os.listdir(self.download_dir):
                            if file.startswith(base_name) and file.endswith(('.mp4', '.mkv', '.webm', '.avi')):
                                similar_file_path = os.path.join(self.download_dir, file)
                                if os.path.exists(similar_file_path):
                                    actual_file_size = os.path.getsize(similar_file_path)
                                    self.logger.info(f'Found similar file: {similar_file_path}')
                                    self.logger.info(f'Actual file size: {actual_file_size} bytes (was {d.get("total_bytes", 0)} bytes)')
                                    d['total_bytes'] = actual_file_size
                                    d['downloaded_bytes'] = actual_file_size
                                    d['filename'] = file  # Update filename to match actual file
                                    break
                    except Exception as e:
                        self.logger.debug(f'Error searching for similar files: {e}')
        
        except Exception as e:
            self.logger.error(f'Error getting actual file size: {e}')
        
        # Log the final filename that will be stored in the database
        self.logger.info(f'Final filename to be stored in database: {d.get("filename", "None")}')
        
        d['_percent_str'] = '100%'
        d['speed'] = '0'
        d['elapsed'] = 0
        d['eta'] = 0
        
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
    def __init__(self, tid, url, msg_cli, ydl_opts=None, first_run=False, download_dir=None):
        super(Worker, self).__init__()
        self.logger = logging.getLogger('ydl_webui')
        self.tid = tid
        self.url = url
        self.msg_cli = msg_cli
        self.ydl_opts = ydl_opts
        self.first_run = first_run
        self.download_dir = download_dir
        self.log_filter = LogFilter(tid, msg_cli)
        self.ydl_hook = YdlHook(tid, msg_cli, download_dir)

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

        # Try to update the file size one more time when the worker is done
        # This ensures we get the final merged file size
        try:
            import os
            import glob
            
            # Look for the final file in the download directory
            if self.download_dir and os.path.exists(self.download_dir):
                # Try to find the most recent video file that might be the final merged file
                video_extensions = ['*.mp4', '*.mkv', '*.webm', '*.avi']
                latest_file = None
                latest_time = 0
                
                for pattern in video_extensions:
                    files = glob.glob(os.path.join(self.download_dir, pattern))
                    for file_path in files:
                        try:
                            file_time = os.path.getmtime(file_path)
                            if file_time > latest_time:
                                latest_time = file_time
                                latest_file = file_path
                        except Exception:
                            continue
                
                if latest_file:
                    file_size = os.path.getsize(latest_file)
                    filename = os.path.basename(latest_file)
                    self.logger.info(f'Worker done - Found final file: {filename} ({file_size} bytes)')
                    
                    # Send a final progress update with the correct file size
                    final_data = {
                        'filename': filename,
                        'tmpfilename': '',  # Add required tmpfilename field
                        'total_bytes': file_size,
                        'downloaded_bytes': file_size,
                        'total_bytes_estimate': file_size,  # Add required estimate field
                        '_percent_str': '100%',
                        'speed': '0',
                        'elapsed': 0,
                        'eta': 0
                    }
                    self.msg_cli.put('progress', {'tid': self.tid, 'data': final_data})
        
        except Exception as e:
            self.logger.error(f'Error updating final file size: {e}')
        
        self.msg_cli.put('worker_done', {'tid': self.tid, 'data': {}})

    def stop(self):
        self.logger.info('Terminating Process ...')
        self.terminate()
        self.join()

