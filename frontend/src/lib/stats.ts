/** You can find all fetch and query functions
 * for the general stats here.
 *
 * I.e. inbox, tags, library, etc.
 */

import { queryOptions } from "@tanstack/react-query";

export interface InboxStats {
    nFiles: number;
    size: number;
    inboxName: string;
    mountPoint: string;
    lastTagged?: Date;
}

export const inboxStatsQueryOptions = () => {
    return queryOptions({
        queryKey: ["inboxStats"],
        queryFn: async () => {
            const response = await fetch(`/inbox/stats`);

            const res = (await response.json()) as InboxStats[];

            for (const stat of res) {
                if (stat.lastTagged) stat.lastTagged = new Date(stat.lastTagged);
            }

            return res;
        },
    });
};

export interface LibraryStats {
    items: number;
    albums: number;
    artists: number;
    genres: number;
    labels: number;
    size: number;
    lastItemAdded?: Date;
    lastItemModified?: Date;
}

export const libraryStatsQueryOptions = () => {
    return queryOptions({
        queryKey: ["libraryStats"],
        queryFn: async () => {
            const response = await fetch(`/library/stats`);
            const dat = (await response.json()) as LibraryStats;

            // convert lastItemAdded to Date
            if (dat.lastItemAdded) dat.lastItemAdded = new Date(dat.lastItemAdded);
            if (dat.lastItemModified)
                dat.lastItemModified = new Date(dat.lastItemModified);

            return dat;
        },
    });
};
