import { Box } from "@mui/material";
import { createFileRoute } from "@tanstack/react-router";

import { Link } from "@/components/common/link";
import { PageWrapper } from "@/components/common/page";

export const Route = createFileRoute("/library/browse/")({
    component: RouteComponent,
});

function RouteComponent() {
    return (
        <PageWrapper>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <Link to="/library/browse/artists">Browse Artists</Link>
                <Link to="/library/browse/albums">Browse Albums</Link>
            </Box>
        </PageWrapper>
    );
}
