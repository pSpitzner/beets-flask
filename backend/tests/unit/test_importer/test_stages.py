import logging

from beets_flask.importer.stages import (
    StageOrder,
    identify_duplicates,
    match_threshold,
    user_query,
)

log = logging.getLogger(__name__)
log.setLevel(logging.DEBUG)


def test_stage_insert_order():
    stages = StageOrder()

    stages.append(identify_duplicates(None))
    stages.append(user_query(None))
    stages.append(stage=user_query(None), name="foo")

    assert len(stages) == 3
    assert list(stages.keys())[0] == "identify_duplicates"
    assert list(stages.keys())[1] == "user_query"
    assert list(stages.keys())[2] == "foo"

    stages.insert(after="identify_duplicates", stage=match_threshold(None), name="bar")

    assert len(stages) == 4
    assert list(stages.keys())[1] == "bar"

    stages.insert(before="identify_duplicates", stage=match_threshold(None), name="baz")

    assert len(stages) == 5
    assert list(stages.keys())[0] == "baz"
