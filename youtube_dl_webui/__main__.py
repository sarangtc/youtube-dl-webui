#!/usr/bin/env python
# -*- coding: utf-8 -*-

from __future__ import unicode_literals

import sys
import os.path
import json
import logging.config

if __package__ is None and not hasattr(sys, 'frozen'):
    path = os.path.realpath(os.path.abspath(__file__))
    dirname = os.path.dirname(path)
    sys.path.insert(0, os.path.dirname(os.path.dirname(path)))
else:
    path = os.path.realpath(os.path.abspath(__file__))
    dirname = os.path.dirname(path)


import youtube_dl_webui

if __name__ == '__main__':
    # Setup logger
    logging_json = os.path.join(dirname, 'logging.json')
    with open(logging_json) as f:
        logging_conf = json.load(f)
    
    # Check FLASK_DEBUG environment variable to control logging level
    flask_debug = os.environ.get('FLASK_DEBUG', '0')
    if flask_debug == '0':
        # Set console handler to INFO level when not in debug mode
        logging_conf['handlers']['console']['level'] = 'INFO'
        logging_conf['loggers']['ydl_webui']['level'] = 'INFO'
    
    logging.config.dictConfig(logging_conf)

    youtube_dl_webui.main()

