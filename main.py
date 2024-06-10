# main.py
from beets_flask import create_app


if __name__ == "__main__":
    app = create_app()
    app.run(host="0.0.0.0", debug=True, port=5001)
