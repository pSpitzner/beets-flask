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
rm /repo/log/for_web.log
rm /repo/frontend/vite.config.ts.timestamp-*.mjs

export FLASK_ENV=development
export FLASK_DEBUG=1
# waitress does not restart automatically, and for me watchmedo did not work -> use tail -f and manually (re)start the server via docker exec
waitress-serve --call --port=5001 'main:create_app'
# watchmedo auto-restart -d . -p '*.py' -- waitress-serve --call --port=5001 'main:create_app'
# python main.py
# tail -f /dev/null
