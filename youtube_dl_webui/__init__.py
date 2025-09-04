#!/usr/bin/env python
# -*- coding: utf-8 -*-

from __future__ import unicode_literals
from argparse import ArgumentParser

from .core import Core

def getopt(argv):
    parser = ArgumentParser(description='Another webui for yt-dlp')

    parser.add_argument('-c', '--config', metavar="CONFIG_FILE", help="config file")
    parser.add_argument('--host', metavar="ADDR", help="the address server listens on")
    parser.add_argument('--port', metavar="PORT", help="the port server listens on")

    return vars(parser.parse_args())


def main(argv=None):
    from os import getpid
    import logging.config
    import os.path

    # Setup logging configuration early, before any loggers are created
    dirname = os.path.dirname(os.path.abspath(__file__))
    logging_json = os.path.join(dirname, 'logging.json')
    
    try:
        with open(logging_json) as f:
            import json
            logging_conf = json.load(f)
        
        # Check FLASK_DEBUG environment variable to control logging level
        flask_debug = os.environ.get('FLASK_DEBUG', '0')
        if flask_debug == '0':
            # Set console handler to INFO level when not in debug mode
            logging_conf['handlers']['console']['level'] = 'INFO'
            logging_conf['loggers']['ydl_webui']['level'] = 'INFO'
        
        logging.config.dictConfig(logging_conf)
    except Exception as e:
        print(f"Warning: Could not load logging config: {e}")
        # Fallback to basic logging configuration
        logging.basicConfig(level=logging.INFO if os.environ.get('FLASK_DEBUG', '0') == '0' else logging.DEBUG)

    print("pid is {}".format(getpid()))
    print("-----------------------------------")

    cmd_args = getopt(argv)
    core = Core(cmd_args=cmd_args)
    core.start()
