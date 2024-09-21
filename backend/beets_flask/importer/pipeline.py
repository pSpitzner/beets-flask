""" Added type hints to decorators because it is annopying to have to look up the type of the function usage. """

import inspect
from typing import (
    Callable,
    Concatenate,
    Protocol,
    TypeVar,
    ParamSpec,
    Generator,
    Tuple,
    Any,
    TypedDict,
)

from beets import importer

T = TypeVar("T")  # Return type of the original function
P = ParamSpec("P")  # ParamSpec for capturing parameters of the decorated function


def mutator_stage(
    func: Callable[..., T],
) -> Callable[
    ...,
    Generator[importer.ImportTask | None, importer.ImportTask | None, None],
]:
    """Decorate a function that manipulates items in a coroutine to
    become a simple stage.

    >>> @mutator_stage
    ... def setkey(key, item):
    ...     item[key] = True
    >>> pipe = Pipeline([
    ...     iter([{'x': False}, {'a': False}]),
    ...     setkey('x'),
    ... ])
    >>> list(pipe.pull())
    [{'x': True}, {'a': False, 'x': True}]
    """

    def coro(
        *args: P.args,  # Capture the original function's arguments
        **kwargs: P.kwargs,  # Capture the original function's keyword arguments
    ) -> Generator[importer.ImportTask | None, importer.ImportTask | None, None]:
        task: importer.ImportTask | None = None

        # Inspect function signature to determine if it accepts a task
        t_sig = inspect.signature(func).parameters.get("task")

        if t_sig is not None and t_sig.annotation is not importer.ImportTask:
            raise TypeError(
                f"Function {func} must have `task` argument of type `ImportTask"
            )

        while True:
            task = yield task
            if t_sig:
                kwargs["task"] = task
            func(*args, **kwargs)  # type: ignore

    return coro
