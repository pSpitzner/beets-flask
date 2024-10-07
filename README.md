# beets-flask

An opinionated docker container for a web-interface around the music organizer [beets](https://beets.io/)


## Motivation

Autotagging music with beets is great. Beets identifies metadata correctly _most_ of the time, and if you are not a control-freak, there is hardly any reason to check the found metadata.

However, if you do want a bit more control, things could be more convenient.

This is the main idea with beets-flask: For all folders in your inbox, we generate a preview of what beets _would do_ and show you those previews. Then it's easy to go through them and import the correct ones, while falling back to terminal for those that were not to your liking.

## Features

- Autogenerate previews before importing
- Import via GUI (if found matches are okay)
- Import via Web-Terminal using beets as you know it (to correct matches)
- Undo imports
- Monitor multiple inboxes
- A basic library view and search
- Most File/Tag actions sit in a context menu (right-click, or long-press on touch)

![demo gif](https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExcDZmZjJ0NzA0Z3h4Z2tycnBlMG1mbm9mMXFoMWM1bjJwdDBsOXR1NiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/Z3lL2fo5m6UNf85dZT/giphy.gif)

## Setup

- Make a backup of your beets configs and library. This project is **early work in progress!**
- Clone the repo
- Adjust config files
- Place a folder with music files into your inbox
- Build and run `docker compose up --build`
- Check the webinterface, by default at `http://localhost:5001`
- Once happy, you can run the container as a daemon with `docker compose up -d --build`

### Config

This is the container path layout, created with the default configs:
```
├── music
│   ├── inbox
│   └── imported
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
- Because the GUI provides easy ways to clean your inbox, we suggest to set the beets import setting to `copy`. Also needed if you want to undo an import to correct it (which deletes files from the library).
```yaml
import:
    copy: yes
```


### GUI Config

We added a `gui` section in the beets config to tweak the container and webfrontend.

Config changes currently require a container restart.

```yaml
gui:
    num_workers_preview: 4 # how many previews to generate in parallel

    library:
        readonly: no

    tags:
        expand_tags: yes # for tag groups, on page load, show tag details?
        recent_days: 14 # Number of days to consider for the "recent" tag group
        order_by: "name" # how to sort tags within the trag groups: "name" (the album folder basename) | "date_created" | "date_modified"

    terminal:
        start_path: "/music/inbox" # the directory where to start new terminal sessions

    inbox:
        concat_nested_folders: yes # show multiple folders in one line if they only have one child
        expand_files: no # on page load, show files in (album) folders, or collapse them

        folders: # keep in mind to volume-map these folders in your docker-compose.yml
            Inbox:
                name: "Inbox"
                path: "/music/inbox"
                autotag: no # no | "preview" | "import" | "auto"
```

## Terminal

The container runs a tmux session that you can connect to from the host, or from the webgui (bottom-right button or ``cmd/ctrl + ` ``).
To access the tmux from the host:
```
docker exec -it beets-flask /usr/bin/tmux attach-session -t beets-socket-term
```

If you use iTerm on macOS and want to create a profile for connecting to the tmux session natively:
```
ssh -t yourserver "/usr/bin/docker exec -it beets-flask /usr/bin/tmux -CC new -A -s beets-socket-term"
```

## Roadmap

For the current state, there is a [KanBan board](https://github.com/users/pSpitzner/projects/2/views/1).

Major things that are planned:

- Better library view, improved cover handling and audio preview.
- Push the image to dockerhub
- Mobile friendly (started)


# Developing

The current state is pretty much a playground. Only essential features are included, but most tools are in place to easily add whatever you feel like.

## Tech Stack

- Backend:
    - [Flask](https://flask.palletsprojects.com/en/3.0.x/) with some plugins
    - [Gunicorn](https://gunicorn.org/)
    - [Redis Queue](https://python-rq.org/)
    - [SQLite via SQLAlchemy](https://docs.sqlalchemy.org/en/20/)
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

## Notes, Design Choices and Ideas

- See [docker-compose-dev.yaml](/docker-compose-dev.yaml) to createe the dev container:
    - maps `.repo` to edit the source from the host.
    - runs `entrypoint_dev.sh`, starting redis workers, flask, and the vite dev server
- It seems that our vite dev setup **does not work with safari** because it uses CORS

### Previews and Imports

The big question is how to get a sensible gui for autotagging music. At some point, user-interaction is required. The aim is here to make this seamless. Via the CLI, we have to wait for each item to fetch the meta data, before we can confirm (or just trust beets, giving up control).

Therefore, here, we automatically generate a `preview` for every album in the inbox. Then, the user can quickly skim all of them, and `import` those that are to their liking. For each preview, we generate a `tag` entry in the sqlite database, that is referenced when importing to avoid looking up the meta-data again (we use the existing `search_ids`).

`preview` and `import` are the main two tasks ("kind" of job) in the backend.
For each we have subclassed the beets ImportSession (see [beets_sessions.py](/backend/beets_flask/beets_sessions.py) and [invoker.py](/backend/beets_flask/invoker.py)). They overwrite some methods and the config to grab the data needed for the webinterface. Currently, we mainly keep a status and the preview that closely resembles the cli output. Finegrained details and web rendering should be easy to add as needed.

Both are delegated to separate redis queues / workers, so previews can be generated while an import session runs.


### Tags

A `tag` is what we store to sqlite, it is the basic data associated with the import or preview of one album. (It has details like the status, path on disk, a unique id ...).
Tags in the database are updated by the workers, and can be read independently via the web backend/frontend.

Keeping a `tag` associated with a preview/import around, will also enable an _amend_ mechanic. The plan here is to just import if the match is good (respecting the normal beets config) and to store the id of our tag as a note in the beets database. Then, if a correction is needed, we can query and delete via the import-tag-id and re-import with corrections.

Currently we can at least undo an import. We add a `gui_import_id` field to the beets db, which we use to query and delete corresponding files.

### Tag Groups

The aim of tag groups is to get some order into the previews / imports. Currently we have:

- Inbox: still have a folder in an inbox
- Recent: have been modified recently
- Archive: Tags that have been imported already
- Unsorted: currently corresponds to all tags (we have 'manual tag groups' in the backend, but no way to set them yet)

### Status updates

We use a websocket (for the terminal and) to push updates from the server when information of a tag changes. The general order here is: i) worker creates or updates tag, ii) worker writes tag to db iii) worker triggers queryinvalidation in the react frontend iv) we requery from backend and db.

The websocket should also allow for a GUI import-session, where in the simplest form, we replace terminal input (keys) with buttons.

### Library

The library view backend is adapted from the existing beets webplugin that is also built on flask.


### Testing

We have started on a version of the container that runs some (backend) tests, but coverage is pretty non-existent.


### Convention for typescript imports

We have an eslint sorting rule for imports:

Order:
1. other modules/components
2. our modules/components
3. css (first others, then ours)

Try to use absolute paths with `@/` prefix if not in the same folder.
