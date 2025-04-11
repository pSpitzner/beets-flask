import { createFileRoute, Outlet } from "@tanstack/react-router";

import { inboxStatsQueryOptions } from "@/api/inbox";
import { libraryStatsQueryOptions } from "@/api/library";
import { PageWrapper } from "@/components/common/page";
import { InboxStatsComponent } from "@/components/inbox/stats";
import { LibraryStatsComponent } from "@/components/library/stats";

/* ------------------------------ Route layout ------------------------------ */

export const Route = createFileRoute("/_frontpage/")({
    component: Index,
    loader: async ({ context }) => {
        return await Promise.all([
            context.queryClient.ensureQueryData(libraryStatsQueryOptions()),
            context.queryClient.ensureQueryData(inboxStatsQueryOptions()),
        ]);
    },
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
    const [libraryStats, inboxStats] = Route.useLoaderData();

    return (
        <PageWrapper>
            <Outlet />
            <LibraryStatsComponent stats={libraryStats} />
            <InboxStatsComponent inboxStats={inboxStats} />
        </PageWrapper>
    );
}
