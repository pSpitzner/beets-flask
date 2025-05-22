import { AudioLinesIcon, Disc3Icon, GridIcon, ListIcon, User2Icon } from "lucide-react";
import { useMemo, useState } from "react";
import AutoSizer from "react-virtualized-auto-sizer";
import { FixedSizeList } from "react-window";
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

import { albumsByArtistQueryOptions } from "@/api/library";
import { Search } from "@/components/common/inputs/search";
import { CoverArt } from "@/components/library/coverArt";
import { AlbumResponseMinimal } from "@/pythonTypes";

export const Route = createFileRoute("/library/(browse)/artists/$artist")({
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
        <>
            {/* Header */}
            <ArtistHeader
                nAlbums={albums.length}
                sx={(theme) => ({
                    [theme.breakpoints.down("laptop")]: {
                        background: `linear-gradient(to bottom, transparent 0%, ${theme.palette.background.paper} 100%)`,
                    },
                })}
            />
            <Divider sx={{ backgroundColor: "primary.muted" }} />
            <AlbumsViewer
                albums={albums}
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

function ArtistHeader({ nAlbums, sx, ...props }: { nAlbums: number } & BoxProps) {
    const params = Route.useParams();
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
            <Link to="/library/artists">
                <Box sx={{ display: "flex", alignItems: "center", height: "100%" }}>
                    <User2Icon size={40} color={theme.palette.primary.main} />
                </Box>
            </Link>
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

function AlbumsViewer({
    albums,
    ...props
}: { albums: AlbumResponseMinimal[] } & BoxProps) {
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
                            <ToggleButton value="items" disabled>
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
                            color="primary"
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
                    flex: "1 1 auto",
                    paddingInline: 2,
                    minHeight: 0,
                }}
            >
                {view === "grid" && <AlbumsGrid albums={filteredAlbums} />}
                {view === "list" && <AlbumsList albums={filteredAlbums} />}
            </Box>
        </Box>
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
                                                                background:
                                                                    theme.palette
                                                                        .primary.muted,
                                                            },
                                                            ">*>*": {
                                                                transition: "all 0.3s",
                                                                fontWeight: "bold",
                                                                color: theme.palette
                                                                    .primary
                                                                    .contrastText,
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
                                                            background: alpha(
                                                                theme.palette.primary
                                                                    .muted!,
                                                                0.3
                                                            ),
                                                            overflow: "hidden",
                                                            textOverflow: "ellipsis",
                                                        })}
                                                    >
                                                        <Typography variant="body1">
                                                            {album.name}
                                                        </Typography>
                                                    </Box>
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
    const theme = useTheme();

    return (
        <AutoSizer>
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
                                        <Typography variant="body1">
                                            {album.name}
                                        </Typography>
                                        <Disc3Icon
                                            color={theme.palette.background.paper}
                                            style={{
                                                marginRight: "2rem",
                                            }}
                                        />
                                    </Box>
                                </Link>
                            );
                        }}
                    </FixedSizeList>
                );
            }}
        </AutoSizer>
    );
}
