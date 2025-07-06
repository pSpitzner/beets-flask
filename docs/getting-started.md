# Getting started

We provide a docker image with the full beeets-flask setup. You can run it with docker-compose or docker. We recommend using the `stable` tag, alternatively you may use `latest` for the most recent build.

## Using docker compose

Follow these steps to quickly set up and run the Beets-Flask application using Docker.

1. Create a new directory:

```bash
mkdir beets-flask
cd beets-flask
```

2. Download the `docker-compose.yaml` file or create it manually and copy the content from below.

```bash
wget https://raw.githubusercontent.com/pspitzner/beets-flask/main/docker/docker-compose.yaml
```

If you want to create it manually, you can use the following content:

```{literalinclude} ../docker/docker-compose.yaml

```

3. Edit the docker-compose.yaml file! Please change the configuration and volume paths, otherwise the application might not start or work correctly. See the [configuration](configuration) section for more information.

4. Start the application using docker-compose.

```bash
docker-compose up
```

The application should now be available at `http://localhost:5001`!

## Using docker

Similarly, you can also run the application using docker directly. Feel free to adjust the following command to your needs.

```{include} ../README.md
:start-after: <!-- start setup container -->
:end-before: <!-- end setup container -->
```

(configuration)=

## Configuration

On first container launch, config files are automatically generated in the mounted `/config` folder. Configurations are read from:

-   `config/beets/config.yaml` (for the original cli tool that we wrap)
-   `config/beets-flask/config.yaml` (for frontend and container settings)

```{warning}
Configuration changes are only applied on container restart. Restart your container with `docker restart beets-flask` after changing a configuration
option.
```

As the minimum, you need to update the information about your music folders. Edit `config/beets/config.yaml` to point to your music library: The config mount has to point to the same folders inside and outside the container!

```yaml
# config/beets/config.yaml
# Update to your mounted music folder!
directory: /music_path/clean/
```

Additionally you may edit our beets-flask configuration. Most likely, you want to configure at least on inbox:

```yaml
# config/beets-flask/config.yaml

gui:
    inbox:
        folders:
            MyInbox:
                name: "An Inbox that only generates the previews"
                path: "/music_path/inbox_preview"
                autotag: "preview"
```

-   All container and webfrontend-related settings (thus, everything in `config/beets-flask/config.yaml`) need to go into the `gui` section.
-   If you configure other fields (out of the parent `gui`) in the beets-flask config, they take precedence over the beets config. This might be useful when you want different settings for beets CLI vs the beets GUI.
-   Opinionated [examples](./backend/beets_flask/config/config_bf_example.yaml) are copied to `config/beets/config.yaml` and `config/beets-flask/config.yaml` on container launch.
-   Config changes require a container restart to take effect.

### Use your existing beets library

**Make a backup!** Your config folder `~/.config/beets/` should be the minimum.

Mount your existing beets config folder to the container. This way you can use your existing beets library and configuration.

```yaml
# docker-compose.yml
volumes:
    - ~/.config/beets/:/config/beets/
    - ~/.config/beets-flask/:/config/beets-flask/
    - /music_path/clean/:/music_path/clean/
```

Make sure that the `library` location in your beets `config.yaml` is either set to the path _inside_ the container, or not specified (the default should work).

Note that `/music_path/clean/` needs to be consistent inside and outside of the container. Otherwise beets will not be able to manage files correctly. For instance if your music is in `/home/user/music/`, you should mount with `/home/user/music/:/home/user/music/`.

### To start from scratch or with a copy of your existing library

In your docker compose, mount a fresh config folder

```yaml
# docker-compose.yml
volumes:
    - /music_path/config/:/config/
    - /music_path/inbox/:/music_path/inbox/
    - /music_path/imported/:/music_path/imported/
```

Start the container, and you will find some files placed in the mounted config folder. Then either start customizing a config here, or copy content from your `~/.config/beets/` to `/music_path/config/beets/`
