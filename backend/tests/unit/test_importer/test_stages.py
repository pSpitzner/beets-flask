import logging
from typing import cast

from beets_flask.importer.session import AutoImportSession, BaseSession
from beets_flask.importer.stages import (
    StageOrder,
    identify_duplicates,
    match_threshold,
    user_query,
)

log = logging.getLogger(__name__)
log.setLevel(logging.DEBUG)


class DummySession(BaseSession):
    pass


def test_stage_insert_order():
    stages = StageOrder()

    # Workaround to avoid mypy error
    dummySession: AutoImportSession = cast(AutoImportSession, None)

    stages.append(identify_duplicates(dummySession))
    stages.append(user_query(dummySession))
    stages.append(stage=user_query(dummySession), name="foo")

    assert len(stages) == 3
    assert list(stages.keys())[0] == "identify_duplicates"
    assert list(stages.keys())[1] == "user_query"
    assert list(stages.keys())[2] == "foo"

    stages.insert(
        after="identify_duplicates", stage=match_threshold(dummySession), name="bar"
    )

    assert len(stages) == 4
    assert list(stages.keys())[1] == "bar"

    stages.insert(
        before="identify_duplicates", stage=match_threshold(dummySession), name="baz"
    )

    assert len(stages) == 5
    assert list(stages.keys())[0] == "baz"
