#!/usr/bin/env python
# -*- coding: utf-8 -*-

import json
import os
import re
import subprocess
import sys
import time

from urllib.error import URLError
from urllib.request import urlopen

from flask import Flask
from flask import render_template
from flask import request
from flask import send_from_directory
from multiprocessing import Process
from threading import Lock

from . import __version__

MSG = None
MSG_LOCK = Lock()
YDL_UPDATE_LOCK = Lock()
YDL_UPDATE_IN_PROGRESS = False

# the latest-version lookup hits PyPI over the network; cache it so opening
# the About modal repeatedly doesn't hammer PyPI or stall on a slow network
YDL_LATEST_CACHE_TTL = 3600
_ydl_latest_cache = {'version': None, 'checked_at': 0}

app = Flask(__name__)

MSG_INVALID_REQUEST = {'status': 'error', 'errmsg': 'invalid request'}


def get_installed_ydl_version():
    # importing yt_dlp in-process would cache whatever was on disk when this
    # server started (server.py -> __init__ -> core -> worker all import it
    # at startup); a fresh subprocess always reflects what's on disk now
    try:
        check = subprocess.run(
            [sys.executable, '-c', 'import yt_dlp; print(yt_dlp.version.__version__)'],
            capture_output=True, text=True, timeout=15)
    except (OSError, subprocess.TimeoutExpired):
        return None

    return check.stdout.strip() if check.returncode == 0 else None


def get_latest_ydl_version():
    now = time.time()
    if _ydl_latest_cache['version'] is not None \
            and (now - _ydl_latest_cache['checked_at']) < YDL_LATEST_CACHE_TTL:
        return _ydl_latest_cache['version']

    try:
        with urlopen('https://pypi.org/pypi/yt-dlp/json', timeout=5) as resp:
            data = json.loads(resp.read().decode('utf-8'))
        latest = data['info']['version']
    except (URLError, KeyError, ValueError, OSError):
        return None

    _ydl_latest_cache['version'] = latest
    _ydl_latest_cache['checked_at'] = now
    return latest


def _version_tuple(v):
    # yt-dlp's own version string is zero-padded (e.g. "2026.07.04") while
    # PyPI's JSON API reports the same release unpadded (e.g. "2026.7.4");
    # comparing as numeric tuples avoids false "update available" positives
    parts = []
    for chunk in re.split(r'[.\-]', v or ''):
        digits = ''.join(ch for ch in chunk if ch.isdigit())
        parts.append(int(digits) if digits else 0)
    return tuple(parts)


def msg_request(event, payload):
    """Send one request to the core and wait for its reply.

    Flask serves requests from multiple threads, but there is only one
    request/response queue pair shared with the core process. Without the
    lock two concurrent requests could each receive the other's reply.
    """
    with MSG_LOCK:
        MSG.put(event, payload)
        return MSG.get()


def str2bool(val):
    return str(val).lower() in ('1', 'true', 'yes', 'on')


@app.route('/')
def index():
    return render_template('index.html', version=__version__)


@app.route('/task', methods=['POST'])
def add_task():
    payload = request.get_json(silent=True)
    if payload is None or not isinstance(payload.get('url', None), str) \
            or payload['url'].strip() == '':
        return json.dumps(MSG_INVALID_REQUEST)

    payload['url'] = payload['url'].strip()
    return json.dumps(msg_request('create', payload))


@app.route('/task/list', methods=['GET'])
def list_task():
    payload = {}
    payload['exerpt'] = request.args.get('exerpt', None) is not None
    payload['state'] = request.args.get('state', 'all')

    return json.dumps(msg_request('list', payload))


@app.route('/task/state_counter', methods=['GET'])
def list_state():
    return json.dumps(msg_request('state', None))


@app.route('/task/batch/<action>', methods=['POST'])
def task_batch(action):
    payload = {'act': action, 'detail': request.get_json(silent=True) or {}}

    return json.dumps(msg_request('batch', payload))


@app.route('/task/tid/<tid>', methods=['DELETE'])
def delete_task(tid):
    payload = {}
    payload['tid'] = tid
    payload['del_file'] = str2bool(request.args.get('del_file', 'false'))

    return json.dumps(msg_request('delete', payload))


