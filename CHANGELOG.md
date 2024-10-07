# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Upcoming]

### Fixed

-  Renamed `kind` to `type` in search frontend code to be consistent with backend.
   Using kind for tags (preview, import, auto), and types for search (album, track).

### Added

-  Auto-import: automatically import folders that are added to the inbox if the match is good enough.
   After a preview, import will start if the match quality is above the configured.
   Enable via the config.yaml, set the `autotag` field of a configred inbox folders to `"auto"`.

## [0.0.4] - 24-10-04

### Fixed

-   Config parsing should now work [@16af9d02](16af9d02bb59555177790bbccde93af26f15e8c7)

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

[0.0.4]: https://github.com/pSpitzner/beets-flask/compare/v0.0.3...v0.0.4
[0.0.3]: https://github.com/pSpitzner/beets-flask/compare/v0.0.2...v0.0.3
[0.0.2]: https://github.com/pSpitzner/beets-flask/compare/v0.0.1...v0.0.2
