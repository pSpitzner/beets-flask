import { AudioLinesIcon, ImportIcon } from "lucide-react";
import { Box, BoxProps, Link, styled, Typography, useTheme } from "@mui/material";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, createLink, Outlet } from "@tanstack/react-router";

import { albumQueryOptions, artQueryOptions } from "@/api/library";
import { PageWrapper } from "@/components/common/page";
import { AlbumHeader } from "@/components/library/album";

export const Route = createFileRoute("/library/(resources)/album/$albumId")({
    parseParams: (params) => {
        const albumId = parseInt(params.albumId);
        if (isNaN(albumId)) {
            throw new Error(`Invalid albumId: ${params.albumId}`);
        }
        return { albumId };
    },
    loader: async ({ context: { queryClient }, params }) => {
        // Redirect to the hash route
        const p1 = queryClient.ensureQueryData(
            albumQueryOptions(
                params.albumId,
                true, // expand
                true // minimal
            )
        );

        const p2 = queryClient.ensureQueryData(
            artQueryOptions({ type: "album", id: params.albumId })
        );
        await Promise.all([p1, p2]);
    },
    component: RouteComponent,
});

function RouteComponent() {
    const params = Route.useParams();
    const { data: album } = useSuspenseQuery(
        albumQueryOptions(params.albumId, true, false)
    );

    return (
        <PageWrapper
            sx={{
                display: "flex",
                flexDirection: "column",
                minHeight: "100%",
                position: "relative",
            }}
        >
            <Box
                sx={{
                    display: "flex",
                    flexDirection: "column",
                    height: "100%",
                    flex: "1 1 auto",
                }}
            >
                <AlbumHeader
                    album={album}
                    sx={(theme) => ({
                        // Background gradient from bottom to top
                        background: `linear-gradient(to bottom, transparent 0%, ${theme.palette.background.paper} 100%)`,
                        position: "relative",
                        zIndex: 1,
                    })}
                />
                <Navigation
                    sx={(theme) => ({
                        background: theme.palette.background.paper,

                        borderBottom: `1px solid ${theme.palette.divider}`,
                        position: "sticky",
                        top: 0,
                    })}
                />
                <Box
                    sx={(theme) => ({
                        flex: "1 1 auto",
                        paddingInline: 2,
                        paddingBlock: 1,
                        //background: theme.palette.background.paper,
                        background: `linear-gradient(to bottom, ${theme.palette.background.paper} 0%, transparent 100%)`,
                    })}
                >
                    <Outlet />
                </Box>
            </Box>
        </PageWrapper>
    );
}

function Navigation({ sx, ...props }: BoxProps) {
    const theme = useTheme();
    const params = Route.useParams();

    return (
        <Box
            sx={[
                {
                    display: "flex",
                    justifyContent: "space-around",
                },
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                ...(Array.isArray(sx) ? sx : [sx]),
            ]}
            {...props}
        >
            <Tab
                to="/library/album/$albumId"
                params={params}
                activeOptions={{ exact: true }}
            >
                <AudioLinesIcon size={theme.iconSize.lg} />
                <Typography variant="body1">Tracks</Typography>
            </Tab>
            <Tab
                to="/library/album/$albumId/identifier"
                params={params}
                activeOptions={{ exact: true }}
            >
                <ImportIcon size={theme.iconSize.lg} />
                <Typography variant="body1">Identifier</Typography>
            </Tab>
            <Tab
                to="/library/album/$albumId/beetsdata"
                params={params}
                activeOptions={{ exact: true }}
            >
                <Typography variant="body1">Details</Typography>
            </Tab>
        </Box>
    );
}

const Tab = createLink(
    styled(Link)(({ theme }) => ({
        display: "flex",
        alignItems: "center",
        gap: theme.spacing(1),
        textDecoration: "none",
        color: theme.palette.text.secondary,
        width: "100%",
        padding: theme.spacing(1),
        justifyContent: "center",
        boxSizing: "border-box",
        borderBottom: `1px solid transparent`,
        position: "relative",

        "&[data-status='active']": {
            borderBottom: `1px solid ${theme.palette.text.primary}`,
            color: theme.palette.text.primary,

            ":after": {
                content: '""',
                position: "absolute",
                bottom: 0,
                left: 0,
                height: "100%",
                width: "100%",
                background: `radial-gradient(ellipse farthest-side at bottom, #ffffff15 0%, transparent 100%)`,
            },
        },
    }))
);
