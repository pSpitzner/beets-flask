/** You can find all fetch and query functions
 * for the general stats here.
 *
 * I.e. inbox, tags, library, etc.
 */

import { queryOptions } from "@tanstack/react-query";

interface InboxStats {
    nFiles: number;
    size: number;
}

async function fetchInboxStats(): Promise<InboxStats> {
    const response = await fetch(`/inbox/stats`);
    return (await response.json()) as InboxStats;
}

export const inboxStatsQueryOptions = () => {
    return queryOptions({
        queryKey: ["inboxStats"],
        queryFn: () => fetchInboxStats(),
    });
};
