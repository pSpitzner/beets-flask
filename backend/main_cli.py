import click
import uvicorn


@click.command()
@click.option("--mode", default="dev_local", help="Mode to run the server in")
@click.option("--host", default="127.0.0.1", help="Host to bind to")
@click.option("--port", default=5001, help="Port to bind to")
@click.option("--log-level", default="info", help="Log level")
@click.option("--reload", is_flag=True, help="Enable auto-reload")
@click.option("--workers", default=4, help="Number of workers")
def start(mode, host, port, log_level, reload, workers):

    # Set environment variable for mode
    import os

    # TODO: this works for dev server but prod might need a different Workerclass
    # see https://www.uvicorn.org/deployment/
    os.environ["IBEETS_MODE"] = mode
    uvicorn.run(
        f"interactive_beets:create_app",
        host=host,
        port=port,
        factory=True,
        log_level=log_level,
        reload=reload,
        workers=workers,
    )


if __name__ == "__main__":
    start()
