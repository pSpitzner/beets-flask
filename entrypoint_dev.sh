#!/bin/sh

whoami
id
pwd
redis-server --daemonize yes &
pkill -f 'rq worker preview'
pkill -f 'rq worker import'

# Check if configs exist and copy if they dont
if [ ! -f /home/beetle/.config/beets/config.yaml ]; then
	    mkdir -p /home/beetle/.config/beets
	        cp /repo/configs/beets_default.yaml /home/beetle/.config/beets/config.yaml
fi

for i in $(seq 1 $NUM_WORKERS_PREVIEW)
do
  rq worker preview --log-format "Preview worker $i: %(message)s" > /dev/null &
done

for i in $(seq 1 $NUM_WORKERS_IMPORT)
do
  rq worker import --log-format "Import worker $i: %(message)s" > /dev/null &
done

redis-cli FLUSHALL

mkdir -p /repo/log
rm /repo/log/for_web.log

export FLASK_APP=beets_flask
export FLASK_ENV=development
export FLASK_DEBUG=1
flask run --host=0.0.0.0 --port=5001
# tail -f /dev/null
