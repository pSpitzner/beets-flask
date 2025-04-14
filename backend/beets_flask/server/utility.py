from typing import Any, Callable, TypeVarTuple

from quart import request

from beets_flask.logger import log
from beets_flask.server.routes.errors import InvalidUsage


def pop_query_param(
    params: dict,
    key: str,
    convert_func: Callable,
    default: Any = None,
    error_message: str | None = None,
):
    """Safely retrieves and converts a query parameter from the request args.

    Parameters
    ----------
    params : dict
        The request args.
    key : str
        The key of the parameter to retrieve.
    default : any, optional
        The default value if the parameter is not found, defaults to None.
    convert_func : callable, optional
        A function to convert the parameter value, defaults to None. Common example, just use the type: `str`, `int` etc.
    error_message : str, optional
        The error message to raise if the conversion fails, defaults to None.
    """
    if params is None:
        return default

    value = params.pop(key, None)

    if value is None:
        return default

    try:
        value = convert_func(value)
    except (ValueError, TypeError):
        if error_message is None:
            error_message = f"Invalid parameter'{key}'"
        raise InvalidUsage(error_message)

    return value


T = TypeVarTuple("T")


async def get_folder_params(
    allow_mismatch: bool = False,
    allow_empty: bool = True,
) -> tuple[list[str], list[str], Any]:
    """Get folder hashes and paths from the request parameters.

    Parameters
    ----------
    allow_mismatch : bool, optional
        Allow the folder hashes and paths to have different lengths, by default False
    allow_empty : bool, optional
        Allow empty folder hashes and paths, by default False

    Returns
    -------
        folder_hashes : list
        folder_paths : list
        params : Any

    """
    params = await request.get_json()
    folder_hashes = pop_query_param(params, "folder_hashes", list, default=[])
    folder_paths = pop_query_param(params, "folder_paths", list, default=[])

    if not allow_mismatch and len(folder_hashes) != len(folder_paths):
        raise InvalidUsage("folder_hashes and folder_paths must be of the same length")

    if not allow_empty and ((len(folder_hashes) + len(folder_paths)) == 0):
        raise InvalidUsage("folder_hashes and folder_paths cannot be empty")

    return folder_hashes, folder_paths, params
