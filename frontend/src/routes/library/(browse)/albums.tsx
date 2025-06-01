import { Disc3Icon } from "lucide-react";
import { memo, useEffect, useState } from "react";
import { Box, Skeleton, Typography, useTheme } from "@mui/material";
import { useInfiniteQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";

import { albumsInfiniteQueryOptions } from "@/api/library";
import { useDebounce } from "@/components/common/hooks/useDebounce";
import {
    getStorageValue,
    useLocalStorage,
} from "@/components/common/hooks/useLocalStorage";
import { CoverArt } from "@/components/library/coverArt";
import {
    FixedGrid,
    FixedGridChildrenProps,
    FixedGridProps,
    FixedList,
    FixedListChildrenProps,
    FixedListProps,
} from "@/components/library/viewer/DataView";
import { ViewToggle } from "@/components/library/viewer/ViewToggle";
import { AlbumResponseMinimal } from "@/pythonTypes";

const STORAGE_KEY = "library.browse.albums.search";
const DEFAULT_STORAGE_VALUE = {
    query: "",
    orderBy: "album" as const,
    orderDirection: "ASC" as const,
};

export const Route = createFileRoute("/library/(browse)/albums")({
    component: RouteComponent,
    loader: async ({ context }) => {
        const val = getStorageValue(STORAGE_KEY, DEFAULT_STORAGE_VALUE);

        await context.queryClient.ensureInfiniteQueryData(
            albumsInfiniteQueryOptions(val)
        );
    },
});

function RouteComponent() {
    const [overscanStopIndex, setOverScanStopIndex] = useState(0);
    const [view, setView] = useState<"list" | "grid">("list");
    const [queryState, setQueryState] = useLocalStorage<{
        query: string;
        orderBy: "album" | "albumartist" | "year";
        orderDirection: "ASC" | "DESC";
    }>(STORAGE_KEY, DEFAULT_STORAGE_VALUE);

    const debounceSearch = useDebounce(queryState.query, 500);

    const { data, fetchNextPage, isError, isFetching } = useInfiniteQuery(
        albumsInfiniteQueryOptions({
            query: debounceSearch,
            orderBy: queryState.orderBy,
            orderDirection: queryState.orderDirection,
        })
    );
    const numLoaded = data?.albums.length || 0;

    // Fetch new pages on scroll
    useEffect(() => {
        if (overscanStopIndex >= numLoaded - 10 && !isFetching && !isError) {
            void fetchNextPage();
        }
    }, [overscanStopIndex, numLoaded, fetchNextPage, isFetching, isError]);

    return (
        <Box
            sx={{
                display: "flex",
                height: "100%",
                flexDirection: "column",
                overflow: "auto",
            }}
        >
            <Box
                sx={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 2,
                    position: "sticky",
                }}
            >
                Search
                <ViewToggle view={view} setView={setView} />
            </Box>
            <Box
                sx={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 2,
                    height: "100%",
                }}
            >
                {view === "grid" ? (
                    <AlbumsCoverGrid
                        data={data}
                        onItemsRendered={({ overscanStopIndex }) => {
                            setOverScanStopIndex(overscanStopIndex);
                        }}
                    />
                ) : (
                    <AlbumsList
                        data={data}
                        onItemsRendered={({ overscanStopIndex }) => {
                            setOverScanStopIndex(overscanStopIndex);
                        }}
                    />
                )}
            </Box>
        </Box>
    );
}

/* -------------------------------- grid view ------------------------------- */

const GRIDCELLSIZE = 150; // size of each cell in the grid (width and height)

function AlbumsCoverGrid({
    data,
    ...props
}: {
    data?: {
        albums: AlbumResponseMinimal[];
        total: number;
    };
} & Omit<
    FixedGridProps<AlbumResponseMinimal>,
    "data" | "itemCount" | "itemHeight" | "children" | "itemWidth"
>) {
    return (
        <FixedGrid
            data={data?.albums || []}
            itemCount={data?.total || 0}
            itemHeight={150}
            itemWidth={150}
            overscanCount={10}
            {...props}
        >
            {CoverGridRow}
        </FixedGrid>
    );
}

