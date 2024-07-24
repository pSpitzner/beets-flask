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
import List from "@/components/library/list";

export const Route = createFileRoute("/library/search")({
    component: SearchPage,
});

function SearchPage() {
    const [searchBoxText, setSearchBoxText] = useState("");
    const [searchBoxKind, setSearchBoxKind] = useState<"item" | "album">("item");
    const [searchKind, setSearchKind] = useState<"item" | "album">("item");
    const [searchTerm, setSearchTerm] = useState("");
    const [searching, setSearching] = useState(false);

    const searchFieldRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (searchFieldRef.current) {
            searchFieldRef.current.focus();
        }
    }, []);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchBoxText(e.target.value);
    };

    const handleKindChange = (
        _e: React.MouseEvent<HTMLElement>,
        newKind: "album" | "item"
    ) => {
        if (!["item", "album"].includes(newKind)) {
            // mui bug? newKind is null if the currently selected button is pressed again
            newKind = searchBoxKind;
        }
        setSearchBoxKind(newKind);
    };

    const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            e.preventDefault();
            startSearch();
        } else if (e.key == "Escape") {
            cancelSearch();
        }
    };

    const clearSearch = useCallback(() => {
        setSearchBoxText("");
        setSearchTerm("");
        setSearching(false);
    }, []);

    const cancelSearch = useCallback(() => {
        queryClient
            .cancelQueries({ queryKey: ["search", searchKind, searchTerm] })
            .catch(console.error);
        setSearching(false);
    }, [searchTerm, searchKind]);

    const startSearch = useCallback(() => {
        console.log(`searching: ${searchBoxKind} ${searchBoxText}`);
        cancelSearch();
        setSearchKind(searchBoxKind);
        setSearchTerm(searchBoxText);
        setSearching(true);
    }, [searchBoxText, searchBoxKind, cancelSearch]);

    const { data: searchRes, isFetching } = useQuery({
        ...searchQueryOptions<MinimalItem | MinimalAlbum>({
            searchFor: searchTerm,
            kind: searchKind,
        }),
        enabled: searching && searchTerm.length > 0,
    });

    useEffect(() => {
        if (isFetching && searching) {
            setSearching(false);
        }
    }, [isFetching, searching]);

    return (
        <>
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
                    startSearch();
                }}
            >
                <TextField
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
                    label={`Search ${searchBoxKind}s`}
                    value={searchBoxText}
                    variant="outlined"
                    type="search"
                    onChange={handleInputChange}
                    onKeyDown={handleInputKeyDown}
                    inputRef={searchFieldRef}
                    InputProps={{
                        endAdornment: (
                            <CancelSearchButton
                                text={searchBoxText}
                                isFetching={isFetching}
                                cancelSearch={cancelSearch}
                                clearSearch={clearSearch}
                                searchFieldRef={searchFieldRef}
                            />
                        ),
                    }}
                />

                <ToggleButtonGroup
                    color="primary"
                    value={searchBoxKind}
                    exclusive
                    onChange={handleKindChange}
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
                        Searching {searchBoxKind} with `{searchTerm}` ...
                    </>
                )}
                {!isFetching && searchRes && (
                    <ResultsBox searchRes={searchRes} kind={searchKind} />
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
