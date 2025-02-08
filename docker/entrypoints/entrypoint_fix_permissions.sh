#!/bin/sh

if [ ! -z "$USER_ID" ] && [ ! -z "$GROUP_ID" ]; then
    echo "Updating UID to $USER_ID and GID to $GROUP_ID"
    groupmod -g $GROUP_ID beetle
    usermod -u $USER_ID -g $GROUP_ID beetle
    chown -R beetle:beetle /home/beetle
    chown -R beetle:beetle /repo
fi