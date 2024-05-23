from collections import defaultdict
import datetime
import re
from flask import Response, jsonify, make_response, render_template, request, send_file
from itertools import islice
from copy import deepcopy
import os
from . import beets_tags
from . import beets_tasks
from . import disk
from . import utility as ut
log = ut.log



# ------------------------------------------------------------------------------------ #
#                                      Beets tasks                                     #
# ------------------------------------------------------------------------------------ #


@ut.app.route("/task_for_id", methods=["POST"])
def task_for_id() -> Response:
    data = parse_request()
    log.debug(f"task for id: {data=}")
    ids = data.pop("ids", None) or [data.pop("id")]
    if not any(ids):
        return jsonify({"status": "Invalid data format, provide `id` or `ids`"}, 400)

    ids = [str(id) for id in ids if id is not None]

    try:
        submitted = beets_tasks.task_for_id(ids, data)
        submitted |= {"status": "queued tags"}
        return jsonify(submitted, 200)
    except Exception as e:
        return jsonify({"status": str(e)}, 400)


@ut.app.route("/task_for_paths", methods=["POST"])
def task_for_paths() -> Response:
    data = parse_request()
    log.debug(f"task for paths: {data=}")
    paths = data.pop("paths", None) or [data.pop("path")]
    if not any(paths):
        return jsonify(
            {"status": "Invalid data format, provide `path` or `paths`"}, 400
        )

    try:
        paths = [str(p) for p in paths if p is not None]
        submitted = beets_tasks.task_for_paths(paths, data)
        submitted |= {"status": "queued tags"}
        return jsonify(submitted, 200)
    except Exception as e:
        return jsonify({"status": str(e)}, 400)


@ut.app.route("/task_for_group", methods=["POST"])
def task_for_group() -> Response:
    data = parse_request()
    log.debug(f"task for group: {data=}")
    group_id = data.pop("group_id", None)
    if not group_id:
        return jsonify({"status": "Invalid data format, provide `groupId`"}, 400)

    try:
        submitted = beets_tasks.task_for_group(group_id, data)
        submitted |= {"status": "queued tags"}
        return jsonify(submitted, 200)
    except Exception as e:
        return jsonify({"status": str(e)}, 400)


def parse_request():
    data = request.get_json()
    return defaultdict(lambda: None, data)


@ut.app.route("/clear_beets", methods=["POST"])
def clear_beets():
    data = request.get_json()
    ids = data.get("ids", [])
    log.debug(f"Clearing beets: {ids}")
    if not isinstance(ids, list):
        return "Invalid data format", 400
    bts = beets_tags.Tag.query.filter(beets_tags.Tag.id.in_(ids)).all()  # type: ignore

    log.debug(f"Clearing beets: {bts}")
    for bt in bts:
        for queue in ["preview", "import"]:
            try:
                if job := ut.rq.get_queue("queue").fetch_job(bt.id):
                    job.cancel()
                    job.delete()
            except Exception as e:
                log.error(
                    f"Error while cancelling beets job {bt.id} in queue {queue}, {e}"
                )
        bt.status = "cleared"
        bt.commit()


    ut.update_client_view("tags")
    return jsonify({"status": "ok"}, 200)


@ut.app.route("/clear_inbox", methods=["POST"])
def clear_inbox():
    try:
        os.system(f"rm -rf {os.environ.get('INBOX', '/music/inbox')}/*")
    except Exception as e:
        log.error(f"Error while removing files from inbox: {e}")
        return jsonify({"status": "error while removing files from inbox"}, 500)
    return jsonify({"status": "removed all files from inbox"}, 200)


# ------------------------------------------------------------------------------------ #
#                                     Client views                                     #
# ------------------------------------------------------------------------------------ #


@ut.app.route("/")
def home():
    disk.get_inbox_dict(use_cache=False)
    return render_template("index.html")


@ut.app.route("/status", methods=["GET"])
def get_status():
    return jsonify(
        {
            "preview_status": (
                "done" if len(ut.rq.get_queue("preview").job_ids) == 0 else "processing"
            ),
            "import_status": (
                "done" if len(ut.rq.get_queue("import").job_ids) == 0 else "processing"
            ),
            "import_queue": ut.rq.get_queue("import").job_ids,
            "preview_queue": ut.rq.get_queue("preview").job_ids,
        }
    )


