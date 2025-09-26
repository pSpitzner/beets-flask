from abc import ABC
from unittest import mock

import pytest
from beets.plugins import EventType, send


class PluginEventsMixin(ABC):
    """
    Allows to test events sent by plugins.
    This mixin captures events sent by plugins during tests.

    Usage:
    ```
    class TestMyPlugin(PluginEventsMixin):
        def test_event(self):
            self.send_event("my_event", data="test")
            assert "my_event" in self.events
    ```

    """

    events: list[str] = []

    def send_event(self, event: EventType, **kwargs):
        self.events.append(event)
        return send(event, **kwargs)

    @pytest.fixture(autouse=True, scope="function")
    def mock_events(self):
        """Mock the emit_status decorator"""

        with mock.patch(
            "beets.plugins.send",
            self.send_event,
        ):
            yield

        self.events = []
