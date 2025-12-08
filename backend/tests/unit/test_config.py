import os

import pytest
from eyconf.validation import MultiConfigurationError

from beets_flask.config import get_config


class TestConfig:
    def test_path_getters(self):
        """Test that config path getters return correct paths."""
        config = get_config()
        beets_path = config.get_beets_config_path()
        beets_flask_path = config.get_beets_flask_config_path()

        assert beets_path.is_relative_to(os.environ["BEETSDIR"])
        assert beets_flask_path.is_relative_to(os.environ["BEETSFLASKDIR"])

    def test_write_examples(self):
        """Test that example config files are written as user defaults."""

        config = get_config()
        beets_path = config.get_beets_config_path()
        beets_flask_path = config.get_beets_flask_config_path()

        # remove config files
        os.remove(beets_path)
        os.remove(beets_flask_path)

        config.write_examples_as_user_defaults()

        assert beets_path.exists()
        assert beets_flask_path.exists()

    def test_set_and_validate(self):
        """Test that config validation works as expected."""
        config = get_config()

        # test that wrongly typed fields raise errors
        config.data.gui.num_preview_workers = "not an int"  # type: ignore

        with pytest.raises(MultiConfigurationError):
            config.validate()

        # eyconf currently does not forbid setting wrong types
        # so we can work with that in the mean time
        assert config.data.gui.num_preview_workers == "not an int"

    def test_reload(self):
        """Test that config reload works as expected."""

        config = get_config()
        config.data.gui.num_preview_workers = "not an int"  # type: ignore

        # previous set should have modified global singleton
        config = get_config()
        assert config.data.gui.num_preview_workers == "not an int"

        # test reloading via kwarg
        config = get_config(force_reload=True)
        assert config.data.gui.num_preview_workers != "not an int"

        # Modify a field
        original_value = config.data.directory
        config.data.directory = "/some/other/path"

        # Reload the config
        config.reload()

        # Check that the field is back to original value
        assert config.data.directory == original_value

        # test reloading from file modifications that occur during runtime
        beets_flask_path = config.get_beets_flask_config_path()
        with open(beets_flask_path) as f:
            content = f.read()
        modified_content = content.replace(
            "num_preview_workers: 4", "num_preview_workers: 7"
        )
        with open(beets_flask_path, "w") as f:
            f.write(modified_content)

        config.reload()
        assert config.data.gui.num_preview_workers == 7

        # revert changes on disk
        with open(beets_flask_path, "w") as f:
            f.write(content)

    def test_commit_to_beets(self):
        """Test that committing to beets config works as expected."""
        import beets

        config = get_config()

        # Modify a field in beets-flask config
        old_directory = config.data.directory
        new_directory = "/new/music/directory"
        config.data.directory = new_directory

        # Changes should not be in beets yet
        assert beets.config["directory"].get() == old_directory
        assert config.beets_config["directory"].get() == old_directory

        # Commit to beets config
        config.commit_to_beets()

        # Check that the beets config has been updated
        assert beets.config["directory"].get() == new_directory
        assert config.beets_config["directory"].get() == new_directory

        # Revert changes
        config.data.directory = old_directory
        config.commit_to_beets()

    def test_commit_to_beets_alias(self):
        """
        For reserved keywords, we use eyconfs aliasing.
        """
        import beets

        config = get_config()

        # we dont know if keep might be the old action
        config.data.import_.duplicate_action = "keep"
        config.commit_to_beets()
        assert beets.config["import"]["duplicate_action"].get() == "keep"

        config.data.import_.duplicate_action = "skip"
        config.commit_to_beets()
        assert beets.config["import"]["duplicate_action"].get() == "skip"

        config.data.import_.duplicate_action = "remove"
        config.commit_to_beets()
        assert beets.config["import"]["duplicate_action"].get() == "remove"
