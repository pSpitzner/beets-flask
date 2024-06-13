"""
SocketIO for terminal emulation. Adapted from the excellent tutorial by cs01:
https://github.com/cs01/pyxtermjs

Note: With flask_socketio we could not work around invalid session errors.
"""

import errno
import os
import pty
import signal
import subprocess
import struct
import fcntl
import termios
import select
import shlex

import socketio

from beets_flask.logger import log


config = dict()
config["client_connected"] = False
config["child_pid"] = None
config["fd"] = None
config["cmd"] = ["/bin/bash"]

sio = socketio.Server(
    async_mode="eventlet",
    logger=False,
    engineio_logger=False,
    cors_allowed_origins="*",
)

def register_socketio(app):
    app.wsgi_app = socketio.WSGIApp(sio, app.wsgi_app)


def set_winsize(fd, row, col, xpix=0, ypix=0):
    log.debug("setting window size with termios")
    winsize = struct.pack("HHHH", row, col, xpix, ypix)
    fcntl.ioctl(fd, termios.TIOCSWINSZ, winsize)


def read_and_forward(timeout_seconds=0.1, max_bytes=1024 * 20):
    if config["fd"] is None:
        return

    (data_ready, _, _) = select.select([config["fd"]], [], [], timeout_seconds)
    if not data_ready:
        return

    try:
        if config["fd"] is None:
            # check again, because the fd might have been closed in the meantime
            return
        output = os.read(config["fd"], max_bytes).decode(errors="ignore")
        sio.emit("ptyOutput", {"output": output}, namespace="/terminal")
    except Exception as e:
        log.error(f"Error reading from pty: {e}")
        sio.emit("ptyOutput", {"output": f"Error reading from pty: {e}"}, namespace="/terminal")
        raise


def read_forward_continuously(sleep_seconds=0.01):
    while config["client_connected"]:
        sio.sleep(sleep_seconds)  # type: ignore
        try:
            read_and_forward()
        except Exception as e:
            log.error(f"Error reading from pty: {e}")
            break

def is_fd_ready():
    if config["fd"] is None:
        # None means we havent started the child process yet
        return True
    try:
        os.fstat(config["fd"])
        return True
    except OSError as e:
        if e.errno == errno.EBADF:
            return False
        raise


@sio.on("ptyInput", namespace="/terminal")
def pty_input(sid, data):
    """write to the child pty. The pty sees this as if you are typing in a real
    terminal.
    """
    if config["fd"]:
        log.debug(f"{sid} received input from browser: {data['input']} connected: {str(config['client_connected'])}")
        os.write(config["fd"], data["input"].encode())


@sio.on("resize", namespace="/terminal")
def resize(sid, data):
    if config["fd"]:
        log.debug(f"{sid} Resizing window to {data['rows']}x{data['cols']}")
        set_winsize(config["fd"], data["rows"], data["cols"])


@sio.on("connect", namespace="/terminal")
def connect(sid, environ):
    """new client connected"""
    log.debug(f"{sid} new client connected")

    # I'd like to keep the pty open on disconnects, but this is still unrelyable.
    # some attempts:
    # while not is_fd_ready():
    #     log.debug(f"{sid} waiting for file descriptor to be ready")
    #     sio.sleep(0.1)
    #
    # or use tmux, ideally in its own redis worker...
    # config["cmd"] = ["/usr/bin/tmux", "new-session", "-A", "-s", "mySession", "-d", "/bin/bash"]

    config["client_connected"] = True

    if config["child_pid"]:
        # already started child process, don't start another, but show output
        log.debug(f"{sid} connecting to existing pid {config['child_pid']}")
        return


    # create child process attached to a pty we can read from and write to
    (child_pid, fd) = pty.fork()
    if child_pid == 0:
        # this is the child process fork.
        # anything printed here will show up in the pty, including the output
        # of this subprocess
        subprocess.run(config["cmd"])
        read_and_forward(timeout_seconds=1)
    else:
        # this is the parent process fork.
        config["fd"] = fd
        config["child_pid"] = child_pid
        set_winsize(fd, 20, 140)
        cmd = " ".join(shlex.quote(c) for c in config["cmd"])
        sio.start_background_task(target=read_forward_continuously)
        log.debug(f"{sid} child pid is {child_pid}, starting background task with command `{cmd}`")

@sio.on("disconnect", namespace="/terminal")
def disconnect(sid):
    """Handle client disconnect"""
    log.debug(f"{sid} client disconnected")

    config["client_connected"] = False

    sio.emit("ptyOutput", {"output": "Socket disconnected"}, namespace="/terminal")

    # killing the pty on disconnect works well and relyable but we might
    # rather want a way to keep long-running commands active in the background.
    os.kill(config["child_pid"], signal.SIGKILL)
    config["fd"] = None
    config["child_pid"] = None


@sio.on("*", namespace="/terminal")
def any_event(event, sid, data):
    log.debug(f"sid {sid} undhandled event {event} with data {data}")
