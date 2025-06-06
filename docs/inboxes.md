# Inboxes

In the `beets-flask/config.yml` you can add multiple inboxes.

-   The top label (Inbox1, Inbox2...) does not matter.
-   Currently we have four types of inboxes, set via `autotag`:
    -   `no` you have to do everything manually
    -   `"preview"` fetch meta data from online sources, but dont import
    -   `"auto"` fetch meta data, and import if the match is good enough
    -   `"bootlegt"` you are sure the meta data is fine, or it does not exist online.
        Drop files to import as-is in here, _but still create one subfolder for each
        import session you want to create_. (Beets acts on _folders_.
        Files directly inside the inbox wont trigger an imported)

```yaml
gui:
    inbox:
        folders:
            Inbox1:
                name: "Dummy inbox"
                path: "/music/dummy"
                autotag: no
                # do not automatically trigger tagging and do not automatically import

            Inbox2:
                name: "An Inbox that only generates the previews"
                path: "/music/inbox_preview"
                autotag: "preview"
                # trigger tag but do not import, recommended for most control

            Inbox3:
                name: "Auto Inbox"
                path: "/music/inbox_auto"
                autotag: "auto"
                # trigger tag and import if a good match is found based on `auto_threshold`

                auto_threshold: null
                # if set to null, uses the value in beets config (match.strong_rec_thresh)
                # define the distance from a perfect match, i.e. set to 0.1 to import
                # matches with 90% similarity or better.

            Inbox4:
                name: "Paul's Bootlegs"
                path: "/music/inbox_bootlegs"
                autotag: "bootleg"
                # Import as-is using the meta data of files, and group albums
                # using the metadata, even if they are in the same folder
                # Effectively `beet import ... --group-albums -A`
```
