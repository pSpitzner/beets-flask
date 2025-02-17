FROM python:3.11-alpine3.20 AS base

FROM base AS deps


RUN addgroup -g 1000 beetle && \
    adduser -D -u 1000 -G beetle beetle

ENV HOSTNAME="beets-container"

# map beets directory and our configs to /config
RUN mkdir -p /config/beets
RUN mkdir -p /config/beets-flask
RUN chown -R beetle:beetle /config
ENV BEETSDIR="/config/beets"
ENV BEETSFLASKDIR="/config/beets-flask"
ENV LOG_FILE_WEB="/repo/log/web.log"

# our default folders they should not be used in production
RUN mkdir -p /music/inbox
RUN mkdir -p /music/imported
RUN mkdir -p /repo/log
RUN chown -R beetle:beetle /music

# dependencies
# RUN --mount=type=cache,target=/var/cache/apk \
RUN apk update
RUN --mount=type=cache,target=/var/cache/apk \
    apk add \
    imagemagick \
    redis  \
    bash \
    tmux \
    shadow

# Install our package (backend)
COPY ./backend /repo/backend
COPY ./README.md /repo/README.md
WORKDIR /repo/backend
# Prevent __pycache__ directories
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --no-cache-dir .


# ------------------------------------------------------------------------------------ #
#                                      Development                                     #
# ------------------------------------------------------------------------------------ #

FROM deps AS dev

RUN --mount=type=cache,target=/var/cache/apk \
    apk add \
    npm

RUN npm install -g pnpm
RUN pnpm config set store-dir /repo/frontend/.pnpm-store

ENV IB_SERVER_CONFIG="dev_docker"

# relies on mounting this volume
WORKDIR /repo
USER root
ENTRYPOINT ["./docker/entrypoints/entrypoint_dev.sh"]

# ------------------------------------------------------------------------------------ #
#                                        Testing                                       #
# ------------------------------------------------------------------------------------ #

FROM deps AS test

WORKDIR /repo
COPY --from=deps --chown=beetle:beetle /repo /repo
COPY entrypoint_test.sh .
ENV IB_SERVER_CONFIG="test"
USER root
ENTRYPOINT ["./entrypoint_test.sh"]

# ------------------------------------------------------------------------------------ #
#                                         Build                                        #
# ------------------------------------------------------------------------------------ #

FROM deps AS build
# Build frontend files

RUN --mount=type=cache,target=/var/cache/apk \
    apk add \
    npm

RUN npm install -g pnpm
RUN pnpm config set store-dir /repo/frontend/.pnpm-store

WORKDIR /repo
COPY ./frontend ./frontend/
RUN chown -R beetle:beetle /repo

USER beetle
WORKDIR /repo/frontend
# RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
RUN pnpm install
RUN pnpm run build

# ------------------------------------------------------------------------------------ #
#                                      Production                                      #
# ------------------------------------------------------------------------------------ #

FROM deps AS prod

ENV IB_SERVER_CONFIG="prod"

WORKDIR /repo
COPY --from=build /repo/frontend/dist /repo/frontend/dist
COPY docker/entrypoints/entrypoint.sh .
COPY docker/entrypoints/entrypoint_user_scripts.sh .
COPY docker/entrypoints/entrypoint_fix_permissions.sh .
RUN chown -R beetle:beetle /repo

USER root

ENTRYPOINT [ \
    "/bin/sh", "-c", \
    "/repo/entrypoint_fix_permissions.sh && \
    /repo/entrypoint_user_scripts.sh && \
    su beetle -c /repo/entrypoint.sh" \
    ]


