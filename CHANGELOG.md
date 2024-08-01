# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.0.3] - 24-08-01

### Fixed
- default config: mandatory fields cannot be set in the yaml, or they
might persist although the user sets them. moved to config loading in python.
- tmux session now restarts on page load if it is not alive.
- navbar, tags, inbox are now more friendly for mobile
- folder paths are now better escaped for terminal imports

### Added
- Backend to get cover art from metadata of music files.
- Impoved library view (mobile friendly, and a browser header component)
- Library search

### Changed
- Simplified folder structure of frontend
- Removed `include_paths` option from config and library backend (most of the frontend needs some form of file paths. thus, the option was not / could not be respected consistently)

## [0.0.2] - 24-07-16

### Fixed
- ESLint errors and Github action
- Now loading the default config

## 0.0.1 - 24-05-22
- initial commit

[0.0.3]: https://github.com/pSpitzner/beets-flask/compare/v0.0.2...v0.0.3
[0.0.2]: https://github.com/pSpitzner/beets-flask/compare/v0.0.1...v0.0.2
