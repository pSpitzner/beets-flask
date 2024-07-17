# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## In progress

### Fixed
- default config: mandatory fields cannot be set in the yaml, or they
might persist although the user sets them. moved to config loading in python.

### Added
- Backend to get cover art from metadata of music files.
- Impoved library view (friendlier for mobile, and a browser header component)

### Changed
- Simplified folder structure of frontend

## [0.0.2] - 24-07-16

### Fixed
- ESLint errors and Github action
- Now loading the default config

## 0.0.1 - 24-05-22
- initial commit

[0.0.2]: https://github.com/pSpitzner/beets-flask/compare/v0.0.1...v0.0.2