@app.route('/task/tid/<tid>', methods=['PUT'])
def manipulate_task(tid):
    payload = {}
    payload['tid'] = tid

    act = request.args.get('act', None)
    if act not in ('pause', 'resume'):
        return json.dumps(MSG_INVALID_REQUEST)
    payload['act'] = act

    return json.dumps(msg_request('manipulate', payload))


@app.route('/task/tid/<tid>/status', methods=['GET'])
def query_task(tid):
    payload = {}
    payload['tid'] = tid
    payload['exerpt'] = request.args.get('exerpt', None) is not None

    return json.dumps(msg_request('query', payload))


@app.route('/download/<tid>', methods=['GET'])
def download_file(tid):
    ret = msg_request('query', {'tid': tid, 'exerpt': False})

    if ret.get('status') != 'success':
        return json.dumps(ret), 404

    detail = ret.get('detail', {})
    filename = detail.get('filename', '')
    if detail.get('state') != 'finished' or not filename:
        return json.dumps({'status': 'error',
                           'errmsg': 'Task is not finished yet'}), 404

    # the server process is started with the download dir as its cwd;
    # send_from_directory rejects paths escaping that directory
    dl_dir = os.getcwd()
    if not os.path.isfile(os.path.join(dl_dir, filename)):
        return json.dumps({'status': 'error',
                           'errmsg': 'File not found on disk'}), 404

    return send_from_directory(dl_dir, filename, as_attachment=True)


@app.route('/config', methods=['GET', 'POST'])
def get_config():
    payload = {}
    if request.method == 'POST':
        param = request.get_json(silent=True)
        if param is None:
            return json.dumps(MSG_INVALID_REQUEST)
        payload['act'] = 'update'
        payload['param'] = param
    else:
        payload['act'] = 'get'

    return json.dumps(msg_request('config', payload))


@app.route('/ydl/version', methods=['GET'])
def ydl_version():
    installed = get_installed_ydl_version()
    latest = get_latest_ydl_version()
    update_available = bool(installed and latest and _version_tuple(latest) > _version_tuple(installed))

    return json.dumps({
        'status': 'success',
        'installed': installed,
        'latest': latest,
        'update_available': update_available,
    })


@app.route('/ydl/update', methods=['POST'])
def ydl_update():
    global YDL_UPDATE_IN_PROGRESS

    with YDL_UPDATE_LOCK:
        if YDL_UPDATE_IN_PROGRESS:
            return json.dumps({'status': 'error', 'errmsg': 'An update is already in progress'})
        YDL_UPDATE_IN_PROGRESS = True

    try:
        proc = subprocess.run(
            [sys.executable, '-m', 'pip', 'install', '--upgrade', 'yt-dlp'],
            capture_output=True, text=True, timeout=180)
    except subprocess.TimeoutExpired:
        return json.dumps({'status': 'error', 'errmsg': 'Update timed out'})
    except OSError as e:
        return json.dumps({'status': 'error', 'errmsg': str(e)})
    finally:
        with YDL_UPDATE_LOCK:
            YDL_UPDATE_IN_PROGRESS = False

    if proc.returncode != 0:
        errmsg = (proc.stderr or proc.stdout or 'pip failed').strip()
        return json.dumps({'status': 'error', 'errmsg': errmsg[-800:]})

    installed = get_installed_ydl_version()
    _ydl_latest_cache['version'] = None  # force a fresh PyPI check next time

    return json.dumps({
        'status': 'success',
        'installed': installed,
        'message': 'yt-dlp updated to {}. Restart the server for every download to use it.'.format(installed),
    })


###
# test cases
###
@app.route('/test/<case>')
def test(case):
    return render_template('test/{}.html'.format(case))


class Server(Process):
    def __init__(self, msg_cli, host, port):
        super(Server, self).__init__()
        self.daemon = True

        self.msg_cli = msg_cli

        self.host = host
        self.port = port

    def run(self):
        global MSG
        MSG = self.msg_cli
        # threaded so a slow request (e.g. the yt-dlp pip upgrade) doesn't
        # stall the task-list polling every other client depends on
        app.run(host=self.host, port=int(self.port), use_reloader=False, threaded=True)
