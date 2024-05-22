from . import routes
from . import beets_tags
from . import beets_tasks
from . import beets_sessions
from . import disk
from . import utility
from ._version import __version__

# for `export FLASK_APP=...` to work (without specifying submodules) we need the app variable here:

app = utility.app
beets_tags.init()
disk.init()
