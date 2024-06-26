#!/bin/sh

whoami
id
pwd

cd /repo/frontend
npm install
# npm run build:dev &
npm run dev &
# npm run build:watch &

cd /repo

redis-server --daemonize yes

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
rm /repo/log/for_web.log >/dev/null 2>&1
rm /repo/frontend/vite.config.ts.timestamp-*.mjs >/dev/null 2>&1

export FLASK_ENV=development
export FLASK_DEBUG=1


# we need to run with one worker for socketio to work (but need at lesat threads for SSEs)
gunicorn --worker-class eventlet -w 1 --threads 32 --bind 0.0.0.0:5001 --reload 'main:create_app()'

# tail -f /dev/null
