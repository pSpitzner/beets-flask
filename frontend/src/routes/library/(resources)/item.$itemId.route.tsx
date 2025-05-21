import { Box, BoxProps, Link, styled, Typography, useTheme } from "@mui/material";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, createLink, Outlet } from "@tanstack/react-router";

import { queryClient } from "@/api/common";
import { itemQueryOptions } from "@/api/library";
import { PageWrapper } from "@/components/common/page";
import { ItemHeader } from "@/components/library/item";

export const Route = createFileRoute("/library/(resources)/item/$itemId")({
    parseParams: (params) => {
        const itemId = parseInt(params.itemId);
        if (isNaN(itemId)) {
            throw new Error(`Invalid itemId: ${params.itemId}`);
        }
        return { itemId };
    },
    component: RouteComponent,
    loader: async (opts) => {
        await queryClient.ensureQueryData(itemQueryOptions(opts.params.itemId, false));
    },
});

function RouteComponent() {
    const params = Route.useParams();
    const { data: item } = useSuspenseQuery(itemQueryOptions(params.itemId, false));

    return (
        <PageWrapper
            sx={{
                display: "flex",
                flexDirection: "column",
                minHeight: "100%",
                height: "100%",
                position: "relative",
                overflow: "hidden",
            }}
        >
            <Box
                sx={{
                    display: "flex",
                    flexDirection: "column",
                    height: "100%",
                    flex: "1 1 auto",
                    overflow: "hidden",
                }}
            >
                <ItemHeader
                    item={item}
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
                        height: "100%",
                        minHeight: 0,
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
                to="/library/item/$itemId"
                params={params}
                activeOptions={{ exact: true }}
            >
                <Typography variant="body1">Track</Typography>
            </Tab>
            <Tab
                to="/library/item/$itemId/identifier"
                params={params}
                activeOptions={{ exact: true }}
            >
                <Typography variant="body1">Identifier</Typography>
            </Tab>
            <Tab
                to="/library/item/$itemId/beetsdata"
                params={params}
                activeOptions={{ exact: true }}
            >
                <Typography variant="body1">Details</Typography>
            </Tab>
        </Box>
    );
}

// TODO: Use mui tabs for better styling
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
