import { OctagonX, X } from "lucide-react";
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
} from "@/components/common/_query";
import { JSONPretty } from "@/components/common/json";
import { useDebounce } from "@/components/common/useDebounce";
import List from "@/components/library/list";

import styles from "./search.module.scss";

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
    results: [],
    sentQuery: "",
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
            kind: type,
        }),
        enabled: sentQuery.length > 0,
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
            <Box className={styles.SearchPageOuter}>
                <SearchBar />
                <Box className={styles.SearchResultsWrapper}>
                    <SearchResults />
                </Box>
            </Box>
        </SearchContextProvider>
    );
}

function SearchBar() {
    const searchFieldRef = useRef<HTMLInputElement>(null);
    const { query, setQuery, type, setType } = useSearchContext();

    useEffect(() => {
        if (searchFieldRef.current) {
            searchFieldRef.current.focus();
        }
    }, [searchFieldRef]);

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
            className={styles.SearchBarOuter}
            onSubmit={(e) => {
                e.preventDefault();
            }}
        >
            <TextField
                inputRef={searchFieldRef}
                className={styles.SearchBarTextField}
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
    const { isError, error, isFetching, type, sentQuery, results } = useSearchContext();

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
            <Box className={styles.SearchResultsLoading}>
                <CircularProgress />
                <span>
                    Searching {type}s with <code>{sentQuery}</code> ...
                </span>
            </Box>
        );
    }

    if (results === undefined) {
        return <BeetsSearchHelp />;
    }

    if (results.length === 0) {
        return (
            <span>
                No {type}s found with <code>{sentQuery}</code>
            </span>
        );
    }

    // Show results!
    return (
        <>
            {type === "item" && <ItemResultsBox />}
            {type === "album" && <AlbumResultsBox />}
        </>
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

    return (
        <Paper className={styles.h100w100}>
            <Box className={styles.h100w100}>
                <List data={data}>{List.Item}</List>
            </Box>
        </Paper>
    );
}

function AlbumResultsBox() {
    const { results } = useSearchContext() as { results: MinimalAlbum[] };

    const data = useMemo(() => {
        return results.map((album) => ({
            label: `${album.albumartist} - ${album.name}`,
        }));
    }, [results]);

    return (
        <Paper className={styles.h100w100}>
            <Box className={styles.h100w100}>
                <List data={data}>{List.Item}</List>
            </Box>
        </Paper>
    );
}

function BeetsSearchHelp() {
    return (
        <Box className={styles.BeetsSearchHelpOuter}>
            <Box className={styles.BeetsSearchHelp}>
                <h1>Search uses beets&apos; query syntax</h1>
                <ul>
                    <li>
                        combine keywords with a space (AND):{" "}
                        <code>magnetic tomorrow</code>
                    </li>
                    <li>
                        combine keywords with a comma (OR):{" "}
                        <code>magnetic tomorrow , beatles yesterday</code>
                    </li>
                    <li>
                        search specific fields: <code>artist:dream</code>
                    </li>
                    <li>
                        escape phrases: <code>&quot;the rebel&quot;</code> or{" "}
                        <code>the\ rebel</code>
                    </li>
                    <li>
                        use <code>-</code> or <code>^</code> to exclude a term:{" "}
                        <code>^difficult</code>
                    </li>
                </ul>

                <h1>Exact matches</h1>
                <ul>
                    <li>
                        <code>artist:air</code> substring match, default
                    </li>
                    <li>
                        <code>artist:=~air</code> exact match, ignore case
                    </li>
                    <li>
                        <code>artist:=AIR</code> exact match, case sensitive
                    </li>
                    <li>
                        work on phrases: <code>artist:=~&quot;dave matthews&quot;</code>
                    </li>
                    <li>
                        can be used across <em>all</em> fields: <code>=~crash</code>
                    </li>
                </ul>

                <h1>
                    To use Regexp, add an extra <code>:</code>
                </h1>
                <ul>
                    <li>
                        <code>&quot;artist::Ann(a|ie)&quot;</code> finds artists Anna
                        Calvi and Annie but not Annuals
                    </li>
                    <li>
                        <code>&quot;:Ho[pm]eless&quot;</code> to search all fields
                    </li>
                </ul>

                <h1>Common fields</h1>
                <ul>
                    <li>
                        <code>title</code> <code>album</code> <code>genre</code>{" "}
                        <code>label</code> <code>isrc</code>
                    </li>
                    <li>
                        <code>artist</code> (only for items, not albums)
                    </li>
                    <li>
                        <code>albumartist</code> <code>albumartist_sort</code>{" "}
                        <code>albumtype</code>
                    </li>
                    <li>
                        <code>year</code> <code>added</code> <code>comment</code>{" "}
                        <code>data_source</code>
                    </li>
                    <li>
                        <code>path</code> (searches recursively in sub directories)
                    </li>
                </ul>
            </Box>
        </Box>
    );
}
