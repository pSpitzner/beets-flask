#!/bin/sh
echo "Running as"
id

cd /repo

NUM_WORKERS_PREVIEW=$(yq e '.gui.num_workers_preview' /home/beetle/.config/beets/config.yaml)
if ! [[ "$NUM_WORKERS_PREVIEW" =~ ^[0-9]+$ ]]; then
    NUM_WORKERS_PREVIEW=4
fi

mkdir -p /repo/log

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

# we need to run with one worker for socketio to work (but need at lesat threads for SSEs)
gunicorn --worker-class eventlet -w 1 --threads 32 --timeout 300 --bind 0.0.0.0:5001 'main:create_app()'
