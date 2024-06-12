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


def read_and_forward_pty_output():
    max_read_bytes = 1024 * 20
    while True:
        sio.sleep(0.01)  # type: ignore
        if config["fd"]:
            timeout_sec = 0
            (data_ready, _, _) = select.select([config["fd"]], [], [], timeout_sec)
            if data_ready:
                try:
                    output = os.read(config["fd"], max_read_bytes).decode(errors="ignore")
                    sio.emit("ptyOutput", {"output": output}, namespace="/terminal")
                except OSError as e:
                    if e.errno == errno.EBADF:
                        log.debug("Terminal has been closed.")
                        os.kill(config["pid"], signal.SIGKILL)
                        config["fd"] = None
                        config["pid"] = None
                        break
                    else:
                        raise


@sio.on("ptyInput", namespace="/terminal")
def pty_input(sid, data):
    """write to the child pty. The pty sees this as if you are typing in a real
    terminal.
    """
    if config["fd"]:
        log.debug(f"{sid} received input from browser: %s" % data["input"])
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
    if config["child_pid"]:
        # already started child process, don't start another
        return

    # create child process attached to a pty we can read from and write to
    (child_pid, fd) = pty.fork()
    if child_pid == 0:
        # this is the child process fork.
        # anything printed here will show up in the pty, including the output
        # of this subprocess
        subprocess.run(config["cmd"])
    else:
        # this is the parent process fork.
        # store child fd and pid
        config["fd"] = fd
        config["child_pid"] = child_pid
        set_winsize(fd, 20, 140)
        cmd = " ".join(shlex.quote(c) for c in config["cmd"])
        # logging/print statements must go after this because... I have no idea why
        # but if they come before the background task never starts
        sio.start_background_task(target=read_and_forward_pty_output)
        log.debug(f"{sid} child pid is {child_pid}, starting background task with command `{cmd}`")


@sio.on("*", namespace="/terminal")
def any_event(event, sid, data):
    log.debug(f"sid {sid} undhandled event {event} with data {data}")
