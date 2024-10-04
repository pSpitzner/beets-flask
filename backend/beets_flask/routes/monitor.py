from flask import Blueprint

from beets_flask.redis import queues, redis_conn
from rq.worker import Worker
from rq.registry import clean_registries
from rq.worker_registration import clean_worker_registry

monitor_bp = Blueprint("monitor", __name__, url_prefix="/monitor")


@monitor_bp.route("/queues", methods=["GET"])
def get_queue_status():
    """
    Get the status of the job queues.

    Returns:
        dict: A dictionary containing the status of each job queue.

    """

    for q in queues:
        clean_registries(q)
        clean_worker_registry(q)

    ret_dict = {}
    for q in queues:

        ret_dict[q.name] = {
            "name": q.name,
            "queued": q.count,
            "executing": q.started_job_registry.count,
            "finished": q.finished_job_registry.count,
            "failed": q.failed_job_registry.count,
        }

    return {"queues": ret_dict}


@monitor_bp.route("/workers", methods=["GET"])
def get_worker_status():
    """
    Get the status of the RQ workers.

    Returns:
        dict: A dictionary containing the status of each worker.

    """
    workers: list[Worker] = Worker.all(connection=redis_conn)

    ret_dict = {}
    for w in workers:
        ret_dict[w.name] = {
            "name": w.name,
            "queues": w.queue_names(),
            "state": w.get_state(),
            "executed": w.successful_job_count,
            "failed": w.failed_job_count,
        }

    return {"workers": ret_dict}


@monitor_bp.route("/debugResetDb", methods=["GET"])
def reset_database():
    """
    Reset the sql database.

    Returns:
        dict: A dictionary containing the status of the reset operation.

    """
    from beets_flask.db_engine import reset_database

    reset_database()

    return {"status": "success"}