function CoverGridRow({
    rowData,
    style,
    startIndex,
    endIndex,
    maxNColumns,
}: FixedGridChildrenProps<AlbumResponseMinimal>) {
    // number of items to display in the grid
    // may not be the same length as rowData
    // to allow dynamic loading of items
    const nTarget = endIndex - startIndex;
    const nItems = rowData.length;

    return (
        <Box
            height={GRIDCELLSIZE}
            sx={{
                ...style,
                display: "flex",
                flexWrap: "wrap",
                border: "1px solid blue",
                width: "100%",
                alignItems: "center",
                justifyContent: "center",
            }}
        >
            {/* Render the albums in the grid */}
            {rowData.map((album) => (
                <Link
                    to={`/library/album/$albumId`}
                    key={album.id}
                    params={{ albumId: album.id }}
                >
                    <Box
                        width={GRIDCELLSIZE}
                        sx={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            height: GRIDCELLSIZE,
                            padding: 1,
                            textAlign: "center",
                            ":hover": {
                                backgroundColor: "primary.muted",
                                color: "primary.contrastText",
                            },
                            border: "1px solid green",
                        }}
                    >
                        <CoverArt
                            type="album"
                            beetsId={album.id}
                            sx={{
                                maxWidth: "100%",
                                maxHeight: "100%",
                                width: "200px",
                                height: "200px",
                                m: 0,
                            }}
                        />
                    </Box>
                </Link>
            ))}
            {/* Show loading state if there are no albums or not enough items */}
            {Array.from({ length: Math.max(0, nTarget - nItems) }, (_, i) => (
                <Box
                    key={i + "loading"}
                    width={GRIDCELLSIZE}
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: 1,
                    }}
                >
                    <Skeleton variant="rectangular" width="100%" height="100%" />
                </Box>
            ))}
            {/* Fill the rest of the grid with empty boxes if needed to align items */}
            {Array.from({ length: Math.max(0, maxNColumns - nItems) }, (_, i) => (
                <Box
                    key={i + "empty"}
                    width={GRIDCELLSIZE}
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: 1,
                    }}
                />
            ))}
        </Box>
    );
}

/* -------------------------------- list view ------------------------------- */

const LISTROWHEIGHT = 50; // height of each row in the list

function AlbumsList({
    data,
    ...props
}: {
    data?: {
        albums: AlbumResponseMinimal[];
        total: number;
    };
} & Omit<
    FixedListProps<AlbumResponseMinimal>,
    "data" | "itemCount" | "itemHeight" | "children"
>) {
    return (
        <FixedList
            data={data?.albums || []}
            itemCount={data?.total || 0}
            itemHeight={LISTROWHEIGHT}
            overscanCount={50}
            {...props}
        >
            {AlbumListRow}
        </FixedList>
    );
}

/** An entry of album name and artist.
 * Click on it to navigate to the album page.
 * Implements a loading state
 */
function AlbumListRow({
    data: album,
    style,
}: FixedListChildrenProps<AlbumResponseMinimal>) {
    const theme = useTheme();
    // loading state (if albums is none)
    if (!album) {
        return (
            <Box
                height={LISTROWHEIGHT}
                sx={{
                    ...style,
                    display: "flex",
                    width: "100%",
                    alignItems: "center",
                    gap: 1,
                    paddingInline: 1,
                }}
            >
                <Disc3Icon color={theme.palette.background.paper} />
                <Box sx={{ display: "flex", flexDirection: "column", width: "100%" }}>
                    <Skeleton variant="text" animation={false} />
                    <Skeleton variant="text" width="60%" animation={false} />
                </Box>
            </Box>
        );
    }

    return (
        <Link
            to={`/library/album/$albumId`}
            key={album.id}
            params={{ albumId: album.id }}
            style={style}
        >
            <Box
                height={LISTROWHEIGHT}
                sx={(theme) => ({
                    display: "flex",
                    alignItems: "center",
                    paddingInline: 1,
                    gap: 2,
                    ":hover": {
                        background: `linear-gradient(to left, transparent 0%, ${theme.palette.primary.muted} 100%)`,
                        color: "primary.contrastText",
                    },
                })}
            >
                <Disc3Icon color={theme.palette.background.paper} />
                <Box
                    sx={{
                        display: "flex",
                        flexDirection: "column",
                    }}
                >
                    <Typography variant="body1">
                        {album.name || "Unknown Title"}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        {album.albumartist}
                    </Typography>
                </Box>
            </Box>
        </Link>
    );
}
