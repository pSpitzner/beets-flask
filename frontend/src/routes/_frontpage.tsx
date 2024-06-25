import { Outlet, createFileRoute } from "@tanstack/react-router";
import { InboxStatsGridItems } from "@/components/frontpage/inboxStats";
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
                <InboxStatsGridItems />
                <Grid xs={12} sm={8} md={8} lg={6}>
                    <LibraryStats />
                </Grid>
                <Grid xs={12} sm={8} md={8} lg={6}>
                    <TagsStatsOverview />
                </Grid>
                <Grid xs={12} sm={8} md={8} lg={6}>
                    <AddInbox />
                </Grid>
            </Grid>
        </div>
    );
}
