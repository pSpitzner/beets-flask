import {
    createContext,
    Dispatch,
    SetStateAction,
    useCallback,
    useContext,
    useState,
} from "react";
import { useQuery } from "@tanstack/react-query";

import { queryClient } from "@/api/common";
import { Album, Item, searchQueryOptions } from "@/api/library";
import { useDebounce } from "@/components/common/hooks/useDebounce";

export type SearchType = "item" | "album";

interface SearchContextType<T extends "item" | "album"> {
    query: string;
    setQuery: Dispatch<SetStateAction<string>>;
    type: T;
    setType: Dispatch<SetStateAction<SearchType>>;
    selectedResult?: number;
    setSelectedResult: Dispatch<SetStateAction<number | undefined>>;
    results?: (T extends "item" ? Item<true> : Album<true, false>)[] | null;
    sentQuery: string;
    isFetching: boolean;
    isError: boolean;
    error: Error | null;
    cancelSearch: () => void;
    resetSearch: () => void;
}

const SearchContext = createContext<SearchContextType<"item" | "album"> | null>(null);

export function SearchContextProvider({ children }: { children: React.ReactNode }) {
    const [query, setQuery] = useState<string>("");
    const [type, setType] = useState<SearchType>("item");
    const [selectedResult, setSelectedResult] = useState<number | undefined>(undefined);

    // Debounce search by 750ms
    let debouncedQuery = useDebounce(query, 750);

    // deal with trailing escape-characters the same way as in the backend,
    // so we correctly reflect frontend-side what we are actually searching for
    if (
        debouncedQuery.endsWith("\\") &&
        (debouncedQuery.length - debouncedQuery.replace(/\\+$/, "").length) % 2 === 1
    ) {
        debouncedQuery = debouncedQuery.slice(0, -1);
    }

    const {
        data: data,
        isFetching,
        isError,
        error,
    } = useQuery({
        ...searchQueryOptions(debouncedQuery, type),
        enabled: debouncedQuery.length > 0,
    });

    // Cancel a currently running query
    // reactquery also does this on demount if abort signals are set
    const cancelSearch = useCallback(() => {
        queryClient
            .cancelQueries({ queryKey: ["search", type, query] })
            .catch(console.error);
        setSelectedResult(undefined);
    }, [type, query, setSelectedResult]);

    // Reset the search to the default state
    const resetSearch = useCallback(() => {
        setQuery("");
        setSelectedResult(undefined);
    }, []);

    return (
        <SearchContext.Provider
            value={{
                query,
                setQuery,
                type,
                setType,
                selectedResult,
                setSelectedResult,
                results: data,
                sentQuery: debouncedQuery,
                isFetching,
                isError,
                error,
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
