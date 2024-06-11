"""
SocketIO for terminal emulation. Adapted from the excellent tutorial by cs01:
https://github.com/cs01/pyxtermjs
"""

from time import sleep
from flask import Blueprint, current_app, app
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
import socketio

sio = socketio.Server(
    async_mode="eventlet", logger=True, engineio_logger=True, cors_allowed_origins="*"
)


config=dict()
config["child_pid"] = None
config["fd"] = None
config["cmd"] = ["/bin/bash"]

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
                output = os.read(config["fd"], max_read_bytes).decode(errors="ignore")
                sio.emit("ptyOutput", {"output": output}, namespace="/terminal")


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
    log.info(f"{sid} new client connected")
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
        set_winsize(fd, 50, 50)
        cmd = " ".join(shlex.quote(c) for c in config["cmd"])
        # logging/print statements must go after this because... I have no idea why
        # but if they come before the background task never starts
        sio.start_background_task(target=read_and_forward_pty_output)

        log.info(f"{sid} child pid is " + str(child_pid))
        log.info(
            f"{sid} starting background task with command `{cmd}` to continously read "
            "and forward pty output to client"
        )
        log.info("task started")


@sio.on("*", namespace="/terminal")
def any_event(event, sid, data):
    log.info(f"sid {sid} undhandled event {event} with data {data}")
