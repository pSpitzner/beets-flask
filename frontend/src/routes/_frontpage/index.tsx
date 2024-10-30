import Grid from "@mui/material/Grid2";
import { createFileRoute, Outlet } from "@tanstack/react-router";

import { libraryStatsQueryOptions } from "@/components/common/_query";
import { PageWrapper } from "@/components/common/page";
import { InboxStatsGridItems } from "@/components/frontpage/inboxStats";
import { InboxStatsComponent } from "@/components/inbox/stats";
import { LibraryStatsComponent } from "@/components/library/stats";

export const Route = createFileRoute("/_frontpage/")({
    component: Index,
    loader: async ({ context }) => {
        await context.queryClient.ensureQueryData(libraryStatsQueryOptions());
    },
    meta: () => [{ title: "Home" }],
    staleTime: 20_000, // 20 seconds
});

/** The frontpage is layout which adds an overview
 * of the current inbox, displaying the number of files,
 * the size, the number of tagged files, the size of tagged.
 * Also some redis stats are shown.
 *
 * It also gives an outlet to render other relevant content
 * underneath. This may also be used to render a modal.
 */
function Index() {
    return (
        <PageWrapper>
            <Outlet />
            <LibraryStatsComponent />
            <InboxStatsComponent />
        </PageWrapper>
    );
}
