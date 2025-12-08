#!/bin/bash

# this script runs both, in dev and in prod, so we have to check where we
# can source common.sh from.
if [ -f ./common.sh ]; then
    source ./common.sh
elif [ -f ./docker/entrypoints/common.sh ]; then
    source ./docker/entrypoints/common.sh
fi

if [ ! -z "$USER_ID" ] && [ ! -z "$GROUP_ID" ]; then
    log "Fixing permissions as '$(whoami)' with UID $(id -u) and GID $(id -g)"
    log "Setting beetle user to $USER_ID:$GROUP_ID"
    groupmod -g $GROUP_ID beetle
    usermod -u $USER_ID -g $GROUP_ID beetle > /dev/null 2>&1
    log "User beetle now has $(id beetle)"
    find /home/beetle ! -user beetle -exec chown beetle:beetle {} +
    find /logs ! -user beetle -exec chown beetle:beetle {} +
    find /repo ! -user beetle -exec chown beetle:beetle {} +
    log "Done fixing permissions"
else
    log "No USER_ID and GROUP_ID set, skipping permission updates"
fi

# add groups
if [ -f ./entrypoint_add_groups.sh ]; then
    source ./entrypoint_add_groups.sh
elif [ -f ./docker/entrypoints/entrypoint_add_groups.sh ]; then
    source ./docker/entrypoints/entrypoint_add_groups.sh
fi
