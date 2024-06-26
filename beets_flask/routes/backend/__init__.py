from flask import Blueprint
from .tag import tag_bp
from .tag_group import group_bp
from .sse import sse_bp
from .inbox import inbox_bp
from .errors import error_bp
from .monitor import monitor_bp
from .library import library_bp

backend_bp = Blueprint("backend", __name__, url_prefix="/api_v1")

# Register all backend blueprints
backend_bp.register_blueprint(tag_bp)
backend_bp.register_blueprint(group_bp)
backend_bp.register_blueprint(sse_bp)
backend_bp.register_blueprint(inbox_bp)
backend_bp.register_blueprint(error_bp)
backend_bp.register_blueprint(monitor_bp)
backend_bp.register_blueprint(library_bp)
