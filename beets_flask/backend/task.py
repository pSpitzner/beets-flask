""" Task related API endpoints

Tasks are beet tasks that are created by the user or automatically by the system.
"""

from flask import Blueprint

task_bp = Blueprint("task", __name__, url_prefix="/task")


@task_bp.route("/", methods=["GET"])
def get_tasks():
    """Get all tasks"""
    return {"tasks": []}


@task_bp.route("/<task_id>", methods=["GET"])
def get_task(task_id):
    """Get a task by its id"""
    return {"task": task_id}
