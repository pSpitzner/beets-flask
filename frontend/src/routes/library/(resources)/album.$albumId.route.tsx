import { AudioLinesIcon } from "lucide-react";
import { Box, useTheme } from "@mui/material";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Outlet } from "@tanstack/react-router";

import { albumQueryOptions } from "@/api/library";
import { BackIconButton } from "@/components/common/inputs/back";
import { Loading } from "@/components/common/loading";
import { NavigationTabs } from "@/components/common/navigation";
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

        // don't wait for cover-art here. we want to show main content fast
        // and handle errors for artwork with ui placeholder.
        await Promise.all([p1]);
    },
    pendingComponent: PendingComponent,
    component: RouteComponent,
});

function PendingComponent() {
    const theme = useTheme();

    return (
        <Box
            sx={{
                display: "flex",
                flexDirection: "column",
                height: "100%",
                margin: "auto",
                maxWidth: "120px",
                justifyContent: "center",
                alignItems: "center",
            }}
        >
            <Loading noteColor={theme.palette.primary.main} />
            <Box component="span" style={{ marginTop: "1rem" }}>
                Loading...
            </Box>
        </Box>
    );
}

function RouteComponent() {
    const params = Route.useParams();
    const { data: album } = useSuspenseQuery(
        albumQueryOptions(params.albumId, true, false)
    );

    return (
        <PageWrapper
            sx={(theme) => ({
                display: "flex",
                flexDirection: "column",
                minHeight: "100%",
                height: "100%",
                position: "relative",
                overflow: "hidden",
                [theme.breakpoints.up("laptop")]: {
                    padding: 2,
                },
            })}
        >
            <BackIconButton
                sx={{
                    // TODO: styling for mobile
                    position: "absolute",
                    top: 0,
                    left: 0,
                    zIndex: 2,
                    margin: 0.5,
                }}
                size="small"
                color="primary"
            />
            <Box
                sx={(theme) => ({
                    display: "flex",
                    flexDirection: "column",
                    height: "100%",
                    flex: "1 1 auto",
                    overflow: "hidden",
                    [theme.breakpoints.up("laptop")]: {
                        backgroundColor: "background.paper",
                        borderRadius: 2,
                    },
                })}
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
                <NavigationTabs
                    items={[
                        {
                            to: `/library/album/$albumId`,
                            params,
                            label: "Tracks",
                            icon: <AudioLinesIcon />,
                        },
                        {
                            to: `/library/album/$albumId/identifier`,
                            params,
                            label: "Identifiers",
                        },
                        {
                            to: `/library/album/$albumId/beetsdata`,
                            params,
                            label: "Details",
                        },
                    ]}
                />
                <Box
                    sx={(theme) => ({
                        flex: "1 1 auto",
                        paddingInline: 2,
                        paddingBlock: 1,
                        height: "100%",
                        minHeight: 0,
                        overflow: "auto",
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
