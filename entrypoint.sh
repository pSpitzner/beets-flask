#!/bin/sh

# Check if configs exist and copy if they dont
if [ ! -f /home/beetle/.config/beets/config.yaml ]; then
	    mkdir -p /home/beetle/.config/beets
	        cp /repo/configs/beets_default.yaml /home/beetle/.config/beets/config.yaml
fi

mkdir -p /repo/log

# start redis and workers
redis-server --daemonize yes >/dev/null
rq worker preview --log-format '%(message)s'  --disable-job-desc-logging >/dev/null &
rq worker import --log-format '%(message)s'  --disable-job-desc-logging >/dev/null &

export FLASK_APP=beets_flask
flask run --host=0.0.0.0 --port=5001

