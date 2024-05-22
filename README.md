# beets-flask

A self-hosted web-interface for the music organizer [beets](https://beets.io/)

## Features

- Create previews of an import
- Import albums from folders
- Monitor an inbox, where each album gets a preview automatically

## Setup

- Make a backup of your beets configs and library. This project is **early work in progress!**
- Clone the repo
- Adjust config files
- Build and run `docker compose up --build`, check for problems
- Once happy, you can run the container as a daemon with `docker compose up -d --build`

### Config

This is the container path layout, created with the default configs:
```
├── music
│   ├── inbox
│   ├── imported
│   └── last_beets_import.log
├── repo
│   └── log
│       └── for_web.log
└── home
    └── beetle # volume mount this to make your config and auth persistent
        └── .config
            └── beets
                └── config.yaml

```

#### To use your existing beets library

- Make a backup!
- Create volume mappings for beets config/library and music folders. Assuming this is your beets config at `/home/user/.config/beets/config.yaml`:
```
directory: /path/to/music/beets_data/
library: /home/user/.config/beets/library.db    # default location
```
then the volume mappings in the docker-compose file would need to be
```
volumes:
    - /home/user/.config/beets/:/home/beetle/.config/beets/
    - /path/to/music/:/path/to/music/
```
- Note that `/path/to/music/` needs to be consistent inside and outside of the container (and with your `directory` beets config) if you want to use the same beets library.

## Running

To login to the container to interact with beets from the command line:
```
docker exec -it beets-flask sh
```

