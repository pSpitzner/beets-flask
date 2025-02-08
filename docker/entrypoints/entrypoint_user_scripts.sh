#!/bin/sh

# check for user startup scripts
if [ -f /config/startup.sh ]; then
    echo "Running user startup script"
    /config/startup.sh
fi

# check for requirements.txt
if [ -f /config/requirements.txt ]; then
    echo "Installing pip requirements"
    pip install -r /config/requirements.txt
fi
