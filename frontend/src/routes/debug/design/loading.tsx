import { Box, Button, Typography, useTheme } from "@mui/material";
import { createFileRoute } from "@tanstack/react-router";

import {
    Loading,
    LoadingSmall,
    LoadingWithFeedback,
} from "@/components/common/loading";
import { PageWrapper } from "@/components/common/page";

export const Route = createFileRoute("/debug/design/loading")({
    component: RouteComponent,
});

function RouteComponent() {
    const theme = useTheme();
    return (
        <PageWrapper
            sx={{
                gap: "1rem",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                marginTop: "2rem",
            }}
        >
            <Box
                sx={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "1rem",
                    justifyContent: "center",
                    alignItems: "center",
                }}
            >
                <Typography variant="body1" component="div" gutterBottom>
                    Loading component with different colors
                </Typography>
                <Box
                    sx={{
                        display: "flex",
                        flexDirection: "column",
                        maxWidth: "120px",
                        justifyContent: "center",
                        alignItems: "center",
                    }}
                >
                    <Loading noteColor={theme.palette.primary.main} />
                </Box>
            </Box>
            <Box
                sx={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "1rem",
                    alignItems: "center",
                }}
            >
                <Typography variant="body1" component="div" gutterBottom>
                    Loading with status feedback
                </Typography>
                <LoadingWithFeedback feedback="Some feedback" color="primary" />
            </Box>
            <Box>
                <Typography variant="body1" component="div" gutterBottom>
                    Loading buttons with different sizes (wip needs some work and
                    integration as standard mui loading button)
                </Typography>
                <Box
                    sx={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "1rem",
                        justifyContent: "center",
                        alignItems: "center",
                    }}
                >
                    <Button variant="contained" size="large">
                        <LoadingSmall />
                    </Button>
                    <Button variant="contained" size="medium">
                        <LoadingSmall />
                    </Button>
                    <Button variant="contained" size="small">
                        <LoadingSmall />
                    </Button>
                </Box>
            </Box>
        </PageWrapper>
    );
}
