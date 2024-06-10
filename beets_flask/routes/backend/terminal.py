"""
SocketIO for terminal emulation. Adapted from the excellent tutorial by cs01:
https://github.com/cs01/pyxtermjs
"""


from time import sleep
from flask import Blueprint, current_app, app
from flask_socketio import Namespace, SocketIO
import os
import pty
import subprocess
import struct
import fcntl
import termios
import select
import asyncio

from beets_flask import socketio


from beets_flask.logger import log


class TerminalNameSpace(Namespace):

    child_pid: int | None = None
    fd: int | None = None
    cmd = "/bin/bash"
    socketio: SocketIO

    def __init__(self, namespace=None):
        super().__init__(namespace)
        self.clients = []
        self.loop = asyncio.new_event_loop()


    def on_ptyInput(self, data):
        """write to the child pty. The pty sees this as if you are typing in a real
        terminal.
        """
        log.debug("received input from browser: %s" % data["input"])
        if self.fd:
            os.write(self.fd, data["input"].encode())

    def on_resize(self, data):
        if self.fd:
            log.debug(f"Resizing window to {data['rows']}x{data['cols']}")
            set_winsize(self.fd, data["rows"], data["cols"])

    def on_connect(self):
        """new client connected"""
        log.info("new client connected")
        if self.child_pid:
            # already started child process, don't start another
            return

        # create child process attached to a pty we can read from and write to
        (self.child_pid, self.fd) = pty.fork()
        if self.child_pid == 0:
            # this is the child process fork.
            # anything printed here will show up in the pty, including the output
            # of this subprocess
            subprocess.run(self.cmd)
        else:
            # this is the parent process fork.
            # store child fd and pid
            set_winsize(self.fd, 50, 50)
            # log/print statements must go after this because... I have no idea why
            # but if they come before the background task never starts
            asyncio.set_event_loop(self.loop)
            self.task  = asyncio.run(read_and_forward_pty_output(self.fd))
            log.info("child pid is " + str(self.child_pid))
            log.info(
                f"starting background task with command `{self.cmd}` to continously read "
                "and forward pty output to client"
            )
            log.info("task started")

def set_winsize(fd, row, col, xpix=0, ypix=0):
    log.debug("setting window size with termios")
    winsize = struct.pack("HHHH", row, col, xpix, ypix)
    fcntl.ioctl(fd, termios.TIOCSWINSZ, winsize)  # type: ignore

async def read_and_forward_pty_output(fd):
    max_read_bytes = 1024 * 20
    while True:
        await asyncio.sleep(0.1)
        if fd:
            timeout_sec = 0
            (data_ready, _, _) = select.select([fd], [], [], timeout_sec)
            if data_ready:
                try:
                    output = os.read(fd, max_read_bytes).decode(errors="ignore")
                    socketio.emit(
                        "ptyOutput", {"output": output}, namespace="/terminal"
                    )
                    log.debug(output)
                except OSError as e:
                    import errno
                    if e.errno == errno.EIO:
                        # EIO error means EOF on a pty, so we close the descriptor
                        log.debug("closed descriptor")
                        os.close(fd)
                        fd = None
                    else:
                        raise

