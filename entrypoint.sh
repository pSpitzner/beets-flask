#!/bin/sh

echo "Running as"
id

cd /repo

mkdir -p /repo/log
mkdir -p /config/beets
mkdir -p /config/beets-flask

# ------------------------------------------------------------------------------------ #
#                                     start backend                                    #
# ------------------------------------------------------------------------------------ #

# running the server from inside the backend dir makes imports and redis easier
cd /repo/backend

redis-server --daemonize yes

python ./launch_redis_workers.py

redis-cli FLUSHALL

# we need to run with one worker for socketio to work (but need at lesat threads for SSEs)
gunicorn --worker-class eventlet -w 1 --threads 32 --timeout 300 --bind 0.0.0.0:5001 'main:create_app()'
