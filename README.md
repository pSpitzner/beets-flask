<!-- start intro -->
<p align="center">
    <h1 align="center">Beets Flask</h1>
</p>

[![version number](https://img.shields.io/github/package-json/v/pspitzner/beets-flask/main?filename=frontend%2Fpackage.json&label=version&color=blue)](https://github.com/pSpitzner/beets-flask/blob/main/CHANGELOG.md)
[![Docker Pulls](https://img.shields.io/docker/pulls/pspitzner/beets-flask)](https://hub.docker.com/r/pspitzner/beets-flask/tags)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?label=license)](https://opensource.org/licenses/MIT)
[![docker-hub build status](https://img.shields.io/github/actions/workflow/status/pSpitzner/beets-flask/docker_hub.yml?label=docker%20build)](https://github.com/pSpitzner/beets-flask/pkgs/container/beets-flask)
[![Documentation Status](https://readthedocs.org/projects/beets-flask/badge/?version=latest)](https://beets-flask.readthedocs.io/en/latest/?badge=latest)

<p align="center">
    <em><b>Opinionated web-interface around the music organizer <a href="https://beets.io/">beets</a></b></em>
</p>

<!-- end intro -->

## Features

<!-- start features -->

-   Autogenerate previews before importing
-   Auto-Import good matches
-   Import via GUI
-   Undo imports
-   Web-Terminal
-   Monitor multiple inboxes
-   Library view and search

<!-- end features -->

https://github.com/user-attachments/assets/dd526b9d-9351-4f7c-9034-1071e4ff66e6

## Motivation

<!-- start motivation -->

Autotagging music with beets is great. Beets identifies metadata correctly _most_ of the time, and if you are not a control-freak, there is hardly any reason to check the found metadata.

However, if you do want a bit more control, things could be more convenient.

This is the main idea with beets-flask: For all folders in your inbox, we generate a preview of what beets _would do_ and show you those previews. Then it's easy to go through them and import the correct ones, or pick other candidates for those that were not to your liking.

<!-- end motivation -->

## Quickstart

We provide a docker image with the full beeets-flask setup. You can run it with docker-compose or docker. We recommend using the `stable` tag, alternatively you may use `latest` for the most recent build.

### Setup container

**Using docker**

```sh
docker run -d -p 5001:5001 \
    -e TZ=Europe/Berlin \
    -e USER_ID=1000 \
    -e GROUP_ID=1000 \
    -v /wherever/config/:/config \
    -v /music_path/inbox/:/music_path/inbox/ \
    -v /music_path/clean/:/music_path/clean/ \
    --name beets-flask \
    pspitzner/beets-flask:stable
```

**Using docker compose**

```yaml
services:
    beets-flask:
        image: pspitzner/beets-flask:stable
        restart: unless-stopped
        ports:
            - "5001:5001"
        environment:
            # 502 is default on macos, 1000 on linux
            TZ: Europe/Berlin
            USER_ID: 1000
            GROUP_ID: 1000
        volumes:
            - /wherever/config/:/config
            # for music folders, match paths inside and out of container!
            - /music_path/inbox/:/music_path/inbox/
            - /music_path/clean/:/music_path/clean/
```

This will create a container with the following folder structure:

```
├── music_path
│   ├── inbox
│   └── clean
└── config
    ├── beets
    │   ├── config.yaml
    │   └── library.db
    └── beets-flask
        ├── config.yaml
        └── beets-flask-sqlite.db
```

Check our [**documentation**](https://beets-flask.readthedocs.io/en/latest/) for more information!
