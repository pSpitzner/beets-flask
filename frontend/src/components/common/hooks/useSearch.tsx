import {
    createContext,
    Dispatch,
    SetStateAction,
    useCallback,
    useContext,
    useState,
} from "react";
import { useQuery } from "@tanstack/react-query";

import {
    MinimalAlbum,
    MinimalItem,
    queryClient,
    searchQueryOptions,
} from "@/components/common/_query";
import { useDebounce } from "@/components/common/hooks/useDebounce";

export type SearchType = "item" | "album";

interface SearchContextType {
    query: string;
    setQuery: Dispatch<SetStateAction<string>>;
    type: SearchType;
    setType: Dispatch<SetStateAction<SearchType>>;
    selectedResult?: number;
    setSelectedResult: Dispatch<SetStateAction<number | undefined>>;
    results?: (MinimalItem | MinimalAlbum)[];
    sentQuery: string;
    isFetching: boolean;
    isError: boolean;
    error: Error | null;
    cancelSearch: () => void;
    resetSearch: () => void;
}

const SearchContext = createContext<SearchContextType>({
    query: "",
    setQuery: () => {},
    type: "item",
    setType: () => {},
    setSelectedResult: () => {},
    results: [],
    sentQuery: "",
    isFetching: true,
    isError: true,
    error: null,
    cancelSearch: () => {},
    resetSearch: () => {},
});

export function SearchContextProvider({ children }: { children: React.ReactNode }) {
    const [query, setQuery] = useState<string>("");
    const [type, setType] = useState<SearchType>("item");
    const [selectedResult, setSelectedResult] = useState<number | undefined>(undefined);

    // Debounce search by 500ms
    let sentQuery = useDebounce(query, 750);
    // deal with trailing escape-characters the same way as in the backend,
    // so we correctly reflect frontend-side what we are actually searching for
    if (
        sentQuery.endsWith("\\") &&
        (sentQuery.length - sentQuery.replace(/\\+$/, "").length) % 2 === 1
    ) {
        sentQuery = sentQuery.slice(0, -1);
    }

    const {
        data: data,
        isFetching,
        isError,
        error,
    } = useQuery({
        ...searchQueryOptions<MinimalItem | MinimalAlbum>({
            searchFor: sentQuery,
            type,
        }),
        enabled: sentQuery.length > 0,
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
                results: data?.results,
                sentQuery,
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
