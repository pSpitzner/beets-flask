import { Box, Typography } from "@mui/material";
import { createFileRoute } from "@tanstack/react-router";

import { Link } from "@/components/common/link";
import { PageWrapper } from "@/components/common/page";

export const Route = createFileRoute("/debug/")({
    component: RouteComponent,
});

function RouteComponent() {
    return (
        <PageWrapper sx={{ gap: "1rem", display: "flex", flexDirection: "column" }}>
            <Typography variant="h4" component="h1">
                Debug Pages
            </Typography>
            <Typography variant="body1">
                This page is for debugging the application. It contains links to various
                debug pages with various information.
            </Typography>
            <Box>
                <Typography variant="h5" component="h2">
                    Design
                </Typography>
                <Box component="ul">
                    <Link to="/debug/design/icons">
                        <li>Icons overview</li>
                    </Link>
                    <Link to="/debug/design/loading">
                        <li>Loading states</li>
                    </Link>
                    <Link to="/debug/design/buttons">
                        <li>Buttons</li>
                    </Link>
                </Box>
            </Box>
            <Box>
                <Typography variant="h5" component="h2">
                    Other
                </Typography>
                <Box component="ul">
                    <Link to="/debug/jobs">
                        <li>Redis jobs</li>
                    </Link>
                    <Link to="/debug/error">
                        <li>Test error page</li>
                    </Link>
                </Box>
            </Box>
        </PageWrapper>
    );
}
