import { queryOptions } from "@tanstack/react-query";
import { createFileRoute, Outlet } from "@tanstack/react-router";

import { PageWrapper } from "@/components/common/page";
import { InboxStatsComponent } from "@/components/inbox/stats";
import { LibraryStatsComponent } from "@/components/library/stats";
import { LibraryStats as _LibraryStats } from "@/pythonTypes";
import { InboxStats } from "@/pythonTypes";

/* ------------------------------ Data fetching ----------------------------- */

export type LibraryStats = Omit<_LibraryStats, "lastItemAdded" | "lastItemModified"> & {
    lastItemAdded?: Date;
    lastItemModified?: Date;
};

const libraryStatsQueryOptions = () => {
    return queryOptions({
        queryKey: ["libraryStats"],
        queryFn: async () => {
            const response = await fetch(`/library/stats`);
            const dat = (await response.json()) as _LibraryStats;

            return {
                ...dat,
                lastItemAdded: dat.lastItemAdded
                    ? new Date(dat.lastItemAdded)
                    : undefined,
                lastItemModified: dat.lastItemModified
                    ? new Date(dat.lastItemModified)
                    : undefined,
            } as LibraryStats;
        },
    });
};

const inboxStatsQueryOptions = () => {
    return queryOptions({
        queryKey: ["inbox", "stats"],
        queryFn: async () => {
            const response = await fetch(`/inbox/stats`);
            const dat = (await response.json()) as InboxStats[];
            return dat;
        },
    });
};

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
