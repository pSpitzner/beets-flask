# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- Session cache wasn't invalidated on all folder updates. This especially fixes an issues where the watchdog would not trigger a session invalidation when a folder was deleted or renamed. [#163](https://github.com/pSpitzner/beets-flask/issues/163)

## [1.1.0] - 25-07-29

### Added

-   Support for importing archives `zip` and `tar` files. Support for `rar` and `7z` files can be added via custom startup and requirements files. See the [FAQ](https://beets-flask.readthedocs.io/latest/faq.html) for more information.

### Dependencies

-   Updated `py2ts` to version `0.4.1`

## [1.0.3] - 25-07-29

### Fixed

-   Fixed search results not showing [#161](https://github.com/pSpitzner/beets-flask/issues/161)) 
-   Fixed search box not clickable on small screens [#162](https://github.com/pSpitzner/beets-flask/issues/162)

## [1.0.2] - 25-07-21

### Fixed

-   Artists separators were not regex escaped correctly, leading to issues with artists containing special characters. Additionally an empty list of separators was not handled correctly. [#159](https://github.com/pSpitzner/beets-flask/issues/159)


## [1.0.1] - 25-07-17

### Added

-   Configuration option for artist separator characters `gui.library.artist_separator`
-   Docs subpage for configuration (including content)
-   `typing_extensions` is now a dependency, to allow for more typing features
-   The model api routes now allows for `DELETE` requests to delete resources by id. Not used yet but will be helpful for future features.

### Fixed

-   Styling of candidate overview (major changes were not colored)
-   For bootlegs, display of track changes after import no longer broken
-   Navigating from inbox into folder details no longer toggles selection.
-   Padding issue where navbar could block content on mobile.
-   Cache invalidation now triggers on delete folder in frontend [#138](https://github.com/pSpitzner/beets-flask/issues/138)
-   In albums and items view the clicking on artists does not return any results if the contained a separator character (e.g. `&`) [#132](https://github.com/pSpitzner/beets-flask/issues/138)
-   Cleanup old actions.tsx file, which included old unused code [#134](https://github.com/pSpitzner/beets-flask/issues/134)
-   The `cli_exit` event is now triggered after the import task is finished. This adds compatibility with some plugins which expected this event to be triggered after the import task is done. [#154](https://github.com/pSpitzner/beets-flask/issues/154).

### Changed

-   Created `types.py` file to hold custom sqlalchemy types, and moved `IntDictType` there.

## [1.0.0] - 25-07-06

This is a breaking change, you will need to update your configs and delete your beets-flask
database (**not** the beets db!).

This marks a major milestone for beets-flask, as we now pretty happy with the current features
and the overall architecture.

### Changed

-   Migrated backend to quart (the async version of flask)
-   Reworked most of the frontend
-   Removed interactive imports. We now store states for _any_ preview and import that is generated. Thus, sessions are resumable, and we can go back and forth seemlessly, to e.g. undo an import and pick a better candidate.
-   Inbox types have changed. For now we only have `preview`, `auto` and `bootleg`.
-   beets updated to version 2.2.0
-   Implemented our own async pipeline for beets, that is typed and handles our custom sessions (should become obsolete once upstream PRs are merged).
-   Improved library view, and track preview / streaming.
-   Improved candidate preview, including cover art and asis details (current metadata).
-   Terminal now has a bit of scroll-back and history.
-   Much better test coverage.
-   Now using [py2ts](https://github.com/semohr/py2ts) to automatically generate frontend (typescript) types from their backend (python) equivalents.
-   New and improved logo.

## [0.1.1] - 25-06-08

Small version bump with fixes before jumping to 1.0.0.

### Added

-   Option to install beets plugins by placing either `requirements.txt` or `startup.sh` in /`config`. cf. [Readthedocs](https://beets-flask.readthedocs.io/en/latest/plugins.html)
-   [Documentation](https://beets-flask.readthedocs.io/en/latest/?badge=latest) on readthedocs.
-   Option to import Asis via right-click, or as inbox type. Good for Bootlegs that do not
    have online meta data and you curate manually. Currently also applies `--group-albums`.

### Fixed

-   Path escaping for right-click import via cli (#51)

## [0.1.0] - 24-11-13

### Fixed

-   Renamed `kind` to `type` in search frontend code to be consistent with backend.
    Using kind for tags (preview, import, auto), and types for search (album, track).

### Changed

-   Improved readme and onboarding experience
-   Mountpoint to persist config files and databases changed to `/config` (was `/home/beetle/.config/beets/`)
    We create the `/config/beets` and `/config/beets-flask` folders on startup if they do not exist.
    Library files are placed there, and you can drop a `config.yaml` either or both of these folders. Settings in `/config/beets-flask/config.yaml` take precedence over `/config/beets/config.yaml`.
    **You will need to update your docker-compose!**

### Added

-   Logo and favicon
-   Image now on docker hub: `pspitzner/beets-flask:stable`
-   Auto-import: automatically import folders that are added to the inbox if the match is good enough.
    After a preview, import will start if the match quality is above the configured.
    Enable via the config.yaml, set the `autotag` field of a configred inbox folders to `"auto"`.

## [0.0.4] - 24-10-04

### Fixed

-   Config parsing should now work

### Added

-   multi-disc albums are now supported
-   Interactive import using a custom beets pipeline

### Changed

-   Moved terminal to its own page, had to temporarily remove keyboard trigger
-   Reworked the album folder detection algorithm, now uses more native beets code and is a bit faster
-   Navbar styling and items overhaul

## [0.0.3] - 24-08-01

### Fixed

-   default config: mandatory fields cannot be set in the yaml, or they
    might persist although the user sets them. moved to config loading in python.
-   tmux session now restarts on page load if it is not alive.
-   navbar, tags, inbox are now more friendly for mobile
-   folder paths are now better escaped for terminal imports

### Added

-   Backend to get cover art from metadata of music files.
-   Impoved library view (mobile friendly, and a browser header component)
-   Library search

### Changed

-   Simplified folder structure of frontend
-   Removed `include_paths` option from config and library backend (most of the frontend needs some form of file paths. thus, the option was not / could not be respected consistently)

## [0.0.2] - 24-07-16

### Fixed

-   ESLint errors and Github action
-   Now loading the default config

## 0.0.1 - 24-05-22

-   initial commit


[Unreleased]: https://github.com/pSpitzner/beets-flask/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/pSpitzner/beets-flask/compare/v1.0.3...v1.1.0
[1.0.3]: https://github.com/pSpitzner/beets-flask/compare/v1.0.2...v1.0.3
[1.0.2]: https://github.com/pSpitzner/beets-flask/compare/v1.0.1...v1.0.2
[1.0.1]: https://github.com/pSpitzner/beets-flask/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/pSpitzner/beets-flask/compare/v0.1.0...v1.0.0
[0.1.0]: https://github.com/pSpitzner/beets-flask/compare/v0.0.4...v0.1.0
[0.0.4]: https://github.com/pSpitzner/beets-flask/compare/v0.0.3...v0.0.4
[0.0.3]: https://github.com/pSpitzner/beets-flask/compare/v0.0.2...v0.0.3
[0.0.2]: https://github.com/pSpitzner/beets-flask/compare/v0.0.1...v0.0.2
