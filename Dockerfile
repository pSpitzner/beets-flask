FROM python:3.11-alpine AS base

FROM base AS deps

ARG USER_ID
ARG GROUP_ID
ENV USER_ID=$USER_ID
ENV GROUP_ID=$GROUP_ID
RUN addgroup -g $GROUP_ID beetle && adduser -D -u $USER_ID -G beetle beetle

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
    imagemagick \
    redis  \
    git \
    bash \
    keyfinder-cli \
    npm \
    tmux

# Install our package (backend)
COPY ./backend /repo/backend
COPY ./README.md /repo/README.md
WORKDIR /repo/backend
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install .

# Install frontend
RUN corepack enable && corepack prepare pnpm@9.x.x --activate

# ------------------------------------------------------------------------------------ #
#                                      Development                                     #
# ------------------------------------------------------------------------------------ #

FROM deps AS dev

ENV IB_SERVER_CONFIG="dev_docker"

# relies on mounting this volume
WORKDIR /repo
USER beetle
ENTRYPOINT ["./entrypoint_dev.sh"]

# ------------------------------------------------------------------------------------ #
#                                        Testing                                       #
# ------------------------------------------------------------------------------------ #

FROM deps AS test

WORKDIR /repo
COPY --from=deps --chown=beetle:beetle /repo /repo
COPY entrypoint_test.sh .
ENV IB_SERVER_CONFIG="test"
USER beetle
ENTRYPOINT ["./entrypoint_test.sh"]

# ------------------------------------------------------------------------------------ #
#                                      Production                                      #
# ------------------------------------------------------------------------------------ #

FROM deps AS prod

ENV IB_SERVER_CONFIG="prod"

COPY --from=deps /repo /repo

WORKDIR /repo
COPY entrypoint.sh .
COPY ./frontend ./frontend/
COPY ./configs ./configs/
RUN chown -R beetle:beetle /repo

WORKDIR /repo/frontend
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install
RUN pnpm run build

WORKDIR /repo
USER beetle
ENTRYPOINT ["./entrypoint.sh"]
