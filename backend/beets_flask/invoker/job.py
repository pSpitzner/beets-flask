from __future__ import annotations

from typing import TYPE_CHECKING, NotRequired, TypedDict

if TYPE_CHECKING:
    from rq.job import Job

    from .enqueue import EnqueueKind


class ExtraJobMeta(TypedDict):
    job_frontend_ref: NotRequired[str | None]


class RequiredJobMeta(TypedDict):
    folder_hash: str
    folder_path: str
    job_id: str
    job_kind: str  # PS: EnqueueKind not json serializable


class JobMeta(RequiredJobMeta, ExtraJobMeta):
    pass


def _set_job_meta(
    job: Job, hash: str, path: str, kind: EnqueueKind, extra: ExtraJobMeta
):
    job.meta["folder_hash"] = hash
    job.meta["folder_path"] = path
    job.meta["job_id"] = job.id
    job.meta["job_kind"] = kind.value
    job.meta["job_frontend_ref"] = extra.get("job_frontend_ref", None)
    job.save_meta()
