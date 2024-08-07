#!/bin/sh

whoami
id
pwd

cd /repo/frontend
# npm install
# npm run build:dev &
npm run dev &
# npm run build:watch &

cd /repo

NUM_WORKERS_PREVIEW=$(yq e '.gui.num_workers_preview' /home/beetle/.config/beets/config.yaml)
if ! [[ "$NUM_WORKERS_PREVIEW" =~ ^[0-9]+$ ]]; then
    NUM_WORKERS_PREVIEW=4
fi

mkdir -p /repo/log
rm /repo/log/for_web.log >/dev/null 2>&1
rm /repo/frontend/vite.config.ts.timestamp-*.mjs >/dev/null 2>&1

export FLASK_ENV=development
export FLASK_DEBUG=1

# ------------------------------------------------------------------------------------ #
#                                     start backend                                    #
# ------------------------------------------------------------------------------------ #

# running the server from inside the backend dir makes imports and redis easier
cd /repo/backend

redis-server --daemonize yes

for i in $(seq 1 $NUM_WORKERS_PREVIEW)
do
  rq worker preview --log-format "Preview worker $i: %(message)s" > /dev/null &
done

# imports are fast, because they use previously fetched previews. one worker should be enough.
NUM_WORKERS_IMPORT=1
for i in $(seq 1 $NUM_WORKERS_IMPORT)
do
  rq worker import --log-format "Import worker $i: %(message)s" > /dev/null &
done

redis-cli FLUSHALL

# we need to run with one worker for socketio to work (but need at least threads for SSEs)
# sufficient timout for the interactive import sessions, which may take a couple of minutes
gunicorn --worker-class eventlet -w 1 --threads 32  --timeout 300 --bind 0.0.0.0:5001 --reload 'main:create_app()'

# if we need to debug the continaer without running the webserver:
# tail -f /dev/null
