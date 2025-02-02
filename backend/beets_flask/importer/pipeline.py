"""Beets pipeline overloads.

Added type hints to decorators because it is annoying to have to look up
the type of the function usage.
"""

import asyncio
import inspect
from collections.abc import AsyncGenerator, AsyncIterable
from typing import (
    Any,
    Callable,
    Coroutine,
    Generator,
    Generic,
    Iterable,
    Optional,
    ParamSpec,
    Sequence,
    Sized,
    Tuple,
    TypeVar,
    TypeVarTuple,
    Union,
    Unpack,
    cast,
)

from beets import importer
from beets.util.pipeline import Pipeline as BeetsPipeline
from beets.util.pipeline import _allmsgs

from beets_flask.logger import log

A = TypeVarTuple("A")  # args und kwargs
T = TypeVar("T")  # task
R = TypeVar("R")  # return type


def stage(
    func: Callable[
        [Unpack[A], T],  # add task to arguments
        R,
    ],
):
    """Decorate a function to become a simple stage.

    >>> @stage
    ... def add(n, i):
    ...     return i + n
    >>> pipe = Pipeline([
    ...     iter([1, 2, 3]),
    ...     add(2),
    ... ])
    >>> list(pipe.pull())
    [3, 4, 5]
    """

    def coro(*args: Unpack[A]) -> Generator[Union[R, T, None], T, None]:
        task = None
        while True:
            task = yield task  # wait for send to arrive. the first next() always returns None
            # yield task, call func which gives new task, yield new task in next()
            task = func(*(args + (task,)))

    return coro


def mutator_stage(func: Callable[[Unpack[A], T], R]):
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

    def coro(*args: Unpack[A]) -> Generator[Optional[T], T, R]:
        task = None
        while True:
            task = yield task  # wait for send to arrive. the first next() always returns None
            # perform function on task, and in next() send the same, modified task
            # funcs prob. modify task in place?
            func(*(args + (task,)))

    return coro


# --------------------------------- Pipeline --------------------------------- #

# T = Task
# yield : Task or None, send : Task, return : None
Task = TypeVar("Task", bound=Any)
Stage = Generator[Optional[Task], Task, None] | AsyncGenerator[Optional[Task], Task]


class AsyncPipeline(Generic[Task]):
    start_tasks: AsyncIterable[Task]
    stages: list[Stage[Task]]

    # Original: stages = [start_task, *stages]
    def __init__(
        self,
        start_tasks: Iterable[Task] | AsyncIterable[Task] | Task,
        stages: Sequence[Stage[Task]],
    ) -> None:
        if isinstance(start_tasks, Iterable):
            self.start_tasks = _async_iterable_from_iterable(start_tasks)
        elif isinstance(start_tasks, AsyncIterable):
            self.start_tasks = start_tasks
        else:
            self.start_tasks = _async_iterable_from_iterable([start_tasks])

        self.stages = list(stages)

    async def pull_async(self) -> AsyncGenerator[Task, None]:
        """Pull items through the pipeline.

        If item is coroutine, await it.
        """
        # Priming -> Wait for first send i.e. right side of `task = yield`
        for stage in self.stages:
            await _next_resolve_async(stage)

        async for task in self.start_tasks:
            msgs: list[Task] = _allmsgs(task)  # returns a list of tasks

            for stage in self.stages:
                next_coros: list[Coroutine] = [
                    _send_resolve_async(stage, msg) for msg in msgs
                ]
                # override for input of next stage
                msgs = []
                for out in await asyncio.gather(*next_coros):
                    msgs.extend(_allmsgs(out))

            for msg in msgs:
                yield msg

    async def run_async(self) -> None:
        """Run the pipeline asynchronously.

        This just resolves the generator.
        """
        async for _ in self.pull_async():
            # resolves the generator, and awaits each element after the previous
            pass


Y = TypeVar("Y")
S = TypeVar("S")
R = TypeVar("R")


async def _next_resolve_async(gen: Generator[Y, S, R] | AsyncGenerator[Y, S]):
    """Call next on the generator."""
    if isinstance(gen, Generator):
        return next(gen)
    else:
        return await anext(gen)


async def _send_resolve_async(
    gen: Generator[Y, S, R] | AsyncGenerator[Y, S], *args, **kwargs
):
    """Send to the generator."""
    if isinstance(gen, Generator):
        return gen.send(*args, **kwargs)
    else:
        return await gen.asend(*args, **kwargs)


async def _async_iterable_from_iterable(iterable: Iterable[T]) -> AsyncIterable[T]:
    for item in iterable:
        yield item
