FROM python:3.11-alpine as base

FROM base as deps

ARG USER_ID
ARG GROUP_ID
ENV USER_ID=$USER_ID
ENV GROUP_ID=$GROUP_ID
RUN addgroup -g $GROUP_ID beetle && adduser -D -u $USER_ID -G beetle beetle
WORKDIR /repo

# dependencies
COPY requirements.txt .
RUN --mount=type=cache,target=/var/cache/apk \
    apk --no-cache update
RUN --mount=type=cache,target=/var/cache/apk \
    apk --no-cache add imagemagick redis git bash keyfinder-cli npm
RUN --mount=type=cache,target=/root/.cache/pip \
pip3 install -r requirements.txt


# Install bootstrap styles, cache with docker for offline dev
VOLUME /repo/static
RUN mkdir -p /repo/static/bootstrap
RUN --mount=type=cache,target=/repo/static/bootstrap \
    wget https://github.com/twbs/bootstrap/raw/v5.3.3/dist/css/bootstrap.min.css -O /repo/static/bootstrap/bootstrap.min.css
RUN --mount=type=cache,target=/repo/static/bootstrap \
    wget https://github.com/twbs/bootstrap/raw/v5.3.3/dist/js/bootstrap.bundle.min.js -O /repo/static/bootstrap/bootstrap.bundle.min.js
RUN --mount=type=cache,target=/repo/static \
    wget https://github.com/twbs/icons/releases/download/v1.11.3/bootstrap-icons-1.11.3.zip -O /repo/icons.zip && \
    unzip -o /repo/icons.zip -d /repo/static/ && \
    rm -rf /repo/static/bootstrap-icons && \
    mv /repo/static/bootstrap-icons-1.11.3 /repo/static/bootstrap-icons && \
    rm /repo/icons.zip

FROM deps as dev

WORKDIR /repo
COPY --from=deps /repo /repo
COPY entrypoint_dev.sh .
RUN chown -R beetle:beetle /repo
RUN chmod +x ./entrypoint_dev.sh

# we copy config files in the script, so they can be put into mounted volumes
USER beetle
ENTRYPOINT ["./entrypoint_dev.sh"]

FROM deps as test

WORKDIR /repo
COPY --from=deps /repo /repo
COPY entrypoint_test.sh .
RUN mkdir -p /music/inbox
RUN chown -R beetle:beetle /music/inbox
RUN chown -R beetle:beetle /repo
RUN chmod +x ./entrypoint_test.sh
USER beetle
ENTRYPOINT ["./entrypoint_test.sh"]


FROM deps as prod

WORKDIR /repo
COPY --from=deps /repo /repo
COPY . .
RUN chown -R beetle:beetle /repo
RUN chmod +x ./entrypoint.sh

USER beetle
ENTRYPOINT ["./entrypoint.sh"]

