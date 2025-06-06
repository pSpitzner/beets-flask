# macOS

Developing on a macOS host might have some quirks.

-   Quart-reloading works by monitoring for file changes, which might be broken depending on docker-desktops volume-mount driver.
-   pnpm packages need to be installed from within the container. Installing them natively on the host-side might get you versions that dont work in the container. `docker exec -it -u beetle beets-flask-dev bash`
-   but pytest, ruff and mypy should works directly on the host :)

## iTerm tmux

You can use iTerms tmux support to natively connect to the session that we have running in the beets container. Simply create a new iterm profile with the following start command:

```
ssh -t  your_server "/usr/bin/docker exec -it -u beetle beets-flask /usr/bin/tmux -CC new -A -s beets-socket-term"
```
