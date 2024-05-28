# main.py
from beets_flask import create_app
from flask_cors import CORS



if __name__ == "__main__":
    app = create_app()
    CORS(app)
    # Setting this is important otherwise your raised
    # exception will just generate a regular exception
    app.config["PROPAGATE_EXCEPTIONS"] = True
    app.run(host="0.0.0.0", debug=True, port=5001)
