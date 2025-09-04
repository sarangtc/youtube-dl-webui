#!/usr/bin/env python
# -*- coding: utf8 -*-

from setuptools import setup

DESCRIPTION = 'webui for yt-dlp'
LONG_DESCRIPTION = 'Another webui for yt-dlp, powered by yt-dlp'

setup (
        name='youtube_dl_webui',
        version='rolling',
        packages=['youtube_dl_webui'],
        license='GPL-2.0',
        author='d0u9, yuanyingfeiyu',
        author_email='d0u9.su@outlook.com',
        description=DESCRIPTION,
        long_description=LONG_DESCRIPTION,
        include_package_data=True,
        zip_safe=False,
        install_requires=[
            'Flask>=1.1',
            'yt-dlp>=2024.3.10',
        ],
        entry_points={
            'console_scripts': [
                'youtube-dl-webui = youtube_dl_webui:main'
            ]
        },
)
