import { Disc3Icon } from "lucide-react";
import { memo, useEffect, useState, useTransition } from "react";
import { Box, BoxProps, Divider, Skeleton, Typography, useTheme } from "@mui/material";
import { useInfiniteQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";

import { albumsInfiniteQueryOptions } from "@/api/library";
import {
    getStorageValue,
    useLocalStorage,
} from "@/components/common/hooks/useLocalStorage";
import { Search } from "@/components/common/inputs/search";
import { PageWrapper } from "@/components/common/page";
import {
    CurrentSort,
    FixedGrid,
    FixedGridChildrenProps,
    FixedGridProps,
    FixedList,
    FixedListChildrenProps,
    FixedListProps,
    SortToggle,
    ViewToggle,
} from "@/components/common/table";
import { CoverArt } from "@/components/library/coverArt";
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
    return (
        <PageWrapper
            title="Albums"
            sx={(theme) => ({
                display: "flex",
                flexDirection: "column",
                minHeight: "100%",
                height: "100%",
                [theme.breakpoints.up("laptop")]: {
                    padding: 2,
                },
            })}
        >
            <Box
                sx={(theme) => ({
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    overflow: "hidden",
                    [theme.breakpoints.up("laptop")]: {
                        backgroundColor: "background.paper",
                        borderRadius: 2,
                    },
                })}
            >
                <AlbumsHeader />
                <Divider sx={{ backgroundColor: "primary.muted" }} />
                <View
                    sx={(theme) => ({
                        display: "flex",
                        flexDirection: "column",
                        height: "100%",
                        overflow: "hidden",
                        [theme.breakpoints.down("laptop")]: {
                            background: `linear-gradient(to bottom, ${theme.palette.background.paper} 0%, transparent 100%)`,
                        },
                    })}
                />
            </Box>
        </PageWrapper>
    );
}

function AlbumsHeader({ sx, ...props }: BoxProps) {
    const theme = useTheme();
    return (
        <Box
            sx={[
                {
                    display: "flex",
                    gap: 2,
                    alignItems: "center",
                    padding: 2,
                },
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                ...(Array.isArray(sx) ? sx : [sx]),
            ]}
            {...props}
        >
            <Box sx={{ display: "flex", alignItems: "center", height: "100%" }}>
                <Disc3Icon size={40} color={theme.palette.primary.main} />
            </Box>
            <Box>
                <Typography variant="h5" fontWeight="bold" lineHeight={1}>
                    Browse Albums
                </Typography>
            </Box>
        </Box>
    );
}

function View({ sx, ...props }: BoxProps) {
    const [isTransitioning, startTransition] = useTransition();
    const [overscanStopIndex, setOverScanStopIndex] = useState(0);
    const [view, setView] = useState<"list" | "grid">("list");
    const [queryState, setQueryState] = useLocalStorage<{
        query: string;
        orderBy: "album" | "albumartist" | "year";
        orderDirection: "ASC" | "DESC";
    }>(STORAGE_KEY, DEFAULT_STORAGE_VALUE);

    const { data, fetchNextPage, isError, isPending, isFetching } = useInfiniteQuery(
        albumsInfiniteQueryOptions({
            query: queryState.query,
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
            sx={[
                {
                    display: "flex",
                    height: "100%",
                    flexDirection: "column",
                },
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                ...(Array.isArray(sx) ? sx : [sx]),
            ]}
            {...props}
        >
            {/* Header with some controls */}
            <Box
                sx={{
                    display: "flex",
                    gap: 4,
                    width: "100%",
                    padding: 2,
                }}
            >
                <Search
                    loading={isPending || isTransitioning}
                    sx={{
                        mr: "auto",
                        minHeight: "unset",
                        height: "100%",
                        input: { height: "100%", p: 0 },
                        ".MuiInputBase-root": {
                            height: "100%",
                        },
                    }}
                    value={queryState.query}
                    setValue={(newQuery: string) => {
                        startTransition(() => {
                            setQueryState({
                                ...queryState,
                                query: newQuery,
                            });
                        });
                    }}
                />
                <SortToggle
                    value={{
                        value: queryState.orderBy,
                        direction: queryState.orderDirection,
                    }}
                    setValue={(newSort: CurrentSort) => {
                        setQueryState({
                            ...queryState,
                            orderBy: newSort.value as "album" | "albumartist" | "year",
                            orderDirection: newSort.direction,
                        });
                    }}
                    items={[
                        {
                            label: "Title",
                            value: "album",
                        },
                        {
                            label: "Artist",
                            value: "albumartist",
                        },
                        {
                            label: "Year",
                            value: "year",
                        },
                    ]}
                />
                <ViewToggle view={view} setView={setView} />
            </Box>
            {/* table */}
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
                {data && data.total === 0 && !isPending && !isFetching && (
                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            height: "100%",
                        }}
                    >
                        <Typography variant="body1" color="text.secondary">
                            No albums found.
                        </Typography>
                    </Box>
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
            useIsScrolling
            {...props}
        >
            {AlbumListRow}
        </FixedList>
    );
}

const LoadingRow = memo(({ style }: { style: React.CSSProperties }) => {
    const theme = useTheme();
    return (
        <Box
            height={LISTROWHEIGHT}
            sx={{
                ...style,
                display: "flex",
                width: "100%",
                alignItems: "center",
                gap: 2,
                paddingInline: 1,
            }}
        >
            <Box sx={{ display: "flex", flexDirection: "column", width: "100%" }}>
                <Skeleton variant="text" animation={false} />
                <Skeleton variant="text" width="60%" animation={false} />
            </Box>
            <Disc3Icon color={theme.palette.background.paper} />
        </Box>
    );
});

/** An entry of album name and artist.
 * Click on it to navigate to the album page.
 * Implements a loading state
 */
function AlbumListRow({
    data: album,
    style,
    isScrolling,
}: FixedListChildrenProps<AlbumResponseMinimal>) {
    const theme = useTheme();
    // loading state (if albums is none)
    if (!album || isScrolling) {
        return <LoadingRow style={style} />;
    }

    return (
        <Link
            to={`/library/album/$albumId`}
            key={album.id}
            params={{ albumId: album.id }}
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
                <CoverArt
                    type="album"
                    beetsId={album.id}
                    size="small"
                    sx={{
                        display: "block",
                        width: "50px",
                        height: "50px",
                        padding: 0.5,
                    }}
                />
                <Box
                    sx={{
                        display: "flex",
                        flexDirection: "column",
                        mr: "auto",
                    }}
                >
                    <Typography variant="body1">
                        {album.name || "Unknown Title"}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        {album.albumartist} {album.year ? `(${album.year})` : ""}
                    </Typography>
                </Box>
                <Disc3Icon color={theme.palette.background.paper} />
            </Box>
        </Link>
    );
}
