FROM python:3.11-alpine3.20 AS base

FROM base AS deps


RUN addgroup -g 1000 beetle && \
    adduser -D -u 1000 -G beetle beetle

ENV HOSTNAME="beets-container"

# map beets directory and our configs to /config
RUN mkdir -p /config/beets
RUN mkdir -p /config/beets-flask
RUN mkdir -p /logs
RUN chown -R beetle:beetle /config
RUN chown -R beetle:beetle /logs
ENV BEETSDIR="/config/beets"
ENV BEETSFLASKDIR="/config/beets-flask"
ENV BEETSFLASKLOG="/logs/beets-flask.log"

# our default folders they should not be used in production
RUN mkdir -p /music/inbox
RUN mkdir -p /music/imported
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
    shadow \
    git \
    ffmpeg


# Install backend dependencies

# Prevent __pycache__ directories
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1
# avoid creating a venv with uv, use system python
ENV UV_PROJECT_ENVIRONMENT="/usr/local/"

RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --no-cache-dir uv


WORKDIR /repo/backend
COPY ./backend/pyproject.toml /repo/backend/
COPY ./README.md /repo/

RUN uv sync --no-install-project

# Install our package (backend)
COPY ./backend/beets_flask/ /repo/backend/beets_flask/
COPY ./backend/generate_types.py /repo/backend/
COPY ./backend/launch_redis_workers.py /repo/backend/

RUN uv sync

# Extract version from pyproject.toml
RUN mkdir -p /version
RUN python -c "import tomllib; print(tomllib.load(open('/repo/backend/pyproject.toml', 'rb'))['project']['version'])" > /version/backend.txt

# ------------------------------------------------------------------------------------ #
#                                      Development                                     #
# ------------------------------------------------------------------------------------ #

FROM deps AS dev

RUN --mount=type=cache,target=/var/cache/apk \
    apk add \
    npm

RUN npm install -g pnpm
RUN pnpm config set store-dir /repo/frontend/.pnpm-store

# Copy the lock files and install dependencies
WORKDIR /repo
COPY ./frontend/package.json /repo/frontend/
COPY ./frontend/pnpm-lock.yaml /repo/frontend/

WORKDIR /repo/frontend
RUN pnpm i

# Extract version from package.json
RUN mkdir -p /version
RUN python -c "import json; print(json.load(open('/repo/frontend/package.json'))['version'])" \
    > /version/frontend.txt

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

# Extract version from package.json
RUN mkdir -p /version
RUN python -c "import json; print(json.load(open('/repo/frontend/package.json'))['version'])" \
    > /version/frontend.txt

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
COPY --from=build /version /version
COPY docker/entrypoints/entrypoint.sh .
COPY docker/entrypoints/entrypoint_user_scripts.sh .
COPY docker/entrypoints/entrypoint_fix_permissions.sh .
COPY docker/entrypoints/common.sh .
RUN chown -R beetle:beetle /repo

USER root

ENTRYPOINT [ \
    "/bin/sh", "-c", \
    "/repo/entrypoint_fix_permissions.sh && \
    /repo/entrypoint_user_scripts.sh && \
    su beetle -c /repo/entrypoint.sh" \
    ]


