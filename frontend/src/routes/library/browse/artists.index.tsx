import { User2Icon } from "lucide-react";
import { useMemo, useState } from "react";
import AutoSizer from "react-virtualized-auto-sizer";
import { FixedSizeList } from "react-window";
import { Box, BoxProps, Divider, Typography, useTheme } from "@mui/material";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";

import { artistsQueryOptions } from "@/api/library";
import { Search } from "@/components/common/inputs/search";

export const Route = createFileRoute("/library/browse/artists/")({
    loader: async (opts) => {
        await opts.context.queryClient.ensureQueryData(artistsQueryOptions());
    },
    component: RouteComponent,
});

function RouteComponent() {
    const { data: artists } = useSuspenseQuery(artistsQueryOptions());
    return (
        <>
            <ArtistsHeader
                nArtists={artists.length}
                sx={(theme) => ({
                    [theme.breakpoints.down("laptop")]: {
                        background: `linear-gradient(to bottom, transparent 0%, ${theme.palette.background.paper} 100%)`,
                    },
                })}
            />
            <Divider sx={{ backgroundColor: "primary.muted" }} />
            <ArtistsListWrapper
                artists={artists}
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

function ArtistsHeader({ nArtists, sx, ...props }: { nArtists: number } & BoxProps) {
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
                <User2Icon size={40} color={"gray"} />
            </Box>
            <Box>
                <Typography variant="h5" fontWeight="bold" lineHeight={1}>
                    All Artists
                </Typography>
                <Typography variant="subtitle1" color="text.secondary">
                    {nArtists} unique artists
                </Typography>
            </Box>
        </Box>
    );
}

function ArtistsListWrapper({
    artists,
    ...props
}: { artists: Array<{ name: string }> } & BoxProps) {
    const [filter, setFilter] = useState<string>("");

    const filteredData = useMemo(() => {
        if (!filter) {
            return artists;
        }
        return artists.filter((item) => {
            //filtered or selected
            return item.name?.toLowerCase().includes(filter.toLowerCase());
        });
    }, [artists, filter]);

    const nRemovedByFilter = artists.length - filteredData.length;

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
                </Box>
                <Typography
                    variant="caption"
                    color="text.secondary"
                    visibility={nRemovedByFilter > 0 ? "visible" : "hidden"}
                >
                    {nRemovedByFilter}
                    {" artist"}
                    {nRemovedByFilter > 1 && "s"} hidden by filter
                </Typography>
            </Box>
            <Box
                sx={{
                    overflow: "visible",
                    flex: "1 1 auto",
                    paddingInline: 2,
                    minHeight: 0,
                }}
            >
                <ArtistsList artists={filteredData} />
            </Box>
        </Box>
    );
}

function ArtistsList({ artists }: { artists: Array<{ name: string }> }) {
    const theme = useTheme();
    console.log("ArtistsList", artists);

    return (
        <AutoSizer>
            {({ height, width }) => (
                <FixedSizeList
                    itemSize={35}
                    height={height}
                    width={width}
                    itemCount={artists.length}
                >
                    {({ index, style }) => {
                        const artist = artists[index];
                        return (
                            <Link
                                to="/library/browse/artists/$artist"
                                params={{ artist: artist.name }}
                                style={style}
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
                                        {artist.name || "Unknown Artist"}
                                    </Typography>
                                    <User2Icon
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
            )}
        </AutoSizer>
    );
}