@ut.app.route("/tags_data", methods=["GET"])
def get_tags_data():
    # deepcopy, because we only want a view that we can update, without
    # database modifications.
    bts = beets_tags.Tag.query.all()
    bts = [bt.make_transient() for bt in bts]
    bts = sorted(bts, key=lambda bt: bt.updated_at, reverse=True)

    groups = beets_tags.TagGroup.query.all()
    groups = [gr.make_transient() for gr in groups]
    # make 'Unsorted' the last element.
    groups = sorted([gr for gr in groups], key=lambda gr: (gr.id == "Unsorted", gr.id))
    groups = {gr.id: gr for gr in groups}

    for bt in bts:
        bt.preview = ut.ansi_to_html(bt.preview)
        bt.progress_text = bt.status
        if bt.status in ["tagged", "imported", "cleared"]:
            bt.progress_text_extra = f" ({bt.num_tracks} tracks)"

        bt.heading = bt.album_title

        bt.similarity_span = ut.html_for_distance(bt.distance)

        gr = groups[bt.group_id]
        try:
            gr.tags.append(bt)
        except AttributeError:
            gr.tags = [bt]

    for gr in groups.values():
        # set the data to the latest tag update date
        gr.updated_at = max([bt.updated_at for bt in gr.tags])

    if "application/json" in request.headers.get("Accept", ""):
        return jsonify(bts)
    else:
        return render_template("tag_group/entry.html", tag_groups=groups.values())


@ut.app.route("/inbox_data", methods=["GET"])
def get_inbox_data():
    inbox = _parse_inbox(disk.get_inbox_dict())

    def repl(match):
        folder = match.group(1)
        bt = beets_tags.tag_for_folder(folder)
        if bt is None:
            status = "unknown"
            distance = None
            preview = "Waiting for tag preview..."
        else:
            status = bt.status
            distance = bt.distance
            preview = ut.ansi_to_html(str(bt.preview))

        res = f'<div class="tag-status-icons" data-album-folder="{folder}">'

        # status
        res += f'<div title="{status}">'
        res += render_template("tag/status.html", status=status)
        res += "</div>"

        # similarity
        res += f'<div data-bs-toggle="tooltip" data-bs-title=\'{preview}\' data-bs-toggle="tooltip">' if preview else "<div>"
        res += ut.html_for_distance(distance)
        res += "</div>"

        # actions
        res += render_template(
            "tag/actions.html", folder=folder, selector=ut.selector_safe(folder)
        )

        res += "</div>"
        return res

    return re.sub(
        r'<div class="tag-status-icons" data-album-folder="(.*?)">(.*?)</div>',
        repl,
        inbox,
        flags=re.DOTALL,
    )


def _parse_inbox(inbox: dict) -> str:
    """helper to pass the nesdted dictionary representing the inbox to html.

    Args:
        inbox (nested dict):
    """

    def _tree(d, level=0):
        contents = [name for name in d.keys() if not name.startswith("__")]
        for name in contents:
            if d[name].get("__type") == "directory":
                sub_d, name, merged_name = _merge_subdirs(d, name)
                # parent item
                yield f'<div class="tree-item {"directory" if level > 0 else "root-dir"}">'
                yield f'<div class="d-flex align-items-center gap-2">'
                yield f'<div class="collapse-toggle" role="button" data-bs-toggle="collapse" data-bs-target="#TI-{ut.selector_safe(merged_name)}"><i class="bi-caret-right-fill rotate-on-expand"></i></div>'
                # tagging status, we replace this later so we can cache disk structure
                if sub_d[name].get("__is_album", False):
                    yield f'<div class="tag-status-icons" data-album-folder="{sub_d[name].get("__full_path")}"><i class="bi-exclamation-circle"></i></div>'

                yield f'<div class="file-path">{merged_name}</div>'
                yield f"</div>"
                # collapse, childdren
                yield f'<div id="TI-{ut.selector_safe(merged_name)}" class="collapse show">'
                yield from _tree(sub_d[name], level=level + 1)
                yield f"</div></div>"
            else:
                output_name = f'<span class="file-path file">{name}</span>'
                yield f'<div class="tree-item">{output_name}</div>'

    def _merge_subdirs(d, name, merged=""):
        sub_contents = [
            sub_name for sub_name in d[name].keys() if not sub_name.startswith("__")
        ]
        if (
            len(sub_contents) == 1
            and d[name][sub_contents[0]].get("__type") == "directory"
        ):
            return _merge_subdirs(d[name], sub_contents[0], merged + name + " / ")
        else:
            output_name = merged + name

            return d, name, output_name

    res = ""
    for line in _tree(inbox):
        res += line
    return res


@ut.app.route("/db_view", methods=["GET"])
def get_db_view():
    bts = beets_tags.Tag.query.all()
    bts = [bt.to_dict() for bt in bts]

    return jsonify(bts)

@ut.app.route("/db_view_inbox", methods=["GET"])
def get_db_view_inbox():
    inbox = disk.get_inbox_dict()
    return jsonify(inbox)

@ut.app.route("/log", methods=["GET"])
def get_log():

    with open(ut.log_file_for_web, "r") as f:
        content = f.read()

    num_lines = content.count("\n")

    return {
        "numlines": num_lines,
        "log": ut.ansi_to_html(content),
    }
