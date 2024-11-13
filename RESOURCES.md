# Resources

Here you can find some resources that might be useful and interesting for developer, contributors or advanced users.

## Tech Stack

-   Backend:
    -   [Flask](https://flask.palletsprojects.com/en/3.0.x/) with some plugins
    -   [Gunicorn](https://gunicorn.org/)
    -   [Redis Queue](https://python-rq.org/)
    -   [SQLite via SQLAlchemy](https://docs.sqlalchemy.org/en/20/)
-   Frontend:
    -   [React](https://react.dev/)
    -   [Vite](https://vitejs.dev/)
    -   [Tanstack router](https://tanstack.com/router/latest)
    -   [MUI Core](https://mui.com/material-ui/all-components/)
    -   [Radix-ui primitives](https://www.radix-ui.com/primitives/docs/overview/introduction)
    -   [Lucide icons](https://lucide.dev/icons/)
-   Terminal:
    -   [xtermjs](https://xtermjs.org/)
    -   [tmux](https://github.com/tmux/tmux/wiki)

## Environment variables

**undergoing changes, in progress**

```
IB_GUI_CONFIG_PATH # path to gui yaml, should you desire to place it config elsewhere than in the BEETSFLASKDIR

# set by in the container, should not be changed
IB_SERVER_CONFIG # prod | dev_local | dev_docker | test
BEETSDIR="/config/beets"
BEETSFLASKDIR="/config/beets-flask"
```

## Notes, Design Choices and Ideas

-   See [docker-compose-dev.yaml](/docker-compose-dev.yaml) to createe the dev container:
    -   maps `.repo` to edit the source from the host.
    -   runs `entrypoint_dev.sh`, starting redis workers, flask, and the vite dev server
-   It seems that our vite dev setup **does not work with safari** because it uses CORS

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

-   Inbox: still have a folder in an inbox
-   Recent: have been modified recently
-   Archive: Tags that have been imported already
-   Unsorted: currently corresponds to all tags (we have 'manual tag groups' in the backend, but no way to set them yet)

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

## Terminal

The container runs a tmux session that you can connect to from the host, or from the webgui (bottom-right button or `` cmd/ctrl + `  ``).
To access the tmux from the host:

```
docker exec -it beets-flask /usr/bin/tmux attach-session -t beets-socket-term
```

If you use iTerm on macOS and want to create a profile for connecting to the tmux session natively:

```
ssh -t yourserver "/usr/bin/docker exec -it beets-flask /usr/bin/tmux -CC new -A -s beets-socket-term"
```
