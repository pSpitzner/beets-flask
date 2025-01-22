FROM python:3.11-alpine AS base

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

# our default folders they should not be used in production
RUN mkdir -p /music/inbox
RUN mkdir -p /music/imported
RUN chown -R beetle:beetle /music

# dependencies
RUN --mount=type=cache,target=/var/cache/apk \
    apk update
RUN --mount=type=cache,target=/var/cache/apk \
    apk add \
    build-base \
    imagemagick \
    redis  \
    git \
    bash \
    keyfinder-cli \
    npm \
    tmux \
    shadow

# Install our package (backend)
COPY ./backend /repo/backend
COPY ./README.md /repo/README.md
WORKDIR /repo/backend
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install .

# Install frontend
RUN npm i -g corepack
RUN corepack enable && corepack prepare pnpm@9.x.x --activate
RUN pnpm config set store-dir /repo/frontend/.pnpm-store

# ------------------------------------------------------------------------------------ #
#                                      Development                                     #
# ------------------------------------------------------------------------------------ #

FROM deps AS dev

ENV IB_SERVER_CONFIG="dev_docker"

# relies on mounting this volume
WORKDIR /repo
USER root
ENTRYPOINT ["./entrypoint_dev.sh"]

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
#                                      Production                                      #
# ------------------------------------------------------------------------------------ #

FROM deps AS build

COPY --from=deps /repo /repo

WORKDIR /repo
COPY ./frontend ./frontend/
RUN chown -R beetle:beetle /repo

USER beetle
WORKDIR /repo/frontend
# RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
RUN pnpm install
RUN pnpm run build

# ------------------------------------------------------------------------------------ #

FROM deps AS prod

ENV IB_SERVER_CONFIG="prod"

WORKDIR /repo
COPY --from=deps /repo /repo
COPY --from=build /repo/frontend/dist /repo/frontend/dist
COPY entrypoint.sh .
COPY entrypoint_fix_permissions.sh .
RUN chown -R beetle:beetle /repo

USER root
ENTRYPOINT ["/bin/sh", "-c", "./entrypoint_fix_permissions.sh && su beetle -c ./entrypoint.sh"]
