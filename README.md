# beets-flask

An opinionated docker container for a web-interface around the music organizer [beets](https://beets.io/)


## Motivation

Importing music with beets could be more convenient. Beets identifies metadata correctly _most_ of the time, and in those cases, a single click should be enough to import.

This is the main idea with beets-flask: For all folders in your inbox, we generate a preview of what beets _would do_ and show you those previews. Then it's easy to go through them and import the correct ones, while falling back to terminal for those that were incorrect.

## Features

- Create previews before importing
- Import via GUI (if found matches are okay)
- Integrated Terminal for easy access to beets cli (to correct matches)
- Monitor inboxes, generate previews automatically
- Library view


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
└── home
    └── beetle
        ├── beets-flask-sqlite.db
        └── .config
            └── beets
                └── config.yaml

```

#### To use your existing beets library

- Make a backup!
- Create volume mappings for beets config & library and music folders. Assuming your beets config sits at `/home/user/.config/beets/config.yaml` and contains:
```yaml
directory: /path/to/music/beets_data/
library: /home/user/.config/beets/library.db    # default location
```
then the volume mappings in the docker-compose file would need to be
```yaml
volumes:
    - /home/user/.config/beets/:/home/beetle/.config/beets/
    - /path/to/music/:/path/to/music/
```
- Note that `/path/to/music/` needs to be consistent inside and outside of the container (and with your `directory` beets config) if you want to use the same beets library.
- To test the container, the easiest is to volume map the `beetle` user and copy your `~/.config/beets/` folder there (the container works with default locations for beets config and library). Then you have all in one place for troubleshooting:
```yaml
volumes:
    - /desired/path/containeruser/:/home/beetle/
    - /path/to/music/:/path/to/music/
```


### GUI Config

We added a `gui` section in the beets config to tweak the container and webfrontend:

```yaml
gui:
    library:
        readonly: no # disables importing and changes to library
        include_paths: yes # for the library-browsing (backend api)

    num_workers_preview: 4 # how many previews to generate in parallel

    tags:
        recent_days: 14 # Number of days to consider for the "recent" tag group

    inbox:
        # keep in mind to volume-map these folders in your docker-compose.yml
        folders:
            - name: 'Awesome inbox'
              path : '/music/inbox'
              autotag : no # no | "preview" | "import"
            - name: 'Dummy inbox'
              path : '/music/dummy'
              autotag : no
```

## Terminal

The container runs a tmux session that you can connect to from the host, or from the
webgui (bottom-right button or ``cmd/ctrl + ` ``).
To access the tmux from the host:
```
docker exec -it beets-flask /usr/bin/tmux attach-session -t beets-socket-term
```
Beware, you can close the tmux session, and we have not implemented a way to restart it.

## Roadmap

For the current state, there is a [KanBan board](https://github.com/users/pSpitzner/projects/2/views/1).

Major things that are planned:

- An ammend mechanic. This should allow the container to run imports automatically. Instead of approving, you would later correct imports that were identified incorrectly.
- An actual library view, with search, covers and audio preview. The backend is likely up for the task already.
- Push the image to dockerhub


# Developing

## Tech Stack

- Backend:
    - [Flask](https://flask.palletsprojects.com/en/3.0.x/) with some plugins
    - [Gunicorn](https://gunicorn.org/)
    - [Redis Queue](https://python-rq.org/)
- Frontend:
    - [React](https://react.dev/)
    - [Vite](https://vitejs.dev/)
    - [Tanstack router](https://tanstack.com/router/latest)
    - [MUI Core](https://mui.com/material-ui/all-components/)
    - [Radix-ui primitives](https://www.radix-ui.com/primitives/docs/overview/introduction)
    - [Lucide icons](https://lucide.dev/icons/)
- Terminal:
    - [xtermjs](https://xtermjs.org/)
    - [tmux](https://github.com/tmux/tmux/wiki)

## Notes

- The current docker-compose already creates the dev container:
    - maps `.repo` to edit the source from the host.
    - runs `entrypoint_dev.sh`, starting redis workers, flask, and the vite dev server
- It seems that our vite dev setup **does not work with safari** because it uses CORS

