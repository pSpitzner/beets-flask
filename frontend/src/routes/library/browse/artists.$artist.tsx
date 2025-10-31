import { useMemo, useState } from "react";
import { List } from "react-window";
import {
    Box,
    BoxProps,
    Divider,
    ToggleButton,
    ToggleButtonGroup,
    Typography,
    useTheme,
} from "@mui/material";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";

import {
    albumsByArtistQueryOptions,
    artistQueryOptions,
    itemsByArtistQueryOptions,
} from "@/api/library";
import { AlbumGridCell, AlbumListRow } from "@/components/common/browser/albums";
import { ItemListRow } from "@/components/common/browser/items";
import { AlbumIcon, ArtistIcon, TrackIcon } from "@/components/common/icons";
import { Search } from "@/components/common/inputs/search";
import { DynamicFlowGrid, ViewToggle } from "@/components/common/table";
import { AlbumResponseMinimal, ItemResponseMinimal } from "@/pythonTypes";

export const Route = createFileRoute("/library/browse/artists/$artist")({
    loader: async (opts) => {
        const p1 = opts.context.queryClient.ensureQueryData(
            albumsByArtistQueryOptions(
                opts.params.artist,
                false, //expand
                true //minimal
            )
        );
        const p2 = opts.context.queryClient.ensureQueryData(
            artistQueryOptions(opts.params.artist)
        );
        const p3 = opts.context.queryClient.ensureQueryData(
            itemsByArtistQueryOptions(opts.params.artist, true) //minimal
        );
        await Promise.all([p1, p2, p3]);
    },
    component: RouteComponent,
});

function RouteComponent() {
    const params = Route.useParams();

    const { data: albums } = useSuspenseQuery(
        albumsByArtistQueryOptions(params.artist, false, true)
    );
    const { data: items } = useSuspenseQuery(
        itemsByArtistQueryOptions(params.artist, true)
    );

    return (
        <>
            {/* Header */}
            <ArtistHeader
                sx={(theme) => ({
                    [theme.breakpoints.down("laptop")]: {
                        background: `linear-gradient(to bottom, transparent 0%, ${theme.palette.background.paper} 100%)`,
                    },
                })}
            />
            <Divider sx={{ backgroundColor: "primary.muted" }} />
            <Viewer
                albums={albums}
                items={items}
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
        </>
    );
}

function ArtistHeader({ sx, ...props }: BoxProps) {
    const params = Route.useParams();
    // Fetch artist data
    const { data: artist } = useSuspenseQuery(artistQueryOptions(params.artist));

    const theme = useTheme();

    const nAlbums = artist.album_count;
    const nTracks = artist.item_count;

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
            <Link to="/library/browse/artists">
                <Box sx={{ display: "flex", alignItems: "center", height: "100%" }}>
                    <ArtistIcon size={40} color={theme.palette.primary.main} />
                </Box>
            </Link>
            <Box>
                <Typography variant="h5" fontWeight="bold" lineHeight={1}>
                    {artist.artist}
                </Typography>
                <Box sx={{ display: "flex", gap: 2, p: 0.5, color: "text.secondary" }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                        <AlbumIcon size={theme.iconSize.md} />
                        <Typography variant="body2">
                            {nAlbums} Album{nAlbums !== 1 ? "s" : ""}
                        </Typography>
                    </Box>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                        <TrackIcon size={theme.iconSize.md} />
                        <Typography variant="body2">
                            {nTracks} Track{nTracks !== 1 ? "s" : ""}
                        </Typography>
                    </Box>
                </Box>
            </Box>
        </Box>
    );
}

