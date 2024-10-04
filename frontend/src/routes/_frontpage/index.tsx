import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid2";
import { createFileRoute, Outlet } from "@tanstack/react-router";

import { InboxStatsGridItems } from "@/components/frontpage/inboxStats";
import { LibraryStats } from "@/components/frontpage/libraryStats";

export const Route = createFileRoute("/_frontpage/")({
    component: Index,
});

/** The frontpage is layout which adds an overview
 * of the current inbox and database.
 *
 * It also gives an outlet to render other relevant content
 * underneath. This may also be used to render a modal.
 */
function Index() {
    return (
        <Box sx={{ padding: "0.5rem" }}>
            <Outlet />
            <Grid container spacing={1} display="flex" justifyContent="center">
                <InboxStatsGridItems />
                <Grid
                    size={{
                        xs: 12,
                        sm: 8,
                        md: 8,
                        lg: 6,
                    }}
                >
                    <LibraryStats />
                </Grid>
            </Grid>
        </Box>
    );
}
