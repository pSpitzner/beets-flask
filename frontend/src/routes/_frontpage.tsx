import { Outlet, createFileRoute } from "@tanstack/react-router";
import { InboxStatsOverview } from "@/components/frontpage/inboxStats";
import { TagsStatsOverview } from "@/components/frontpage/tagsStats";
import { AddInbox } from "@/components/frontpage/addInbox";
import Grid from "@mui/material/Unstable_Grid2";
import { LibraryStats } from "@/components/frontpage/libraryStats";

export const Route = createFileRoute("/_frontpage")({
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
                <Grid xs={12} sm={6} md={6} lg={4}>
                    <InboxStatsOverview />
                </Grid>
                <Grid flexGrow={1} xs={12} sm={6} md={6} lg={4}>
                    <TagsStatsOverview />
                </Grid>
                <Grid xs={12} sm={6} md={6} lg={4}>
                    <LibraryStats />
                </Grid>
                <Grid xs={12} sm={6} md={6} lg={4}>
                    <AddInbox />
                </Grid>
            </Grid>
        </div>
    );
}
