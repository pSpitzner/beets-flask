import { AudioLinesIcon, Disc3Icon, DotIcon, OctagonX, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
    IconButton,
    InputAdornment,
    Tooltip,
    Typography,
    useTheme,
} from "@mui/material";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import TextField from "@mui/material/TextField";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import { createFileRoute, Link } from "@tanstack/react-router";

import { Item } from "@/api/library";
import { JSONPretty } from "@/components/common/debugging/json";
import { PageWrapper } from "@/components/common/page";
import {
    FixedList,
    FixedListChildrenProps,
    FixedListProps,
} from "@/components/common/table";
import {
    SearchContextProvider,
    useSearchContext,
} from "@/components/library/search/context";
import { AlbumResponseMinimal } from "@/pythonTypes";

import { AlbumsList, LoadingRow } from "./browse/albums";

import styles from "@/components/library/library.module.scss";

export const Route = createFileRoute("/library/search")({
    component: SearchPage,
});

function SearchPage() {
    return (
        <SearchContextProvider>
            <PageWrapper
                sx={(theme) => ({
                    display: "flex",
                    flexDirection: "column",
                    gap: theme.spacing(1),
                    paddingTop: theme.spacing(1),
                    paddingInline: theme.spacing(1),
                    minHeight: "100%",
                    height: "100%",
                    // styling for code blocks
                    code: {
                        backgroundColor: "#212529",
                        padding: "2px 4px",
                        borderRadius: "4px",
                        fontFamily: "Courier New, Courier, monospace",
                        fontSize: "0.9em",
                        whiteSpace: "nowrap",
                    },
                })}
            >
                <SearchBar />
                <Box
                    sx={(theme) => ({
                        display: "flex",
                        flexDirection: "row",
                        gap: 1,
                        width: "100%",
                        height: "100%",

                        [theme.breakpoints.down("laptop")]: {
                            flexDirection: "column",
                        },
                    })}
                >
                    <SearchResults />
                </Box>
            </PageWrapper>
        </SearchContextProvider>
    );
}

function SearchBar() {
    const theme = useTheme();
    const searchFieldRef = useRef<HTMLInputElement>(null);
    const { query, setQuery, type, setType } = useSearchContext();

    useEffect(() => {
        if (searchFieldRef.current) {
            searchFieldRef.current.focus();
        }
    }, [searchFieldRef]);

    return (
        <Box
            component="form"
            noValidate
            autoComplete="off"
            sx={{ display: "flex", flexDirection: "row" }}
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
                onChange={(e) => setQuery(e.target.value)}
                slotProps={{
                    input: {
                        endAdornment: (
                            <CancelSearchButton searchFieldRef={searchFieldRef} />
                        ),
                    },
                }}
            />

            {/* Type selector */}
            <ToggleButtonGroup
                value={type}
                onChange={(
                    _e: React.MouseEvent<HTMLElement>,
                    v: "album" | "item" | null
                ) => {
                    if (v) setType(v);
                }}
                color="primary"
                exclusive
                aria-label="Filter type"
            >
                <ToggleButton value="item">
                    <AudioLinesIcon size={theme.iconSize.xl} />
                </ToggleButton>
                <ToggleButton value="album">
                    <Disc3Icon size={theme.iconSize.xl} />
                </ToggleButton>
            </ToggleButtonGroup>
        </Box>
    );
}

function CancelSearchButton({
    searchFieldRef,
}: {
    searchFieldRef: React.RefObject<HTMLInputElement>;
}) {
    const { cancelSearch, resetSearch, queryAlbums, queryItems, query } =
        useSearchContext();

    const isFetching = queryItems?.isFetching || queryAlbums?.isFetching;

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
    const { queryAlbums, queryItems, type, debouncedQuery } = useSearchContext();

    const isError = type === "item" ? queryItems?.isError : queryAlbums?.isError;
    const error = type === "item" ? queryItems?.error : queryAlbums?.error;
    const isFetching =
        type === "item" ? queryItems?.isFetching : queryAlbums?.isFetching;
    const results =
        type === "item" ? queryItems?.data?.items : queryAlbums?.data?.albums;

    if (isError) {
        return (
            <Box className={styles.SearchResultsLoading}>
                <span>Error loading results:</span>
                <JSONPretty error={error} />
            </Box>
        );
    }

    if (isFetching && results?.length === 0) {
        return (
            <Box className={styles.SearchResultsLoading}>
                <CircularProgress />
                <span>
                    Searching {type}s with <code>{debouncedQuery}</code> ...
                </span>
            </Box>
        );
    }

    if (results === undefined) {
        return <BeetsSearchHelp />;
    }

    if (results === null || results.length === 0) {
        return (
            <Box className={styles.SearchResultsLoading}>
                <span>
                    No {type}s found with <code>{debouncedQuery}</code>
                </span>
            </Box>
        );
    }

    return (
        <Box
            sx={{
                overflow: "hidden",
                flex: "1 1 auto",
                paddingInline: 2,
                minHeight: 0,
            }}
        >
            {type === "item" && <ItemsListAutoFetchData />}
            {type === "album" && <AlbumsListAutoFetchData />}
        </Box>
    );
}

