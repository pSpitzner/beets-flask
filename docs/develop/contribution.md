# Contribution Guide

We appreciate any help! If you want to contribute, here is how to get started:

## Clone the Repository

```bash
git clone
cd beets-flask
```

## Setup

We use a development container for a consistent development environment across devices You can use the provided `docker-compose-dev.yaml` to start a development container.

```bash
docker-compose -f docker-compose-dev.yaml up --build
```

This mounts `./` to `/repo` in the container for live reloading and enhanced development experience and starts the development flask server and serves the frontend at `http://localhost:5173`.

### Apple Issues

Normally the dependencies (inside the container) should be installed automatically, but we noticed that
especially on Apple Silicon, the dependency installation can fail. In this case, you can install the dependencies manually:

```bash
docker exec -it beets-flask-dev bash
cd /repo/frontend

pnpm install
pnpm run dev
```

If you are having issues installing dependencies with pnpm, try:

```bash
rm -rf /repo/frontend/node_modules
rm -rf /repo/frontend/dist
rm -rf /repo/.pnpm-store
pnpm store prune

# and/or reset the lockfile
rm -rf /frontend/pnpm-lock.json
```

## Pull requests

Please make sure the tests pass and the code is linted before submitting a pull request. We recommend to setup pre-commit hooks to ensure this.

```bash
pip install pre-commit
pre-commit install
```
^
This should now automatically reject commits that do not pass the linting and formatting checks.

You may run our tests locally with:
```bash
cd backend
pip install .[dev,test]
pytest
```

Further if you want to make sure that the types are correct, you can run:
```bash
cd backend
mypy beets_flask
```

## Additional Resources

If you want to contribute and don't know where to start, you can check out our [open issues](https://github.com/pSpitzner/beets-flask/issues) or checkout the [project board](https://github.com/users/pSpitzner/projects/2) for the current state of the project and what we are working on currently.

See also our [developer resources](./resources/index.md) for some background information if you need more information on the codebase.

Thank you for contributing! We highly appreciate any feedback and help.
