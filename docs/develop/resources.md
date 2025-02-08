# Developer resources

This document is meant as a primer for developers who want to get started with our codebase. Once you feel comfortable with the code, you may want to check out our [contribution guide](develop/contribution.md).


```{admonition} Note
This document is the old `Resources.md` file. It is currently being restructured, feel free to open an issue or a pull request if you have any suggestions.
```



## Documentation

For documentation we use [sphinx](https://www.sphinx-doc.org/en/master/) and [MyST](https://myst-parser.readthedocs.io/en/latest/). This allows us to write markdown files and include them in the documentation. You can find all documentation files in the `docs` folder.

You may build the documentation locally with.

```bash
# Install the requirements
cd backend
pip install -e .[docs]
# Build the documentation
cd ../docs
make html
```

## Environment variables

The configuration folders can be set via environment variables. This might be useful if you want to run the application in a different environment. The following values are our defaults:

```
BEETSDIR="/config/beets"
BEETSFLASKDIR="/config/beets-flask"
```


## Docker

We use docker for development and deployment. You can find the files needed to build the docker images in the `docker` folder.


### Entrypoins

We use different entrypoints for the different environments. You can find all scripts in the `docker/entrypoints` folder.



## Frontend

The frontend is a website that is statically generated on build with the help of [Vite](https://vitejs.dev/). You can find all realted files in the `frontend` folder.


We use the follow `Tech Stack`:

-   [React](https://react.dev/)
-   [Vite](https://vitejs.dev/)
-   [Tanstack router](https://tanstack.com/router/latest)
-   [MUI Core](https://mui.com/material-ui/all-components/)
-   [Lucide icons](https://lucide.dev/icons/)


## Backend

