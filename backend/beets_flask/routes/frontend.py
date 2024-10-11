"""The glue between the compiled vite frontend and our backend."""

from flask import Blueprint, send_from_directory

frontend_bp = Blueprint("frontend", __name__)


# Register frontend folder
# basically a reverse proxy for the frontend
@frontend_bp.route("/", defaults={"path": "index.html"})
@frontend_bp.route("/<path:path>")
def reverse_proxy(path):
    # not include assets
    if (
        not "assets" in path
        and not "logo.png" in path
        and not path.startswith("favicon.ico")
    ):
        path = "index.html"

    # Remove everything infront of assets
    if "assets" in path:
        path = path[path.index("assets") :]
    if "logo.png" in path:
        path = path[path.index("logo.png") :]

    r = send_from_directory("../../frontend/dist/", path)
    return r
