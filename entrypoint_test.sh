#!/bin/sh

whoami
id
pwd

cd /repo

redis-server --daemonize yes

python ./launch_redis_workers.py

redis-cli FLUSHALL

mkdir -p /repo/log
rm /repo/log/for_web.log >/dev/null 2>&1
rm /repo/frontend/vite.config.ts.timestamp-*.mjs >/dev/null 2>&1

mkdir -p /config/beets
mkdir -p /config/beets-flask

cp -f /repo/configs/example.yaml /config/beets-flask/example_config.yaml

pytest backend/beets_flask/tests/test_disk.py -vv
