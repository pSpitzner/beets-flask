import { CircleX, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

export const Route = createFileRoute("/library/search")({
    component: SearchPage,
});

type SearchType = "item" | "album";

/** Searches are typically done with a debounce
 * to prevent too many requests to the server while a user
 * is typing. Pressing enter to trigger searches
 * is not really done anymore tbh.
 * Should be fine in my opinion and makes
 * the search a bit more responsive.
 *
 * I opted to move some things into an small hook,
 * to isolate search logic from ui logic,
 * if many smaller components modify the search
 * or it gets more complicated feel free to move it into
 * a context.
 *
 */
function useSearch() {
    const [query, setQuery] = useState<string>("");
    const [type, setType] = useState<SearchType>("item");

    // Debounce search by 500ms
    const debouncedQuery = useDebounce(query, 500);

    const {
        data: results,
        isFetching,
        isError,
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

    return {
        query,
        setQuery,
        type,
        setType,
        results,
        isFetching,
        isError,
        cancelSearch,
        resetSearch,
    };
}

function SearchPage() {
    const searchFieldRef = useRef<HTMLInputElement>(null);

    const {
        query,
        setQuery,
        type,
        setType,
        results,
        isFetching,
        isError,
        cancelSearch,
        resetSearch,
    } = useSearch();

    useEffect(() => {
        if (searchFieldRef.current) {
            searchFieldRef.current.focus();
        }
    }, []);

    function handleTypeChange(
        _e: React.MouseEvent<HTMLElement>,
        newKind: SearchType | null
    ) {
        if (!newKind) return;
        // mui bug? newKind is null if the currently selected button is pressed again
        // SBM: not a bug, it is triggering a deselect, you are not using a radio but a button!
        // To prevent this you may want to add a radio element instead
        setType(newKind);
    }

    function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
        setQuery(e.target.value);
    }

    /** Some more general remarks:
     *
     * I would modularize the components a bit
     * and create a search context. This would allow
     * to share the current search state more
     * easily. E.g. inside the cancel button
     *
     * Same goes for the results, error messages
     */

    return (
        <>
            {/*I would put this box into a searchbar component*/}
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
                            <CancelSearchButton
                                text={query}
                                isFetching={isFetching}
                                cancelSearch={cancelSearch}
                                clearSearch={resetSearch}
                                searchFieldRef={searchFieldRef}
                            />
                        ),
                    }}
                />

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
            <Box>
                {isFetching && (
                    <>
                        <CircularProgress />
                        Searching {type} with `{query}` ...
                    </>
                )}
                {!isFetching && results && (
                    <ResultsBox searchRes={results} kind={type} />
                )}
            </Box>
        </>
    );
}

function CancelSearchButton({
    text: searchTerm,
    isFetching,
    cancelSearch,
    clearSearch,
    searchFieldRef,
}: {
    text: string;
    isFetching: boolean;
    cancelSearch: () => void;
    clearSearch: () => void;
    searchFieldRef: React.RefObject<HTMLInputElement>;
}) {
    return (
        <InputAdornment position="end">
            <Tooltip title="Cancel search">
                <IconButton
                    edge="end"
                    onClick={(e: React.MouseEvent) => {
                        e.preventDefault();
                        cancelSearch();
                        clearSearch();
                        if (searchFieldRef.current) {
                            searchFieldRef.current.focus();
                        }
                    }}
                >
                    {isFetching ? (
                        <X size={20} />
                    ) : (
                        <CircleX
                            size={20}
                            style={{
                                opacity: searchTerm.length > 0 ? 1 : 0.5,
                            }}
                        />
                    )}
                </IconButton>
            </Tooltip>
        </InputAdornment>
    );
}

function ResultsBox({
    searchRes,
    kind,
}: {
    searchRes: SearchResult<MinimalItem | MinimalAlbum>;
    kind: "album" | "item";
}) {
    if (kind === "item") {
        return <ItemResultsBox searchRes={searchRes as SearchResult<MinimalItem>} />;
    } else if (kind === "album") {
        return <AlbumResultsBox searchRes={searchRes as SearchResult<MinimalAlbum>} />;
    }

    return (
        <>
            <Paper>We shall explain some beets query commands here.</Paper>
        </>
    );
}

function ItemResultsBox({ searchRes }: { searchRes: SearchResult<MinimalItem> }) {
    const data = useMemo(() => {
        return searchRes.results.map((item) => ({
            // to: `${LIB_BROWSE_ROUTE}/$artist`,
            // params: { artist: artist.name },
            label: `${item.artist} - ${item.name}`,
            // className: styles.listItem,
            // "data-selected": params.artist && params.artist == artist.name,
        }));
    }, [searchRes]);

    return (
        <Paper>
            <Box sx={{ width: "100%", height: "400px" }}>
                <List data={data}>{List.Item}</List>
            </Box>
        </Paper>
    );
}

function AlbumResultsBox({ searchRes }: { searchRes: SearchResult<MinimalAlbum> }) {
    const data = useMemo(() => {
        return searchRes.results.map((album) => ({
            label: `${album.albumartist} - ${album.name}`,
        }));
    }, [searchRes]);

    return (
        <Paper>
            <Box sx={{ width: "100%", height: "400px" }}>
                <List data={data}>{List.Item}</List>
            </Box>
        </Paper>
    );
}
