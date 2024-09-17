# Technical questions about beets

-   The config is a global object, instead of a class instance. This creates problems, because we cannot set custom values for a session in local scope, but have to tweak and reset (!) the global instance - thus applying the tweaks to all sessions and tasks (hypothetically running at the same time).
-   Shall we make PRs for beets types?
    -   AlbumMatch
    -   Pipeline decorators
-   How to serialize Task objects (to db)?
