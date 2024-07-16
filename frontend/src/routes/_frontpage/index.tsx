import { Outlet, createFileRoute } from "@tanstack/react-router";
import { InboxStatsGridItems } from "@/components/_frontpage/inboxStats";

import Grid from "@mui/material/Unstable_Grid2";
import { LibraryStats } from "@/components/_frontpage/libraryStats";

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
        <div>
            <Outlet />
            <Grid container spacing={2} display="flex" justifyContent="center">
                <InboxStatsGridItems />
                <Grid xs={12} sm={8} md={8} lg={6}>
                    <LibraryStats />
                </Grid>
            </Grid>
        </div>
    );
}