const LISTROWHEIGHT = 50;

function ItemsListAutoFetchData({
    ...props
}: Omit<
    FixedListProps<AlbumResponseMinimal>,
    "data" | "itemCount" | "itemHeight" | "children"
>) {
    const [overScanStopIndex, setOverScanStopIndex] = useState(0);
    const { queryItems } = useSearchContext();

    const data = queryItems?.data || {
        items: [],
        total: 0,
    };
    const numLoaded = data.items.length;
    const isFetching = queryItems?.isFetching;
    const isError = queryItems?.isError;
    const fetchNextPage = queryItems?.fetchNextPage;
    const hasNextPage = queryItems?.hasNextPage;

    // Fetch new pages on scroll
    useEffect(() => {
        if (
            overScanStopIndex >= numLoaded - 10 &&
            !isFetching &&
            !isError &&
            hasNextPage
        ) {
            void fetchNextPage?.();
        }
    }, [overScanStopIndex, numLoaded, fetchNextPage, isFetching, isError, hasNextPage]);

    return (
        <FixedList
            data={data.items}
            itemCount={data.total}
            itemHeight={LISTROWHEIGHT}
            onItemsRendered={({ overscanStopIndex }) => {
                setOverScanStopIndex(overscanStopIndex);
            }}
            {...props}
        >
            {ItemsListRow}
        </FixedList>
    );
}

function AlbumsListAutoFetchData({
    ...props
}: Omit<
    FixedListProps<AlbumResponseMinimal>,
    "data" | "itemCount" | "itemHeight" | "children"
>) {
    const [overScanStopIndex, setOverScanStopIndex] = useState(0);
    const { queryAlbums } = useSearchContext();

    const data = queryAlbums?.data || {
        albums: [],
        total: 0,
    };
    const numLoaded = data.albums.length;
    const isFetching = queryAlbums?.isFetching;
    const isError = queryAlbums?.isError;
    const fetchNextPage = queryAlbums?.fetchNextPage;
    const hasNextPage = queryAlbums?.hasNextPage;

    // Fetch new pages on scroll
    useEffect(() => {
        if (
            overScanStopIndex >= numLoaded - 10 &&
            !isFetching &&
            !isError &&
            hasNextPage
        ) {
            console.log("Fetching next page of albums");
            void fetchNextPage?.();
        }
    }, [overScanStopIndex, numLoaded, fetchNextPage, isFetching, isError, hasNextPage]);

    return (
        <AlbumsList
            data={data}
            onItemsRendered={({ overscanStopIndex }) => {
                setOverScanStopIndex(overscanStopIndex);
            }}
            {...props}
        />
    );
}

function ItemsListRow({ data: item, style }: FixedListChildrenProps<Item<true>>) {
    const theme = useTheme();
    if (!item) {
        return <LoadingRow style={style} />;
    }
    return (
        <Link
            to={`/library/item/$itemId`}
            key={item.id}
            params={{ itemId: item.id }}
            preloadDelay={2000}
            style={style}
        >
            <Box
                height={LISTROWHEIGHT}
                sx={(theme) => ({
                    display: "flex",
                    alignItems: "center",
                    paddingInline: 1,
                    justifyContent: "space-between",
                    ":hover": {
                        background: `linear-gradient(to left, transparent 0%, ${theme.palette.primary.muted} 100%)`,
                        color: "primary.contrastText",
                    },
                })}
            >
                <Box sx={{ display: "flex", flexDirection: "column", mr: "auto" }}>
                    <Typography variant="body1" fontWeight="bold" color="text.primary">
                        {item.name || "Unknown Title"}
                    </Typography>
                    <Box
                        sx={{
                            display: "flex",
                            flexDirection: "row",
                            color: "text.secondary",
                            alignItems: "center",
                        }}
                    >
                        <Typography variant="body2" className={styles.ItemResultArtist}>
                            {item.artist || "Unknown Artist"}
                        </Typography>
                        <DotIcon style={{ marginLeft: "-4px", marginRight: "-4px" }} />
                        <Typography variant="body2" className={styles.ItemResultArtist}>
                            {item.album || "Unknown Album"}
                        </Typography>
                    </Box>
                </Box>
                <AudioLinesIcon color={theme.palette.background.paper} />
            </Box>
        </Link>
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
