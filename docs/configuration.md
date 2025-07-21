# Configuration

On first container launch, config files are automatically generated in the mounted `/config` folder. Configurations are read from:

-   `config/beets/config.yaml` (for the original cli tool that we wrap)
-   `config/beets-flask/config.yaml` (for frontend and container settings)

```{warning}
Configuration changes are only applied on container restart. Restart your container with `docker restart beets-flask` after changing a configuration option.
```

We extend the [default beets configuration](https://beets.readthedocs.io/en/stable/reference/config.html) with some additional options. You may use the following example configuration as a starting point. It contains all options that can be set in the `/config/beets-flask/config.yaml`.


```{literalinclude} ../backend/beets_flask/config/config_bf_example.yaml
:language: yaml
```

## Library

The `gui.library` section contains options for the library view in the web interface. It allows you to configure how the library is displayed and how we interact with the beets library.

- `artist_separators`: A list of characters that are used to split artist names in the library view. This is mainly used to handle artist searches and filtering. If you don't want this feature, you can set it to an empty list `[]`. The default is `[";", ",", "&"]`.

## Inboxes

Allows you to configure the inboxes that are used to automatically import music files into your library. You may add multiple inboxes, each may have a different purpose.


The `gui.inbox.folders` section allows you to define multiple inboxes, each with a name, path, and an `autotag` setting. The `autotag` setting determines how the files in the inbox are processed by beets-flask. 

- <i data-lucide="inbox"></i> `"no"` you have to do everything manually.
- <i data-lucide="tag"></i> `"preview"` fetch meta data from online sources, but don't import yet.
- <i data-lucide="rocket"></i> `"auto"` fetch meta data, and import if the match is good enough (based on threshold).
- <svg class="icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-sneaker-icon lucide-sneaker"><path d="M14.1 7.9 12.5 10"/><path d="M17.4 10.1 16 12"/><path d="M2 16a2 2 0 0 0 2 2h13c2.8 0 5-2.2 5-5a2 2 0 0 0-2-2c-.8 0-1.6-.2-2.2-.7l-6.2-4.2c-.4-.3-.9-.2-1.3.1 0 0-.6.8-1.2 1.1a3.5 3.5 0 0 1-4.2.1C4.4 7 3.7 6.3 3.7 6.3A.92.92 0 0 0 2 7Z"/><path d="M2 11c0 1.7 1.3 3 3 3h7"/></svg> `"bootleg"` you are sure the meta data is fine, or it does not exist online.    
    Drop files to import as-is in here, _but still create one subfolder for each
    import session you want to create_. (Beets acts on _folders_.
    Files directly inside the inbox wont trigger an imported)

#### Multiple inboxes example configuration

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

## Terminal

The `gui.terminal.start_path` option specifies the path that is used when starting the terminal in the web interface. This is useful if you want to start the terminal in a specific directory, such as your music library. The default value is `/music/inbox`. You should change this if you have a different inbox path!


## Other options

The `gui.num_preview_workers` option specifies the number of worker threads that are used to generate previews for the inboxes. This is useful to speed up the preview generation process, especially when you have a large number of items in your inboxes. The default value is `4`.

```{info}
You can use multiple workers to fetch candidates before importing (previewing). However, the import itself is always done sequentially. This is to ensure that the import process is not interrupted by other operations.
```
