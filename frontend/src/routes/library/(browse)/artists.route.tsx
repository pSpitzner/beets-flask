import { Box, useTheme } from "@mui/material";
import { createFileRoute, Outlet } from "@tanstack/react-router";

import { Loading } from "@/components/common/loading";
import { PageWrapper } from "@/components/common/page";

export const Route = createFileRoute("/library/(browse)/artists")({
    component: RouteComponent,
    pendingComponent: PendingComponent,
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
    return (
        <PageWrapper
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
                    [theme.breakpoints.up("laptop")]: {
                        backgroundColor: "background.paper",
                        borderRadius: 2,
                    },
                })}
            >
                <Outlet />
            </Box>
        </PageWrapper>
    );
}
