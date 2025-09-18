#!/bin/sh

# check for user startup scripts
if [ -f /config/startup.sh ]; then
    echo "Running user startup script from /config/startup.sh"
    /config/startup.sh
fi
if [ -f /config/beets-flask/startup.sh ]; then
    echo "Running user startup script from /config/beets-flask/startup.sh"
    /config/startup.sh
fi


# check for requirements.txt
if [ -f /config/requirements.txt ]; then
    echo "Installing pip requirements from /config/requirements.txt"
    pip install -r /config/requirements.txt
fi
if [ -f /config/beets-flask/requirements.txt ]; then
    echo "Installing pip requirements from /config/beets-flask/requirements.txt"
    pip install -r /config/beets-flask/requirements.txt
fi
