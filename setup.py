#!/usr/bin/env python
# -*- coding: utf8 -*-

import re
import os

from setuptools import setup

DESCRIPTION = 'web UI for yt-dlp'
LONG_DESCRIPTION = 'A web UI for managing yt-dlp download tasks'

def read_version():
    init_path = os.path.join(os.path.dirname(__file__), 'youtube_dl_webui', '__init__.py')
    with open(init_path) as f:
        match = re.search(r"^__version__\s*=\s*['\"]([^'\"]+)['\"]", f.read(), re.M)
    return match.group(1)

setup (
        name='youtube_dl_webui',
        version=read_version(),
        packages=['youtube_dl_webui'],
        license='GPL-2.0',
        author='d0u9, yuanyingfeiyu',
        author_email='d0u9.su@outlook.com',
        description=DESCRIPTION,
        long_description=LONG_DESCRIPTION,
        include_package_data=True,
        zip_safe=False,
        install_requires=[
            'Flask>=1.0',
            'yt-dlp',
        ],
        entry_points={
            'console_scripts': [
                'youtube-dl-webui = youtube_dl_webui:main'
            ]
        },
)
