import { AudioLinesIcon, Disc3Icon, GridIcon, ListIcon, User2Icon } from "lucide-react";
import { useMemo, useState } from "react";
import AutoSizer from "react-virtualized-auto-sizer";
import { FixedSizeList } from "react-window";
import {
    Box,
    Divider,
    ToggleButton,
    ToggleButtonGroup,
    Typography,
    useTheme,
} from "@mui/material";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";

import { albumsByArtistQueryOptions } from "@/api/library";
import { Search } from "@/components/common/inputs/search";
import { PageWrapper } from "@/components/common/page";
import { CoverArt } from "@/components/library/coverArt";
import { AlbumResponseMinimal } from "@/pythonTypes";

export const Route = createFileRoute("/library/(browse)/artist/$artist")({
    loader: async (opts) =>
        await opts.context.queryClient.ensureQueryData(
            albumsByArtistQueryOptions(
                opts.params.artist,
                false, //expand
                true //minimal
            )
        ),
    component: RouteComponent,
});

function RouteComponent() {
    const params = Route.useParams();

    const { data: albums } = useSuspenseQuery(
        albumsByArtistQueryOptions(params.artist, false, true)
    );

    return (
        <PageWrapper
            sx={(theme) => ({
                height: "100%",
                display: "flex",
                flexDirection: "column",
                gap: 2,
                [theme.breakpoints.down("laptop")]: {
                    paddingInline: 1,
                },
            })}
        >
            {/* Header */}
            <ArtistHeader nAlbums={albums.length} />
            <Divider />
            <AlbumsViewer albums={albums} />
        </PageWrapper>
    );
}

function ArtistHeader({ nAlbums }: { nAlbums: number }) {
    const params = Route.useParams();
    const theme = useTheme();

    return (
        <Box
            sx={{
                display: "flex",
                gap: 2,
                alignItems: "center",
                padding: 2,
            }}
        >
            <User2Icon size={theme.iconSize.xl + 10} color="gray" />
            <Box>
                <Typography variant="h5" fontWeight="bold" lineHeight={1.2}>
                    {params.artist}
                </Typography>
                <Typography variant="subtitle1" color="text.secondary">
                    {nAlbums} albums
                </Typography>
            </Box>
        </Box>
    );
}

function AlbumsViewer({ albums }: { albums: AlbumResponseMinimal[] }) {
    const [filter, setFilter] = useState("");
    const theme = useTheme();
    const [selected, setSelected] = useState<"albums" | "items">("albums");
    const [view, setView] = useState<"list" | "grid">("list");

    const filteredAlbums = useMemo(() => {
        if (!filter) {
            return albums;
        }
        return albums.filter((album) => {
            return album.name.toLowerCase().includes(filter.toLowerCase());
        });
    }, [albums, filter]);

    const nRemovedByFilter = albums.length - filteredAlbums.length;

    return (
        <>
            <Box sx={{ marginBottom: -2 }}>
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
                    <Box sx={{ display: "flex", gap: 2 }}>
                        <ToggleButtonGroup
                            value={selected}
                            onChange={(
                                _e: React.MouseEvent<HTMLElement>,
                                v: "albums" | "items" | null
                            ) => {
                                if (v) setSelected(v);
                            }}
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
                        <ToggleButtonGroup
                            value={view}
                            onChange={(
                                _e: React.MouseEvent<HTMLElement>,
                                v: "list" | "grid" | null
                            ) => {
                                if (v) {
                                    setView(v);
                                }
                            }}
                            exclusive
                            aria-label="View type"
                        >
                            <ToggleButton value="list">
                                <ListIcon size={theme.iconSize.lg} />
                            </ToggleButton>
                            <ToggleButton value="grid">
                                <GridIcon size={theme.iconSize.lg} />
                            </ToggleButton>
                        </ToggleButtonGroup>
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
                    height: "100%",
                    paddingInline: 2,
                }}
            >
                {view === "grid" && <AlbumsGrid albums={filteredAlbums} />}
                {view === "list" && <AlbumsList albums={filteredAlbums} />}
            </Box>
        </>
    );
}

function AlbumsGrid({ albums }: { albums: AlbumResponseMinimal[] }): JSX.Element {
    return (
        <AutoSizer defaultHeight={50}>
            {({ height, width }) => {
                // Split all album covers by row to fit width
                const nColumns = Math.floor(width / 200);
                const nRows = Math.ceil(albums.length / nColumns);

                return (
                    <FixedSizeList
                        itemSize={200}
                        height={height}
                        width={width}
                        itemCount={nRows}
                    >
                        {({ index, style }) => {
                            const albumsSlice = albums.slice(
                                index * nColumns,
                                (index + 1) * nColumns
                            );

                            return (
                                <Box
                                    sx={{
                                        display: "flex",
                                        justifyContent: "center",
                                        alignItems: "flex-end",

                                        ...style,
                                    }}
                                >
                                    {albumsSlice.map((album) => (
                                        <Link
                                            key={album.name}
                                            to={`/library/album/$albumId`}
                                            params={{ albumId: album.id }}
                                        >
                                            <Box
                                                sx={{
                                                    display: "flex",
                                                    alignItems: "center",
                                                    padding: 0.5,
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

                                                {/* Banner for album title */}
                                                <Box
                                                    sx={{
                                                        position: "absolute",
                                                        bottom: 0,
                                                        left: 0,
                                                        right: 0,
                                                        backgroundColor:
                                                            "rgba(0, 0, 0, 0.5)",
                                                        padding: 1,
                                                        width: "100%",
                                                        backgroundFilter: "blur(10px)",
                                                        display: "flex",
                                                        justifyContent: "center",
                                                        alignItems: "center",
                                                        overflow: "hidden",
                                                        textOverflow: "ellipsis",
                                                    }}
                                                >
                                                    <Typography variant="body1">
                                                        {album.name}
                                                    </Typography>
                                                </Box>
                                            </Box>
                                        </Link>
                                    ))}
                                </Box>
                            );
                        }}
                    </FixedSizeList>
                );
            }}
        </AutoSizer>
    );
}

function AlbumsList({ albums }: { albums: AlbumResponseMinimal[] }): JSX.Element {
    return (
        <AutoSizer defaultHeight={50}>
            {({ height, width }) => {
                return (
                    <FixedSizeList
                        itemSize={35}
                        height={height}
                        width={width}
                        itemCount={albums.length}
                    >
                        {({ index }) => {
                            const album = albums[index];
                            return (
                                <Box
                                    sx={{
                                        height: "35px",
                                    }}
                                >
                                    <Link
                                        to={`/library/album/$albumId`}
                                        params={{ albumId: album.id }}
                                    >
                                        <Typography variant="body1">
                                            {album.name}
                                        </Typography>
                                    </Link>
                                </Box>
                            );
                        }}
                    </FixedSizeList>
                );
            }}
        </AutoSizer>
    );
}
