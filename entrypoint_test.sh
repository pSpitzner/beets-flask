#!/bin/sh

whoami
id
pwd

cd /repo

redis-server --daemonize yes

NUM_WORKERS_PREVIEW=$(yq e '.gui.num_workers_preview' /home/beetle/.config/beets/config.yaml)
if ! [[ "$NUM_WORKERS_PREVIEW" =~ ^[0-9]+$ ]]; then
    NUM_WORKERS_PREVIEW=4
fi

for i in $(seq 1 $NUM_WORKERS_PREVIEW)
do
  # also for tests redirect to /dev/null, otherwise, test printout gets scrambled
  rq worker preview --log-format "Preview worker $i: %(message)s" > /dev/null &
done

NUM_WORKERS_IMPORT=1
for i in $(seq 1 $NUM_WORKERS_IMPORT)
do
  rq worker import --log-format "Import worker $i: %(message)s" > /dev/null &
done

redis-cli FLUSHALL

mkdir -p /repo/log
rm /repo/log/for_web.log >/dev/null 2>&1
rm /repo/frontend/vite.config.ts.timestamp-*.mjs >/dev/null 2>&1


pytest backend/beets_flask/tests/test_disk.py -vv
