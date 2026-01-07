#!/bin/bash
SCRIPT_DIR=$(dirname "$0")
. "$SCRIPT_DIR/common.sh"

export PIP_DISABLE_PIP_VERSION_CHECK=1
export PIP_ROOT_USER_ACTION=ignore

VENV_PY="/repo/backend/.venv/bin/python"

ensure_backend_pip() {
    if [ ! -x "$VENV_PY" ]; then
        log "ERROR: backend venv python not found or not executable at $VENV_PY"
        return 1
    fi

    # If pip is missing in the venv, try to bootstrap it via ensurepip.
    if ! "$VENV_PY" -m pip --version >/dev/null 2>&1; then
        log "pip missing in backend venv; bootstrapping via ensurepip"
        "$VENV_PY" -m ensurepip --upgrade >/dev/null 2>&1 || true
    fi

    # Guardrail: refuse to continue if pip still isn't available in the venv.
    "$VENV_PY" -m pip --version >/dev/null 2>&1 || {
        log "ERROR: pip is not available in backend venv (/repo/backend/.venv). Refusing to install requirements outside the venv."
        return 1
    }
}

install_requirements() {
    local req_file="$1"
    log "Installing pip requirements from $req_file"
    ensure_backend_pip || return 1
    "$VENV_PY" -m pip install --no-cache-dir -r "$req_file"
}

# check for user startup scripts
if [ -f /config/startup.sh ]; then
    log "Running user startup script from /config/startup.sh"
    /config/startup.sh
fi
if [ -f /config/beets-flask/startup.sh ]; then
    log "Running user startup script from /config/beets-flask/startup.sh"
    /config/beets-flask/startup.sh
fi

# check for requirements.txt
if [ -f /config/requirements.txt ]; then
    install_requirements /config/requirements.txt || exit 1
fi
if [ -f /config/beets-flask/requirements.txt ]; then
    install_requirements /config/beets-flask/requirements.txt || exit 1
fi
