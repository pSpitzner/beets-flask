from quart import Blueprint

from .errors import error_bp
from .tag import tag_bp
from .testing import test_bp

backend_bp = Blueprint("backend", __name__, url_prefix="/api_v1")

# Register all backend blueprints
"""
backend_bp.register_blueprint(config_bp)
backend_bp.register_blueprint(frontend_bp)
backend_bp.register_blueprint(inbox_bp)
backend_bp.register_blueprint(library_bp)
backend_bp.register_blueprint(lookup_bp)
backend_bp.register_blueprint(monitor_bp)
backend_bp.register_blueprint(sse_bp)
backend_bp.register_blueprint(group_bp)
"""
backend_bp.register_blueprint(tag_bp)
backend_bp.register_blueprint(error_bp)
backend_bp.register_blueprint(test_bp)
