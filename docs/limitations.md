# Limitations

We try to be feature-complete with respect to beets, but there are some limitations and known issues.

## Initial Imports of large libraries

You might be tempted to import a large existing library (not previously tagged in beets) all at once by moving it into the inbox folder. Currently, once you hit some hundred folder or so, this will get laggy, due to some frontend-logic we have not optimized yet.

Some possible workarounds have been discussed in the following issues:
- [#164](https://github.com/pSpitzner/beets-flask/issues/164)
- [#175](https://github.com/pSpitzner/beets-flask/issues/175)

## Singletons are not supported (wont fix)

Most of beets works on a folder structure where one album is contained in a single folder.
Singletons refer to single music files, potentially without and album associted to them, and they are handled somewhat specially in vanilla beets.
While these exceptions (likely) meant acceptable extra effort when beets was orignally desgined as a CLI tool, here they pose a significant challenge to the UI and the overall logic of beets-flask.

The simple workaround is to place individual files in their own folder (or zip them).

See also:
- [#186](https://github.com/pSpitzner/beets-flask/issues/186#issuecomment-3201103451)

