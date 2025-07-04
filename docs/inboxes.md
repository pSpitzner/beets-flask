# Inboxes

In your `config.yml` you may add multiple inboxes, each may have a different purpose.


The `gui.inbox.folders` section allows you to define multiple inboxes, each with a name, path, and an `autotag` setting. The `autotag` setting determines how the files in the inbox are processed by beets-flask. 


## Autotag settings

- <i data-lucide="inbox"></i> `"no"` you have to do everything manually.
- <i data-lucide="tag"></i> `"preview"` fetch meta data from online sources, but don't import yet.
- <i data-lucide="rocket"></i> `"auto"` fetch meta data, and import if the match is good enough (based on threshold).
- <svg class="icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-sneaker-icon lucide-sneaker"><path d="M14.1 7.9 12.5 10"/><path d="M17.4 10.1 16 12"/><path d="M2 16a2 2 0 0 0 2 2h13c2.8 0 5-2.2 5-5a2 2 0 0 0-2-2c-.8 0-1.6-.2-2.2-.7l-6.2-4.2c-.4-.3-.9-.2-1.3.1 0 0-.6.8-1.2 1.1a3.5 3.5 0 0 1-4.2.1C4.4 7 3.7 6.3 3.7 6.3A.92.92 0 0 0 2 7Z"/><path d="M2 11c0 1.7 1.3 3 3 3h7"/></svg> `"bootleg"` you are sure the meta data is fine, or it does not exist online.    
    Drop files to import as-is in here, _but still create one subfolder for each
    import session you want to create_. (Beets acts on _folders_.
    Files directly inside the inbox wont trigger an imported)


## Example configuration

Note that the top label (i.e. Inbox1, Inbox2...) does not matter.

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
