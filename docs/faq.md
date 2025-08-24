# Frequently Asked Questions (FAQ)

## Archive support for 7z and rar files

Beets by default does not support 7z and rar files. However, you can enable support for these formats by installing the `unrar` and/or `py7zr` packages in your container. (See also [beets documentation](https://beets.readthedocs.io/en/stable/reference/cli.html#import)).

As we are running an alpine image this is not as straightforward as it sounds.

### `rar` support

To enable `rar` support, you can use the `unrar` binary from the [EDM115/unrar-alpine](https://github.com/EDM115/unrar-alpine) repository. This repository provides a precompiled `unrar` binary that is compatible with Alpine Linux.

```bash
# /config/startup.sh
apk add --no-cache curl jq


curl -LsSf https://api.github.com/repos/EDM115/unrar-alpine/releases/latest \
    | jq -r '.assets[] | select(.name == "unrar") | .id' \
    | xargs -I {} curl -LsSf https://api.github.com/repos/EDM115/unrar-alpine/releases/assets/{} \
    | jq -r '.browser_download_url' \
    | xargs -I {} curl -Lsf {} -o /tmp/unrar && \
    install -v -m755 /tmp/unrar /usr/local/bin

# You MUST install required libraries or else you'll run into linked libraries loading issues
apk add --no-cache libstdc++ libgcc
```

```txt
# /config/requirements.txt
rarfile
```

### `7z` support

To enable `7z` support, you can use the `py7zr` package, which also needs some shenanigans to install on Alpine Linux.

```bash
# /config/startup.sh
apk add gcc musl-dev linux-headers

# /config/requirements.txt
py7zr
```

## Troubleshooting and Debugging

A good starting point is to check the logs of the container. We can do this by running:

```bash
docker logs beets-flask
```

To get more detailed information, we can set environment variable of the container:

```yaml
services:
    beets-flask:
        environment:
            BEETSFLASKLOG: "/logs/beets-flask.log"
            LOG_LEVEL_BEETSFLASK: DEBUG
        volumes:
            - /path/to/logs/on/host:/logs
```

Which lets you increase the logs verbosity, and define where to put the logs.
