import { AudioLinesIcon, Disc3Icon, User2Icon } from "lucide-react";
import { useMemo, useState } from "react";
import {
    alpha,
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
import { Search } from "@/components/common/inputs/search";
import {
    FixedGrid,
    FixedGridChildrenProps,
    FixedList,
    FixedListChildrenProps,
    ViewToggle,
} from "@/components/common/table";
import { CoverArt } from "@/components/library/coverArt";
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
                    <User2Icon size={40} color={theme.palette.primary.main} />
                </Box>
            </Link>
            <Box>
                <Typography variant="h5" fontWeight="bold" lineHeight={1}>
                    {artist.artist}
                </Typography>
                <Box sx={{ display: "flex", gap: 2, p: 0.5, color: "text.secondary" }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                        <Disc3Icon size={theme.iconSize.md} />
                        <Typography variant="body2">
                            {nAlbums} Album{nAlbums !== 1 ? "s" : ""}
                        </Typography>
                    </Box>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                        <AudioLinesIcon size={theme.iconSize.md} />
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
                                <AudioLinesIcon size={theme.iconSize.lg} />
                            </ToggleButton>
                            <ToggleButton value="albums">
                                <Disc3Icon size={theme.iconSize.lg} />
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
}): JSX.Element {
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
        return <AlbumsGrid albums={albums} />;
    }
    return <AlbumsList albums={albums} />;
}

function ItemsViewer({ items }: { items: ItemResponseMinimal[] }): JSX.Element {
    const theme = useTheme();

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
        <FixedList data={items} itemHeight={35}>
            {({ data: item }: FixedListChildrenProps<ItemResponseMinimal>) => (
                <Link
                    to={`/library/item/$itemId`}
                    key={item!.id}
                    params={{ itemId: item!.id }}
                >
                    <Box
                        sx={(theme) => ({
                            height: "35px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: 1,
                            gap: 2,
                            ":hover": {
                                background: `linear-gradient(to left, transparent 0%, ${theme.palette.primary.muted} 100%)`,
                                color: "primary.contrastText",
                            },
                        })}
                    >
                        <Typography variant="body1">{item!.name}</Typography>
                        <AudioLinesIcon
                            color={theme.palette.background.paper}
                            style={{
                                marginRight: "2rem",
                            }}
                        />
                    </Box>
                </Link>
            )}
        </FixedList>
    );
}

function AlbumsGridRow({ rowData }: FixedGridChildrenProps<AlbumResponseMinimal>) {
    return rowData.map((album) => (
        <Link
            key={album.name}
            to={`/library/album/$albumId`}
            params={{ albumId: album.id }}
        >
            <Box
                sx={{
                    display: "flex",
                    alignItems: "center",
                    padding: 1,
                    width: "200px",
                    height: "200px",
                    position: "relative",
                }}
            >
                {/* Album cover */}
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

                {/* Banner for album title and hover effect*/}
                <Box
                    sx={(theme) => ({
                        position: "absolute",
                        bottom: theme.spacing(1),
                        left: theme.spacing(1),
                        right: 0,
                        height: `calc(100% - ${theme.spacing(2)})`,
                        width: `calc(100% - ${theme.spacing(2)})`,
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "flex-end",
                        overflow: "hidden",
                        backdropFilter: "blur(0px)",
                        ":hover": {
                            backdropFilter: "blur(2px)",
                            transition: "all 0.3s",

                            ">*": {
                                transition: "all 0.3s",
                                background: theme.palette.primary.muted,
                            },
                            ">*>*": {
                                transition: "all 0.3s",
                                fontWeight: "bold",
                                color: theme.palette.primary.contrastText,
                            },
                        },
                    })}
                >
                    <Box
                        sx={(theme) => ({
                            width: "100%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            backdropFilter: "blur(3px)",
                            background: alpha(theme.palette.primary.muted!, 0.3),
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                        })}
                    >
                        <Typography variant="body1">{album.name}</Typography>
                    </Box>
                </Box>
            </Box>
        </Link>
    ));
}

function AlbumsGrid({ albums }: { albums: AlbumResponseMinimal[] }): JSX.Element {
    return (
        <FixedGrid data={albums} itemHeight={200} itemWidth={200}>
            {AlbumsGridRow}
        </FixedGrid>
    );
}

function AlbumsListRow({ data: album }: FixedListChildrenProps<AlbumResponseMinimal>) {
    const theme = useTheme();

    // loading state (if albums is none)
    if (!album) {
        return null;
    }

    return (
        <Link
            to={`/library/album/$albumId`}
            key={album.id}
            params={{ albumId: album.id }}
        >
            <Box
                sx={(theme) => ({
                    height: "35px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: 1,
                    gap: 2,
                    ":hover": {
                        background: `linear-gradient(to left, transparent 0%, ${theme.palette.primary.muted} 100%)`,
                        color: "primary.contrastText",
                    },
                })}
            >
                <Typography variant="body1">{album.name}</Typography>
                <Disc3Icon
                    color={theme.palette.background.paper}
                    style={{
                        marginRight: "2rem",
                    }}
                />
            </Box>
        </Link>
    );
}

function AlbumsList({ albums }: { albums: AlbumResponseMinimal[] }): JSX.Element {
    return (
        <FixedList data={albums} itemHeight={35}>
            {AlbumsListRow}
        </FixedList>
    );
}
