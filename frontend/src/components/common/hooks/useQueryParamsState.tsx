import { Dispatch, SetStateAction, useEffect, useState } from "react";
import { useLocation } from "@tanstack/react-router";

type UseQueryParamsStateReturnType<T> = [T, Dispatch<SetStateAction<T>>];

/**
 * Custom hook to manage state synchronized with a URL query parameter.
 *
 * @template T - The type of the state value.
 * @param {string} param - The name of the query parameter to synchronize with.
 * @param {T} initialState - The initial state value.
 * @returns {[T, React.Dispatch<React.SetStateAction<T>>]} - Returns a tuple containing the current state value and a function to update it.
 *
 * @example
 * const [value, setValue] = useQueryParamsState<string>("myParam", "default");
 *
 */
export default function useQueryParamsState<T>(
    param: string,
    initialState: T
): UseQueryParamsStateReturnType<T> {
    const location = useLocation();

    // State for managing the value derived from the query parameter
    const [value, setValue] = useState<T>(() => {
        if (typeof window === "undefined") return initialState;

        // Parse query parameter value from the URL
        const { search } = window.location;
        const searchParams = new URLSearchParams(search);
        const paramValue = searchParams.get(param);

        return paramValue !== null ? (JSON.parse(paramValue) as T) : initialState;
    });

    useEffect(() => {
        const currentSearchParams = new URLSearchParams(window.location.search);

        // Update the query parameter with the current state value
        if (value !== null && value !== "") {
            currentSearchParams.set(param, JSON.stringify(value));
        } else {
            // Remove the query parameter if the value is null or empty
            currentSearchParams.delete(param);
        }

        // Update the URL with the modified search parameters
        const newUrl = [window.location.pathname, currentSearchParams.toString()]
            .filter(Boolean)
            .join("?");

        // Update the browser's history without triggering a page reload
        window.history.replaceState(window.history.state, "", newUrl);
    }, [param, value, location.pathname]);

    return [value, setValue];
}
