import os

from beets_flask.config.beets_config import config

try:
    num_preview_workers: int = config["gui"]["num_preview_workers"].get(int)  # type: ignore
except:
    num_preview_workers = 4

print(f"starting {num_preview_workers} redis workers for preview generation")

for i in range(num_preview_workers):
    os.system(
        f'rq worker preview --log-format "Preview worker $i: %(message)s" > /dev/null &'
    )


# imports are relatively fast, because they use previously fetched previews.
# one worker should be enough, and this avoids problems from simultaneous db writes etc.
num_import_workers = 1
print(f"starting {num_import_workers} redis workers for import")

for i in range(num_import_workers):
    os.system(
        f'rq worker import --log-format "Import worker $i: %(message)s" > /dev/null &'
    )
