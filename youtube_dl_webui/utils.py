#!/usr/bin/env python
# -*- coding: utf-8 -*-

import uuid
import re

from hashlib import sha1

state_index={'all': 0, 'downloading': 1, 'paused': 2, 'finished': 3, 'invalid': 4}
state_name=['all', 'downloading', 'paused', 'finished', 'invalid']

def new_uuid():
    return str(uuid.uuid4().hex)


def url2tid(url):
    return sha1(url.encode()).hexdigest()


def sanitize_filename(filename):
    """
    Sanitize filename by replacing problematic characters with fullwidth equivalents.
    This prevents issues when YouTube-DL downloads separate audio/video files and merges them.
    """
    replacement_map = {
        ':': '：',  # U+FF1A FULLWIDTH COLON
        '?': '？',  # U+FF1F FULLWIDTH QUESTION MARK
        '*': '＊',  # U+FF0A FULLWIDTH ASTERISK
        '<': '＜',  # U+FF1C FULLWIDTH LESS-THAN SIGN
        '>': '＞',  # U+FF1E FULLWIDTH GREATER-THAN SIGN
        '|': '｜',  # U+FF5C FULLWIDTH VERTICAL LINE
        '"': '＂',  # U+FF02 FULLWIDTH QUOTATION MARK
        '/': '／',  # U+FF0F FULLWIDTH SOLIDUS
        '\\': '＼', # U+FF3C FULLWIDTH REVERSE SOLIDUS
    }
    
    sanitized = filename
    for char, replacement in replacement_map.items():
        if char in sanitized:
            sanitized = sanitized.replace(char, replacement)
    
    return sanitized


class YoutubeDLWebUI(Exception):
    """Base exception for YoutubeDL errors."""
    pass


class TaskError(YoutubeDLWebUI):
    """Error related to download tasks."""
    def __init__(self, msg, tid=None):
        if tid: msg += ' tid={}'.format(tid)

        super(TaskError, self).__init__(msg)
        self.msg = msg

    def __str__(self):
        return repr(self.msg)


class TaskInexistenceError(TaskError):
    def __init__(self, msg, tid=None, url=None, state=None):
        msg = 'Task does not exist'
        if tid:
            msg += ' tid={}'.format(tid)
        if url:
            msg += ' url={}'.format(url)
        if state:
            msg += ' state={}'.format(state)

        super(TaskInexistenceError, self).__init__(msg)
        self.msg = msg


class TaskExistenceError(TaskError):
    def __init__(self, msg, tid=None, url=None, state=None):
        msg = 'Task already exists'
        if tid:
            msg += ' tid={}'.format(tid)
        if url:
            msg += ' url={}'.format(url)
        if state:
            msg += ' state={}'.format(state)

        super(TaskExistenceError, self).__init__(msg)
        self.msg = msg


class YDLManagerError(YoutubeDLWebUI):
    """Error related to yt-dlp manager."""
    def __init__(self, msg, tid=None, url=None, state=None):
        if tid:
            msg += ' tid={}'.format(tid)
        if url:
            msg += ' url={}'.format(url)
        if state:
            msg += ' state={}'.format(state)

        super(YDLManagerError, self).__init__(msg)
        self.tid = tid
        self.url = url
        self.state = state
        self.msg = msg

    def __str__(self):
        return repr(self.msg)
