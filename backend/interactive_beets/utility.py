# audio formats supported by beets
# https://github.com/beetbox/beets/discussions/3964
AUDIO_EXTENSIONS = (
    ".mp3",
    ".aac",
    ".alac",
    ".ogg",
    ".opus",
    ".flac",
    ".ape",
    ".wv",
    ".mpc",
    ".asf",
    ".aiff",
    ".dsf",
)


class Singleton(type):
    _instances = {}

    def __call__(cls, *args, **kwargs):
        if cls not in cls._instances:
            cls._instances[cls] = super(Singleton, cls).__call__(*args, **kwargs)
        return cls._instances[cls]
