import os

from beets_flask.logger import log


def test_log():
    """Test that logger is correctly set up for testing."""

    assert "PYTEST_CURRENT_TEST" in os.environ

    # Logger should have no handlers
    assert not log.handlers
    assert log.level == 10
    assert log.name == "beets-flask"




def test_config():
    """Test that config is correctly set up for testing."""
    import tempfile

    dir = os.environ.get("BEETSFLASKDIR")
    assert dir is not None
    assert str(tempfile.tempdir) in dir
