"""
SocketIO for terminal emulation. Adapted from the excellent tutorial by cs01:
https://github.com/cs01/pyxtermjs

Note: With flask_socketio we could not work around invalid session errors.

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

import libtmux
from libtmux import Pane, Session, Window
from beets_flask.logger import log
from beets_flask.websocket import sio
from beets_flask.config import config


session: Session
window: Window
pane: Pane


def register_tmux():
    global session, window, pane
    server = libtmux.Server()

    try:
        session = server.sessions.get(session_name="beets-socket-term")  # type: ignore
    except:
        try:
            abs_path_lib = str(config["gui"]["terminal"]["start_path"].as_str())
        except:
            abs_path_lib = "/repo"
        session = server.new_session(
            session_name="beets-socket-term", start_directory=abs_path_lib
        )

    window = session.active_window  # type: ignore
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


def emit_output():
    try:
        if is_session_alive():
            current = pane.cmd("capture-pane", "-p", "-N", "-T", "-e").stdout
        else:
            current = ["Session ended. Reload page to restart!"]
        sio.emit("ptyOutput", {"output": current}, namespace="/terminal")
    except Exception as e:
        log.error(f"Error reading from pty: {e}")
        sio.emit(
            "ptyOutput",
            {"output": f"\nError reading from pty: {e}"},
            namespace="/terminal",
        )


def emit_output_continuously(sleep_seconds=0.1):
    # only emit if there was a change
    prev = []
    while True:
        sio.sleep(sleep_seconds)  # type: ignore
        try:
            if is_session_alive():
                current = pane.cmd("capture-pane", "-p", "-N", "-T", "-e").stdout
            else:
                current = ["Session ended. Reload page to restart!"]
            if current != prev:
                sio.emit("ptyOutput", {"output": current}, namespace="/terminal")
                emit_cursor_position()
                prev = current
                log.debug(f"emitting {current}")
        except Exception as e:
            log.error(f"Error reading from pty: {e}")
            sio.emit(
                "ptyOutput",
                {"output": f"\nError reading from pty: {e}"},
                namespace="/terminal",
            )
            break


sio.start_background_task(target=emit_output_continuously)


def emit_cursor_position():
    try:
        cursor = pane.cmd("display-message", "-p", "#{cursor_x},#{cursor_y}").stdout
        x, y = map(int, cursor[0].split(","))
        sio.emit("ptyCursorPosition", {"x": x, "y": y}, namespace="/terminal")
    except Exception as e:
        log.error(f"Error reading cursor position: {e}")
        sio.emit(
            "cursorPosition",
            {"cursor": f"\nError reading cursor position: {e}"},
            namespace="/terminal",
        )


@sio.on("ptyInput", namespace="/terminal")  # type: ignore
def pty_input(sid, data):
    """
    Write to the child pty.
    """
    log.debug(f"{sid} input {data}")
    pane.send_keys(data["input"], enter=False)
    emit_cursor_position()


@sio.on("ptyResize", namespace="/terminal")  # type: ignore
def resize(sid, data):
    """resize the pty"""
    log.debug(f"{sid} resize pty to {data['cols']} {data['rows']}")
    window.resize(width=data["cols"], height=data["rows"])
    # we might want to resend the output:
    # sio.emit("ptyOutput", {"output": pane.capture_pane()}, namespace="/terminal")


@sio.on("ptyResendOutput", namespace="/terminal")  # type: ignore
def resend_output(sid):
    """resend the output"""
    log.debug(f"{sid} resend output")
    emit_output()


@sio.on("connect", namespace="/terminal")  # type: ignore
def connect(sid, environ):
    """new client connected"""
    log.debug(f"TerminalSocket new client connected {sid}")
    register_tmux()


@sio.on("disconnect", namespace="/terminal")  # type: ignore
def disconnect(sid):
    """Handle client disconnect"""
    log.debug(f"TerminalSocket client disconnected {sid}")


@sio.on("*", namespace="/terminal")  # type: ignore
def any_event(event, sid, data):
    log.debug(f"TerminalSocket sid {sid} undhandled event {event} with data {data}")
