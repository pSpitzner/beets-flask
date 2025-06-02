import {
    AudioLinesIcon,
    ChevronRight,
    ClockIcon,
    Disc3Icon,
    User2Icon,
} from "lucide-react";
import {
    Box,
    BoxProps,
    Button,
    Card,
    CardContent,
    Typography,
    useTheme,
} from "@mui/material";
import { createFileRoute, Link } from "@tanstack/react-router";

import { PageWrapper } from "@/components/common/page";
import { relativeTime } from "@/components/common/units/time";
import { CardHeader } from "@/components/frontpage/statsCard";

export const Route = createFileRoute("/library/browse/")({
    component: RouteComponent,
});

const ARTISTS = {
    a1: { nTracks: 10, nAlbums: 5 },
    a2: { nTracks: 8, nAlbums: 3 },
    longArtistsNameWithNoBreaks: { nTracks: 15, nAlbums: 7 },
    "long artist name is long": { nTracks: 12, nAlbums: 6 },
};

function RouteComponent() {
    return (
        <PageWrapper
            sx={(theme) => ({
                display: "flex",
                flexDirection: "column",
                height: "100%",
                width: "100%",
                alignItems: "center",
                paddingTop: theme.spacing(1),
                paddingInline: theme.spacing(0.5),
                [theme.breakpoints.up("laptop")]: {
                    height: "auto",
                    paddingTop: theme.spacing(2),
                    paddingInline: theme.spacing(1),
                },
            })}
        >
            <PageHeader />
            <Artists />
        </PageWrapper>
    );
}

function PageHeader(props: BoxProps) {
    return (
        <Box
            sx={{
                display: "grid",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 2,
                width: "100%",
                gridTemplateColumns: "1fr",
                gridTemplateRows: "1fr",
                paddingInline: 2,
            }}
            {...props}
        >
            <Typography
                variant="h4"
                component="div"
                fontWeight="bold"
                sx={{
                    gridColumn: "1",
                    gridRow: "1",
                    textAlign: "center",
                }}
            >
                Browse your Library
            </Typography>
        </Box>
    );
}

function Artists() {
    return (
        <Card sx={{ padding: 2, width: "100%" }}>
            <CardHeader icon={<User2Icon size={36} />} size="large">
                <Typography variant="body1" color="text.secondary">
                    Artists
                </Typography>
            </CardHeader>
            <CardContent
                sx={{
                    paddingInline: 1,
                    paddingTop: 2,
                    m: 0,
                    paddingBottom: "0 !important",
                    display: "flex",
                    flexDirection: "column",
                    gap: 3,
                }}
            >
                <Box>
                    <Typography variant="h5" fontWeight={800} letterSpacing={0.5}>
                        Top occurring Artists
                    </Typography>
                    <Box
                        sx={{
                            display: "grid",
                            gridTemplateColumns:
                                "repeat(auto-fill, minmax(220px, 1fr))",
                            gridAutoRows: "1fr",
                            gap: 1,
                            paddingTop: 2.5,
                        }}
                    >
                        {Object.entries(ARTISTS).map(([name, { nTracks, nAlbums }]) => (
                            <ArtistCardCounts
                                key={name}
                                name={name}
                                nTracks={nTracks}
                                nAlbums={nAlbums}
                            />
                        ))}
                    </Box>
                </Box>
                <Box>
                    <Typography variant="h5" fontWeight={800} letterSpacing={0.5}>
                        New additions
                    </Typography>
                    <Box
                        sx={{
                            display: "grid",
                            gridTemplateColumns:
                                "repeat(auto-fill, minmax(220px, 1fr))",
                            gridAutoRows: "1fr",
                            gap: 1,
                            paddingTop: 2.5,
                        }}
                    >
                        {Object.entries(ARTISTS).map(([name, { nTracks, nAlbums }]) => (
                            <ArtistCardAdded
                                key={name}
                                name={name}
                                nTracks={nTracks}
                                nAlbums={nAlbums}
                                added={
                                    new Date(Date.now() - Math.random() * 10000000000)
                                }
                            />
                        ))}
                    </Box>
                </Box>
                <Box
                    sx={(theme) => ({
                        paddingTop: 3,
                        display: "flex",
                        gap: 2,
                        fontWeight: 600,
                        justifyContent: "flex-end",
                        [theme.breakpoints.down("tablet")]: {
                            ">*": {
                                width: "100%",
                            },
                        },
                    })}
                >
                    <Button
                        variant="contained"
                        endIcon={<ChevronRight />}
                        component={Link}
                        to="/library/browse/artists"
                        size="large"
                        sx={{
                            fontWeight: 600,
                        }}
                    >
                        All Artists
                    </Button>
                </Box>
            </CardContent>
        </Card>
    );
}

interface ArtistCardProps {
    name: string;
    nTracks: number;
    nAlbums: number;
    added?: Date;
}

function ArtistCardCounts({ name, nTracks, nAlbums }: ArtistCardProps) {
    const theme = useTheme();

    return (
        <Box
            sx={{
                padding: 0.5,
                border: "2px solid",
                borderColor: "primary.muted",
                width: "100%",
                color: "primary.muted",
                display: "flex",
                alignItems: "center",
                flexDirection: "column",
                borderRadius: 1,
            }}
        >
            <Box
                sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 1,
                    color: "grey.600",
                    letterSpacing: "1px",
                    width: "100%",
                }}
            >
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
            <Typography
                variant="h6"
                sx={{
                    fontWeight: 600,
                    lineHeight: 1.1,
                    overflowWrap: "anywhere",
                    paddingLeft: 1,
                    paddingBlock: 0.5,
                    textAlign: "right",
                    width: "100%",
                }}
            >
                {name}
            </Typography>
        </Box>
    );
}

function ArtistCardAdded({ name, added }: ArtistCardProps) {
    const theme = useTheme();
    return (
        <Box
            sx={{
                padding: 0.5,
                border: "2px solid",
                borderColor: "primary.muted",
                width: "100%",
                color: "primary.muted",
                display: "flex",
                alignItems: "center",
                flexDirection: "column",
                borderRadius: 1,
            }}
        >
            <Box
                sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 1,
                    color: "grey.600",
                    letterSpacing: "1px",
                    width: "100%",
                }}
            >
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                    <ClockIcon size={theme.iconSize.md} />
                    <Typography variant="body2">
                        Added {added ? relativeTime(added) : "Unknown"}
                    </Typography>
                </Box>
            </Box>
            <Typography
                variant="h6"
                sx={{
                    fontWeight: 600,
                    lineHeight: 1.1,
                    overflowWrap: "anywhere",
                    paddingLeft: 1,
                    paddingBlock: 0.5,
                    textAlign: "right",
                    width: "100%",
                }}
            >
                {name}
            </Typography>
        </Box>
    );
}
