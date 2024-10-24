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

mkdir -p /repo/log
rm /repo/log/for_web.log >/dev/null 2>&1
rm /repo/frontend/vite.config.ts.timestamp-*.mjs >/dev/null 2>&1

mkdir -p /config/beets
mkdir -p /config/beets-flask

export FLASK_ENV=development
export FLASK_DEBUG=1

# ------------------------------------------------------------------------------------ #
#                                     start backend                                    #
# ------------------------------------------------------------------------------------ #

# running the server from inside the backend dir makes imports and redis easier
cd /repo/backend

redis-server --daemonize yes

python ./launch_redis_workers.py

redis-cli FLUSHALL

# we need to run with one worker for socketio to work (but need at least threads for SSEs)
# sufficient timout for the interactive import sessions, which may take a couple of minutes
gunicorn --worker-class eventlet -w 1 --threads 32  --timeout 300 --bind 0.0.0.0:5001 --reload 'main:create_app()'

# if we need to debug the continaer without running the webserver:
# tail -f /dev/null
