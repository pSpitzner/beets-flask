"""
SocketIO for terminal emulation. Adapted from the excellent tutorial by cs01:
https://github.com/cs01/pyxtermjs
"""


from time import sleep
from flask import Blueprint, current_app, app, g
from flask_socketio import Namespace, SocketIO
import os
import pty
import subprocess
import struct
import fcntl
import termios
import select
import asyncio
import shlex

from beets_flask.logger import log
from beets_flask import socketio
log.debug(f"importing terminal {socketio}")


from beets_flask.logger import log

def set_winsize(fd, row, col, xpix=0, ypix=0):
    log.debug("setting window size with termios")
    winsize = struct.pack("HHHH", row, col, xpix, ypix)
    fcntl.ioctl(fd, termios.TIOCSWINSZ, winsize)


def read_and_forward_pty_output():
    max_read_bytes = 1024 * 20
    while True:
        socketio.sleep(0.01) # type: ignore
        if g.config["fd"]:
            timeout_sec = 0
            (data_ready, _, _) = select.select([g.config["fd"]], [], [], timeout_sec)
            if data_ready:
                output = os.read(g.config["fd"], max_read_bytes).decode(
                    errors="ignore"
                )
                socketio.emit("ptyOutput", {"output": output}, namespace="/terminal")




@socketio.on("ptyInput", namespace="/terminal")
def pty_input(data):
    """write to the child pty. The pty sees this as if you are typing in a real
    terminal.
    """
    if g.config["fd"]:
        log.debug("received input from browser: %s" % data["input"])
        os.write(g.config["fd"], data["input"].encode())


@socketio.on("resize", namespace="/terminal")
def resize(data):
    if g.config["fd"]:
        log.debug(f"Resizing window to {data['rows']}x{data['cols']}")
        set_winsize(g.config["fd"], data["rows"], data["cols"])


@socketio.on("connect", namespace="/terminal")
def connect():
    """new client connected"""
    log.info("new client connected")
    if g.config["child_pid"]:
        # already started child process, don't start another
        return

    # create child process attached to a pty we can read from and write to
    (child_pid, fd) = pty.fork()
    if child_pid == 0:
        # this is the child process fork.
        # anything printed here will show up in the pty, including the output
        # of this subprocess
        subprocess.run(g.config["cmd"])
    else:
        # this is the parent process fork.
        # store child fd and pid
        g.config["fd"] = fd
        g.config["child_pid"] = child_pid
        set_winsize(fd, 50, 50)
        cmd = " ".join(shlex.quote(c) for c in g.config["cmd"])
        # logging/print statements must go after this because... I have no idea why
        # but if they come before the background task never starts
        socketio.start_background_task(target=read_and_forward_pty_output)

        log.info("child pid is " + str(child_pid))
        log.info(
            f"starting background task with command `{cmd}` to continously read "
            "and forward pty output to client"
        )
        log.info("task started")
