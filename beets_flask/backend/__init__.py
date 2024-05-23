from flask import Blueprint
from .task import task_bp
from .log import log_bp

backend_bp = Blueprint("backend", __name__, url_prefix="/api_v1")

# Register all backend blueprints
backend_bp.register_blueprint(task_bp)
backend_bp.register_blueprint(log_bp)
