# main.py
from beets_flask import create_app


if __name__ == "__main__":
    app = create_app()
    # Setting this is important otherwise your raised
    # exception will just generate a regular exception
    app.config["PROPAGATE_EXCEPTIONS"] = True
    app.run(host="0.0.0.0", debug=True, port=5001)
