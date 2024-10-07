import { ChevronRight, OctagonX, X } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import { IconButton, InputAdornment, Paper, Tooltip } from "@mui/material";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import TextField from "@mui/material/TextField";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import { createFileRoute } from "@tanstack/react-router";

import { MinimalAlbum, MinimalItem } from "@/components/common/_query";
import {
    SearchContextProvider,
    SearchType,
    useSearchContext,
} from "@/components/common/hooks/useSearch";
import { JSONPretty } from "@/components/common/json";
import { PageWrapper } from "@/components/common/page";
import CoverArt from "@/components/library/coverArt";
import { AlbumView, ItemView } from "@/components/library/itemAlbumDetails";
import List from "@/components/library/list";

import styles from "@/components/library/library.module.scss";

export const Route = createFileRoute("/library/search")({
    component: SearchPage,
});

function SearchPage() {
    return (
        <SearchContextProvider>
            <PageWrapper className={styles.SearchPageOuter}>
                <SearchBar />
                <Box className={styles.SearchResultsWrapper}>
                    <SearchResults />
                    <SearchResultDetails />
                </Box>
            </PageWrapper>
        </SearchContextProvider>
    );
}

function SearchBar() {
    const searchFieldRef = useRef<HTMLInputElement>(null);
    const { query, setQuery, type, setType, setSelectedResult } = useSearchContext();

    useEffect(() => {
        if (searchFieldRef.current) {
            searchFieldRef.current.focus();
        }
    }, [searchFieldRef]);

    function handleTypeChange(
        _e: React.MouseEvent<HTMLElement>,
        newType: SearchType | null
    ) {
        if (newType !== null && newType !== type) {
            setType(newType);
            setSelectedResult(undefined);
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
                aria-label="Search Type"
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
        console.error("Error loading search results", error);
        return (
            <Box className={styles.SearchResultsLoading}>
                <span>Error loading results:</span>
                <JSONPretty error={error} />
            </Box>
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
            <Box className={styles.SearchResultsLoading}>
                <span>
                    No {type}s found with <code>{sentQuery}</code>
                </span>
            </Box>
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

export interface RouteParams {
    type?: SearchType;
    id?: number;
}

function ItemResultsBox() {
    const { results } = useSearchContext() as { results: MinimalItem[] };
    const { selectedResult, setSelectedResult } = useSearchContext();

    const data = useMemo(() => {
        return results.map((item) => ({
            className: styles.listItem,
            "data-selected": selectedResult !== undefined && selectedResult === item.id,
            onClick: () => setSelectedResult(item.id),
            label: (
                <Box>
                    <span className={styles.ItemResultArtist}>
                        {item.artist}
                        <ChevronRight size={14} />
                    </span>
                    <span className={styles.ItemResultName}>{item.name}</span>
                </Box>
            ),
        }));
    }, [results, selectedResult, setSelectedResult]);

    return (
        <Paper className={styles.SearchResults}>
            <Box className={styles.h100w100}>
                <List data={data}>{List.Item}</List>
            </Box>
        </Paper>
    );
}

function AlbumResultsBox() {
    const { results } = useSearchContext() as { results: MinimalAlbum[] };
    const { selectedResult, setSelectedResult } = useSearchContext();

    const data = useMemo(() => {
        return results.map((album) => ({
            className: styles.listItem,
            "data-selected": selectedResult !== undefined && selectedResult == album.id,
            onClick: () => setSelectedResult(album.id),
            label: (
                <Box>
                    <span className={styles.ItemResultArtist}>
                        {album.albumartist}
                        <ChevronRight size={14} />
                    </span>
                    <span className={styles.ItemResultName}>{album.name}</span>
                </Box>
            ),
        }));
    }, [results, selectedResult, setSelectedResult]);

    return (
        <Paper className={styles.SearchResults}>
            <Box className={styles.h100w100}>
                <List data={data}>{List.Item}</List>
            </Box>
        </Paper>
    );
}

function SearchResultDetails() {
    const { type, selectedResult } = useSearchContext();

    if (selectedResult === undefined) {
        return null;
    }

    console.log(type);
    let art = <></>;
    if (type === "item") {
        console.log("1");
        art = (
            <CoverArt
                itemId={selectedResult}
                type={type}
                showPlaceholder={false}
                className={styles.SearchResultCover}
            />
        );
    } else if (type === "album") {
        console.log("2");
        art = (
            <CoverArt
                albumId={selectedResult}
                type={type}
                showPlaceholder={false}
                className={styles.SearchResultCover}
            />
        );
    }

    return (
        <>
            <Paper className={styles.SearchResultInfoOuter}>
                <Box className={styles.SearchResultInfo}>
                    {art}
                    {type === "item" && <ItemView itemId={selectedResult} />}
                    {type === "album" && <AlbumView albumId={selectedResult} />}
                </Box>
            </Paper>
        </>
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
