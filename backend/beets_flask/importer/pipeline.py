""" Added type hints to decorators because it is annopying to have to look up the type of the function usage. """

from typing import Callable, TypeVar, ParamSpec, Generator, Tuple, Any


from beets import importer

T = TypeVar("T")


def mutator_stage(
    func: Callable[..., T],
) -> Callable[
    ..., Generator[importer.ImportTask | None, importer.ImportTask | None, None]
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
        *args: Tuple,
    ) -> Generator[importer.ImportTask | None, importer.ImportTask | None, None]:
        task: importer.ImportTask | None = None
        while True:
            task = yield task
            func(
                *(args + (task,)),
            )

    return coro
