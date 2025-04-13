"""SocketIO for terminal emulation.

Adapted from the excellent tutorial by cs01:
https://github.com/cs01/pyxtermjs

Notes on tmux:
- To manually connect to the session used for the web:
    `docker exec -it beets-flask /usr/bin/tmux attach-session -t beets-socket-term`
- We send the whole current pane (window) content to the client, and resend when it
changes.
- **Currently, trailing whitespaces get stripped**. I did not manage to get a real live-representation of the input line, including trailing whitespaces. `pane.capture_pane()` uses under the hood: `pane.cmd(*["capture-pane", "-p"]).stdout`
and we might want to play around with -T -N -J -e
https://www.man7.org/linux/man-pages/man1/tmux.1.html
- If we want to prepare commands client side before sending the finished command, cf.:
https://stackoverflow.com/questions/44447473/how-to-make-xterm-js-accept-input

"""

from __future__ import annotations

import asyncio

import libtmux
from libtmux import Pane, Session, Window
from libtmux.exc import LibTmuxException

from beets_flask.config import get_config
from beets_flask.logger import log

from . import sio

session: Session
window: Window
pane: Pane


def register_tmux():
    global session, window, pane
    server = libtmux.Server()

    try:
        abs_path_lib = str(get_config()["gui"]["terminal"]["start_path"].as_str())
    except:
        abs_path_lib = "/repo"

    try:
        session = server.new_session(
            session_name="beets-socket-term", start_directory=abs_path_lib
        )
    except LibTmuxException:  # DuplicateSessionName
        session = server.sessions.get(session_name="beets-socket-term")  # type: ignore

    if session is None:
        raise Exception("Could not create or find tmux session")

    window = session.active_window
    pane = window.active_pane or window.split_window(attach=True)


def is_session_alive():
    try:
        if len(session.windows) > 0:  # type: ignore
            # session.windows should raise if the session is not alive.
            return True
        else:
            return False
    except:
        return False


async def emit_output():
    try:
        if is_session_alive():
            current = pane.cmd("capture-pane", "-p", "-N", "-T", "-e").stdout
            x, y = _get_cursor_position()
        else:
            current = ["Session ended. Reload page to restart!"]
            x, y = 0, 0
    except Exception as e:
        log.error(f"Error reading from pty: {e}")
        current = [f"Error reading from pty: {e}"]
        x, y = 0, 0

    await sio.emit(
        "ptyOutput", {"output": current, "x": x, "y": y}, namespace="/terminal"
    )


async def emit_output_continuously(sleep_seconds=0.01):
    # only emit if there was a change
    prev: list[str] = []
    prev_x, prev_y = 0, 0
    while True:
        await sio.sleep(sleep_seconds)  # type: ignore
        try:
            if is_session_alive():
                current = pane.cmd("capture-pane", "-p", "-N", "-T", "-e").stdout
                x, y = _get_cursor_position()
            else:
                current = ["Session ended. Reload page to restart!"]
                x, y = 0, 0
            if current != prev:
                await sio.emit(
                    "ptyOutput",
                    {"output": current, "x": x, "y": y},
                    namespace="/terminal",
                )
                prev = current
                prev_x, prev_y = x, y
                # log.debug(f"emitting {current} at {x} {y}")
                log.debug("\n\t".join(_get_scrollback_buffer(10)) + f"\n>>> {current}")
            elif x != prev_x or y != prev_y:
                await sio.emit(
                    "ptyCursorPosition", {"x": x, "y": y}, namespace="/terminal"
                )
                prev_x, prev_y = x, y
        except Exception as e:
            log.error(f"Error reading from pty: {e}")
            await sio.emit(
                "ptyOutput",
                {"output": f"\nError reading from pty: {e}", "x": 0, "y": 0},
                namespace="/terminal",
            )
            break


def _get_scrollback_buffer(lines: int = 500) -> list[str]:
    """Fetch the last N lines of scrollback buffer from tmux.

    Parameters
    ----------
        pane: The tmux pane object.
        lines: Number of scrollback lines to fetch (default: 500).

    Returns
    -------
        List of strings representing the scrollback buffer.
    """
    try:
        # Capture the last `lines` from scrollback (excluding the current screen)
        # - '-S -N': Start from N lines before the current screen
        # - '-E -1': End at the line before the current screen
        scrollback = pane.cmd(
            "capture-pane", "-p", "-N", "-T", "-e", "-S", f"-{lines}", "-E", "-1"
        ).stdout
        return scrollback
    except Exception as e:
        log.error(f"Failed to fetch scrollback buffer: {e}")
        return []


async def emit_cursor_position():
    try:
        x, y = _get_cursor_position()
        await sio.emit("ptyCursorPosition", {"x": x, "y": y}, namespace="/terminal")
    except Exception as e:
        log.error(f"Error reading cursor position: {e}")
        await sio.emit(
            "cursorPosition",
            {"cursor": f"\nError reading cursor position: {e}"},
            namespace="/terminal",
        )


def _get_cursor_position():
    """Get the cursor position."""
    cursor = pane.cmd("display-message", "-p", "#{cursor_x},#{cursor_y}").stdout
    x, y = map(int, cursor[0].split(","))
    return x, y


@sio.on("ptyInput", namespace="/terminal")
async def pty_input(sid, data):
    """Write to the child pty."""
    # log.debug(f"{sid} input {data}")
    pane.send_keys(data["input"], enter=False)
    # await asyncio.gather(
    #     emit_output(),
    #     emit_cursor_position(),
    # )


@sio.on("ptyResize", namespace="/terminal")
async def resize(sid, data):
    """Resize the pty."""
    log.debug(f"{sid} resize pty to {data['cols']} {data['rows']}")
    window.resize(width=data["cols"], height=data["rows"])
    # we might want to resend the output:
    # sio.emit("ptyOutput", {"output": pane.capture_pane()}, namespace="/terminal")


@sio.on("ptyResendOutput", namespace="/terminal")
async def resend_output(sid):
    """Resend the output."""
    log.debug(f"{sid} resend output")
    await emit_output()


@sio.on("connect", namespace="/terminal")
async def connect(sid, environ):
    """Handle new client connected."""
    log.debug(f"TerminalSocket new client connected {sid}")
    register_tmux()
    sio.start_background_task(
        target=emit_output_continuously,
    )


@sio.on("disconnect", namespace="/terminal")
async def disconnect(sid):
    """Handle client disconnect."""
    log.debug(f"TerminalSocket client disconnected {sid}")


@sio.on("*", namespace="/terminal")
async def any_event(event, sid, data):
    log.debug(f"TerminalSocket sid {sid} undhandled event {event} with data {data}")
