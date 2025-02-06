<!-- start intro -->
<p align="center">
    <h1 align="center">Beets Flask</h1>
</p>

[![version number](https://img.shields.io/github/package-json/v/pspitzner/beets-flask/main?filename=frontend%2Fpackage.json&label=version&color=blue)](https://github.com/pSpitzner/beets-flask/blob/main/CHANGELOG.md)
[![docker-hub status](https://img.shields.io/github/actions/workflow/status/pSpitzner/beets-flask/docker_hub.yml?label=docker%20build)](https://github.com/pSpitzner/beets-flask/pkgs/container/beets-flask)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?label=license)](https://opensource.org/licenses/MIT)

<p align="center">
    <em><b>Opinionated web-interface around the music organizer <a href="https://beets.io/">beets</a></b></em>
</p>

<!-- end intro -->

## Features

<!-- start features -->

-   Autogenerate previews before importing
-   Import via GUI
-   Web-Terminal
-   Undo imports
-   Monitor multiple inboxes
-   Library view and search

<!-- end features -->

https://github.com/user-attachments/assets/dd526b9d-9351-4f7c-9034-1071e4ff66e6

## Quickstart

We provide a docker image with the full beeets-flask setup. You can run it with docker-compose or docker. We recommend using the `stable` tag, alternatively you may use `latest` for the most recent build.

### Setup container

**Using docker**

```sh
docker run -d -p 5001:5001 \
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

### Edit configs

On first container launch, config files are automatically generated in the specified config folder.
As the minimum, you need to update the information about your music folders.
Configurations are read from `config/beets/config.yaml` and `config/beets-flask/config.yaml` (the latter takes precedence).

```yaml
# config/beets/config.yaml
directory: /music_path/clean/
```

Restart the container to apply changes:

```sh
docker restart beets-flask
```

See all [config options](#config) (and how to use your existing library) below.

## Motivation

Autotagging music with beets is great. Beets identifies metadata correctly _most_ of the time, and if you are not a control-freak, there is hardly any reason to check the found metadata.

However, if you do want a bit more control, things could be more convenient.

This is the main idea with beets-flask: For all folders in your inbox, we generate a preview of what beets _would do_ and show you those previews. Then it's easy to go through them and import the correct ones, while falling back to terminal for those that were not to your liking.

## Configuration

-   We have a `gui` section in the beets-flask config to tweak the container and webfrontend.
-   Place GUI settings in `config/beets-flask/config.yaml`. If you configure other fields (out of the parent `gui`) they take precedence over the beets config. This might be useful when you want different settings for beets CLI vs the beets GUI.
-   Opinionated [examples](./backend/beets_flask/config/config_bf_example.yaml) are copied to `config/beets/config.yaml` and `config/beets-flask/config.yaml` on container launch.
-   Config changes require a container restart to take effect.

### To use your existing beets library

-   **Make a backup!** Your config folder `~/.config/beets/` should be the minimum.
-   In your docker compose, create volume mappings for config and media folders.

```yaml
# docker-compose.yml
volumes:
    - ~/.config/beets/:/config/beets/
    - ~/.config/beets-flask/:/config/beets-flask/
    - /music_path/clean/:/music_path/clean/
```

-   Make sure that the `library` location in your beets `config.yaml` is either set to the path _inside_ the container, or not specified (the default will work).
-   Note that `/music_path/clean/` needs to be consistent inside and outside of the container. Otherwise beets will not be able to manage files consistently. For instance if your music is in `/home/user/music/`, you should mount with `/home/user/music/:/home/user/music/`.

### To start from scratch or with a copy of your existing library

-   In your docker compose, mount a fresh config folder

```yaml
# docker-compose.yml
volumes:
    - /music_path/config/:/config/
    - /music_path/inbox/:/music_path/inbox/
    - /music_path/imported/:/music_path/imported/
```

-   Start the container, and you will find some files placed in the mounted config folder.
-   Either start customizing a config here, or copy content from your `~/.config/beets/` to `/music_path/config/beets/`

## Roadmap

For the current state, there is a [KanBan board](https://github.com/users/pSpitzner/projects/2/views/1).

Currently planned:

-   Better library view, audio preview, and actions.
-   Rewrite for async backend (quart)
-   Use our fancy web view for auto-generated tag previews
-   Cache candidates for auto-generated tag previews to choose later (without needing an interactive session)
-   Notifications for new imports on mobile devices (Installable PWA)

# Developer Guide & Contribution

Please see [CONTRIBUTE.md](.docs/contribution.md) for more information on how to contribute.
