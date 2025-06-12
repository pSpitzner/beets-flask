import {
    createContext,
    Dispatch,
    SetStateAction,
    useCallback,
    useContext,
    useState,
} from "react";
import { useInfiniteQuery, UseInfiniteQueryResult } from "@tanstack/react-query";

import { queryClient } from "@/api/common";
import {
    Album,
    albumsInfiniteQueryOptions,
    Item,
    itemsInfiniteQueryOptions,
} from "@/api/library";
import { useDebounce } from "@/components/common/hooks/useDebounce";

import { useLocalStorage } from "../../common/hooks/useLocalStorage";

export type SearchType = "item" | "album";
type OrderBy<T extends "item" | "album"> = T extends "item"
    ? Parameters<typeof itemsInfiniteQueryOptions>[0]["orderBy"]
    : Parameters<typeof albumsInfiniteQueryOptions>[0]["orderBy"];

interface SearchContextType {
    query: string;
    debouncedQuery?: string; // Optional for debounced query, if needed
    setQuery: (value: string) => void;
    queryState: {
        orderByItems: OrderBy<"item">;
        orderByAlbums: OrderBy<"album">;
        orderDirection: "ASC" | "DESC";
    };
    setQueryState: (value: {
        orderByItems: OrderBy<"item">;
        orderByAlbums: OrderBy<"album">;
        orderDirection: "ASC" | "DESC";
    }) => void;
    type: SearchType;
    setType: Dispatch<SetStateAction<SearchType>>;
    queryItems?: UseInfiniteQueryResult<
        {
            items: Item<true>[];
            total: number;
        },
        Error
    >;
    queryAlbums?: UseInfiniteQueryResult<
        {
            albums: Album<false, true>[];
            total: number;
        },
        Error
    >;
    cancelSearch: () => void;
    resetSearch: () => void;
}

const SearchContext = createContext<SearchContextType | null>(null);

const STORAGE_KEY = "library.search";
const DEFAULT_STORAGE_VALUE = {
    query: "",
    orderByItems: "title" as const,
    orderByAlbums: "album" as const,
    orderDirection: "ASC" as const,
};

export function SearchContextProvider({ children }: { children: React.ReactNode }) {
    const [query, setQuery] = useLocalStorage<string>(STORAGE_KEY + ".query", "");
    const [queryState, setQueryState] = useLocalStorage<{
        orderByItems: Parameters<typeof itemsInfiniteQueryOptions>[0]["orderBy"];
        orderByAlbums: Parameters<typeof albumsInfiniteQueryOptions>[0]["orderBy"];
        orderDirection: "ASC" | "DESC";
    }>(STORAGE_KEY + ".query_state", DEFAULT_STORAGE_VALUE);
    // Debounce search by 750ms
    let debouncedQuery = useDebounce(query, 750);

    const [type, setType] = useState<SearchType>("item");

    // deal with trailing escape-characters the same way as in the backend,
    // so we correctly reflect frontend-side what we are actually searching for
    if (
        debouncedQuery.endsWith("\\") &&
        (debouncedQuery.length - debouncedQuery.replace(/\\+$/, "").length) % 2 === 1
    ) {
        debouncedQuery = debouncedQuery.slice(0, -1);
    }

    // Getting typing to work here is kinda tricky, no idea but i cant figure it out
    // that's why we have two separate queries for items and albums and not one generic one
    const queryItems = useInfiniteQuery({
        ...itemsInfiniteQueryOptions({
            query: debouncedQuery,
            orderBy: queryState.orderByItems,
            orderDirection: queryState.orderDirection,
        }),
        enabled: debouncedQuery.length > 0 && type === "item",
    });

    const queryAlbums = useInfiniteQuery({
        ...albumsInfiniteQueryOptions({
            query: debouncedQuery,
            orderBy: queryState.orderByAlbums,
            orderDirection: queryState.orderDirection,
        }),
        enabled: debouncedQuery.length > 0 && type === "album",
    });

    // Cancel a currently running query
    // reactquery also does this on demount if abort signals are set
    const cancelSearch = useCallback(() => {
        queryClient.cancelQueries({ queryKey: ["albums"] }).catch(console.error);
        queryClient.cancelQueries({ queryKey: ["items"] }).catch(console.error);
    }, []);

    // Reset the search to the default state
    const resetSearch = useCallback(() => {
        setQuery("");
        setQueryState(DEFAULT_STORAGE_VALUE);
    }, [setQuery, setQueryState]);

    return (
        <SearchContext.Provider
            value={{
                query,
                debouncedQuery,
                setQuery,
                queryState,
                setQueryState,
                type,
                setType,
                queryItems,
                queryAlbums,
                cancelSearch,
                resetSearch,
            }}
        >
            {children}
        </SearchContext.Provider>
    );
}

export function useSearchContext() {
    const context = useContext(SearchContext);
    if (!context) {
        throw new Error("useSeachContext must be used within a SearchContextProvider");
    }
    return context;
}