function Viewer({
    albums,
    items,
    ...props
}: { albums: AlbumResponseMinimal[]; items: ItemResponseMinimal[] } & BoxProps) {
    const theme = useTheme();
    const [selected, setSelected] = useState<"albums" | "items">(() =>
        albums.length > 0 ? "albums" : "items"
    );
    const [view, setView] = useState<"list" | "grid">("list");
    const [filter, setFilter] = useState("");

    const filteredAlbums = useMemo(() => {
        if (!filter) {
            return albums;
        }
        return albums.filter((album) => {
            return album.name.toLowerCase().includes(filter.toLowerCase());
        });
    }, [albums, filter]);

    const filteredItems = useMemo(() => {
        if (!filter) {
            return items;
        }
        return items.filter((item) => {
            return item.name.toLowerCase().includes(filter.toLowerCase());
        });
    }, [items, filter]);

    const nAlbumsRemovedByFilter = albums.length - filteredAlbums.length;
    const nItemsRemovedByFilter = items.length - filteredItems.length;

    const nRemovedByFilter =
        selected === "albums" ? nAlbumsRemovedByFilter : nItemsRemovedByFilter;

    return (
        <Box {...props}>
            <Box
                sx={{
                    width: "100%",
                    marginBottom: -1,
                    padding: 2,
                    height: "min-content",
                    overflow: "hidden",
                }}
            >
                <Box
                    sx={{
                        display: "flex",
                        gap: 2,
                        alignItems: "center",
                        justifyContent: "space-between",
                        flexWrap: "wrap",
                    }}
                >
                    <Search
                        value={filter}
                        setValue={setFilter}
                        size="small"
                        sx={{
                            flex: "1 1 auto",
                            maxWidth: 300,
                        }}
                    />
                    <Box
                        sx={{
                            display: "flex",
                            gap: 2,
                        }}
                    >
                        <ToggleButtonGroup
                            value={selected}
                            onChange={(
                                _e: React.MouseEvent<HTMLElement>,
                                v: "albums" | "items" | null
                            ) => {
                                if (v) setSelected(v);
                            }}
                            color="primary"
                            exclusive
                            aria-label="Filter type"
                        >
                            <ToggleButton value="items">
                                <TrackIcon size={theme.iconSize.lg} />
                            </ToggleButton>
                            <ToggleButton value="albums">
                                <AlbumIcon size={theme.iconSize.lg} />
                            </ToggleButton>
                        </ToggleButtonGroup>
                        <ViewToggle
                            view={view}
                            setView={setView}
                            sx={{ marginLeft: "auto" }}
                        />
                    </Box>
                </Box>
                <Typography
                    variant="caption"
                    color="text.secondary"
                    visibility={nRemovedByFilter > 0 ? "visible" : "hidden"}
                >
                    {nRemovedByFilter}{" "}
                    {nRemovedByFilter > 1 ? selected : selected.replace("s", "")} hidden
                    by filter
                </Typography>
            </Box>
            <Box
                sx={{
                    overflow: "hidden",
                    flex: "1 1 auto",
                    paddingInline: 2,
                    minHeight: 0,
                }}
            >
                {selected === "items" && <ItemsViewer items={filteredItems} />}
                {selected === "albums" && (
                    <AlbumsViewer albums={filteredAlbums} view={view} />
                )}
            </Box>
        </Box>
    );
}

function AlbumsViewer({
    albums,
    view,
}: {
    albums: AlbumResponseMinimal[];
    view: "list" | "grid";
}) {
    if (albums.length === 0) {
        return (
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
        );
    }

    if (view === "grid") {
        return (
            <DynamicFlowGrid
                cellProps={{ albums: albums }}
                cellCount={albums.length}
                cellHeight={150}
                cellWidth={150}
                cellComponent={AlbumGridCell}
            />
        );
    }
    return (
        <List
            rowProps={{ albums, showArtist: false }}
            rowCount={albums.length}
            rowHeight={35}
            rowComponent={AlbumListRow}
        />
    );
}

/* -------------------------------- grid view ------------------------------- */

function ItemsViewer({ items }: { items: ItemResponseMinimal[] }) {
    if (items.length === 0) {
        return (
            <Box
                sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    height: "100%",
                }}
            >
                <Typography variant="body1" color="text.secondary">
                    No items found.
                </Typography>
            </Box>
        );
    }

    return (
        <List
            rowProps={{ items, showArtist: false }}
            rowCount={items.length}
            rowHeight={50}
            overscanCount={50}
            rowComponent={ItemListRow}
        />
    );
}
