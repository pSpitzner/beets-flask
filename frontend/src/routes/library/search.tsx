import { OctagonX,  X } from "lucide-react";
import {
    createContext,
    Dispatch,
    SetStateAction,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { IconButton, InputAdornment, Paper, Tooltip } from "@mui/material";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import TextField from "@mui/material/TextField";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import {
    MinimalAlbum,
    MinimalItem,
    queryClient,
    searchQueryOptions,
    SearchResult,
} from "@/components/common/_query";
import { useDebounce } from "@/components/common/useDebounce";
import List from "@/components/library/list";
import { JSONPretty } from "@/components/common/json";

export const Route = createFileRoute("/library/search")({
    component: SearchPage,
});

type SearchType = "item" | "album";

interface SearchContextType {
    query: string;
    setQuery: Dispatch<SetStateAction<string>>;
    type: SearchType;
    setType: Dispatch<SetStateAction<SearchType>>;
    results?: (MinimalItem | MinimalAlbum)[];
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
    results: [],
    isFetching: true,
    isError: true,
    error: null,
    cancelSearch: () => {},
    resetSearch: () => {},
});

function SearchContextProvider({ children }: { children: React.ReactNode }) {
    const [query, setQuery] = useState<string>("");
    const [type, setType] = useState<SearchType>("item");

    // Debounce search by 500ms
    const debouncedQuery = useDebounce(query, 750);

    const {
        data: data,
        isFetching,
        isError,
        error,
    } = useQuery({
        ...searchQueryOptions<MinimalItem | MinimalAlbum>({
            searchFor: debouncedQuery,
            kind: type,
        }),
        enabled: debouncedQuery.length > 0,
    });

    // Cancel a currently running query
    // reactquery also does this on demount if abort signals are set
    const cancelSearch = useCallback(() => {
        queryClient
            .cancelQueries({ queryKey: ["search", type, query] })
            .catch(console.error);
    }, [type, query]);

    // Reset the search to the default state
    const resetSearch = useCallback(() => {
        setQuery("");
        setType("item");
    }, []);

    return (
        <SearchContext.Provider
            value={{
                query,
                setQuery,
                type,
                setType,
                results: data?.results,
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

function useSearchContext() {
    const context = useContext(SearchContext);
    if (!context) {
        throw new Error("useSeachContext must be used within a SearchContextProvider");
    }
    return context;
}

function SearchPage() {
    return (
        <SearchContextProvider>
            <SearchBar />

            <Box sx = {{
                marginTop: "0.5rem",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
            }}>
                <SearchResults />
            </Box>
        </SearchContextProvider>
    );
}

function SearchBar() {
    const searchFieldRef = useRef<HTMLInputElement>(null);
    const { query, setQuery, type, setType } = useSearchContext();

    function handleTypeChange(
        _e: React.MouseEvent<HTMLElement>,
        newType: SearchType | null
    ) {
        if (newType !== null) {
            setType(newType);
        }
    }

    function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
        setQuery(e.target.value);
    }

    return (
        <Box
            component="form"
            noValidate
            autoComplete="off"
            sx={{
                display: "flex",
                flexDirection: "row",
            }}
            onSubmit={(e) => {
                e.preventDefault();
            }}
        >
            <TextField
                inputRef={searchFieldRef}
                sx={{
                    width: "100%",
                    marginRight: "0.5rem",
                    "& .MuiOutlinedInput-root": {
                        "& fieldset": {
                            borderColor: "#A2A2A355",
                            borderWidth: "1px",
                        },
                    },
                }}
                id="search_field"
                label={`Search ${type}s`}
                value={query}
                variant="outlined"
                type="search"
                onInput={handleInput}
                InputProps={{
                    endAdornment: (
                        <CancelSearchButton searchFieldRef={searchFieldRef} />
                    ),
                }}
            />

            {/* Type selector */}
            <ToggleButtonGroup
                color="primary"
                value={type}
                exclusive
                onChange={handleTypeChange}
                aria-label="Search Kind"
            >
                <ToggleButton value="item">Item</ToggleButton>
                <ToggleButton value="album">Album</ToggleButton>
            </ToggleButtonGroup>
        </Box>
    );
}

function CancelSearchButton({
    searchFieldRef,
}: {
    searchFieldRef: React.RefObject<HTMLInputElement>;
}) {
    const { cancelSearch, resetSearch, isFetching, query } = useSearchContext();

    return (
        <InputAdornment position="end">
            <Tooltip title={isFetching ? "Cancel search" : "Clear search"}>
                <IconButton
                    edge="end"
                    onClick={(e: React.MouseEvent) => {
                        e.preventDefault();
                        cancelSearch();
                        resetSearch();
                        if (searchFieldRef.current) {
                            searchFieldRef.current.focus();
                        }
                    }}
                >
                    {isFetching ? (
                        <OctagonX size={20} />
                    ) : (
                        <X
                            size={20}
                            style={{
                                opacity: query.length > 0 ? 1 : 0.5,
                            }}
                        />
                    )}
                </IconButton>
            </Tooltip>
        </InputAdornment>
    );
}

function SearchResults() {
    const { isError, error, isFetching, type, query, results } = useSearchContext();

    if (isError) {
        return (
            <>
                    <span>Error loading results:</span>
                    <JSONPretty error={error} />
            </>
        );
    }

    if (isFetching) {
        return (
            <Box
                sx={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                }}
            >
                <CircularProgress />
                <span>
                    Searching {type}s with `{query}` ...
                </span>
            </Box>
        );
    }

    if (results === undefined) {
        return <span>We shall explain some beets query commands here.</span>;
    }

    if (results.length === 0) {
        return (
            <span>
                No {type}s found with `{query}`
            </span>
        );
    }


    // Show results!
    return (
        <Box>
            {type === "item" && (
                <ItemResultsBox />
            )}
            {type === "album" && (
                <AlbumResultsBox />
            )}
        </Box>
    );
}



function ItemResultsBox() {

    const { results } = useSearchContext() as { results: MinimalItem[] };


    const data = useMemo(() => {
        return results.map((item) => ({
            // to: `${LIB_BROWSE_ROUTE}/$artist`,
            // params: { artist: artist.name },
            label: `${item.artist} - ${item.name}`,
            // className: styles.listItem,
            // "data-selected": params.artist && params.artist == artist.name,
        }));
    }, [results]);

    useEffect(() => {
        console.log(data);
    }, [data]);


    return (
        <Paper>
            <Box sx={{ width: "300px", height: "400px" }}>
                <List data={data}>{List.Item}</List>
            </Box>
        </Paper>
    );
}

function AlbumResultsBox() {

    const {results} = useSearchContext() as {results:MinimalAlbum[]};

    const data = useMemo(() => {
        return results.map((album) => ({
            label: `${album.albumartist} - ${album.name}`,
        }));
    }, [results]);

    return (
        <Paper>
            <Box sx={{ width: "100%", height: "400px" }}>
                <List data={data}>{List.Item}</List>
            </Box>
        </Paper>
    );
}
