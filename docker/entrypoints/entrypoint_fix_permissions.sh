#!/bin/sh

if [ ! -z "$USER_ID" ] && [ ! -z "$GROUP_ID" ]; then
    groupmod -g $GROUP_ID beetle
    usermod -u $USER_ID -g $GROUP_ID beetle > /dev/null 2>&1
    chown -R beetle:beetle /home/beetle
    chown -R beetle:beetle /repo
    chown -R beetle:beetle /logs
fi
