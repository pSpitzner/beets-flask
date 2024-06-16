/** You can find all fetch and query functions
 * for the general stats here.
 *
 * I.e. inbox, tags, library, etc.
 */

import { queryOptions } from "@tanstack/react-query";

export interface InboxStats {
    nFiles: number;
    size: number;
}

export const inboxStatsQueryOptions = () => {
    return queryOptions({
        queryKey: ["inboxStats"],
        queryFn: async () => {
            const response = await fetch(`/inbox/stats`);
            return (await response.json()) as InboxStats;
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
    lastItemAdded: Date;
}

export const libraryStatsQueryOptions = () => {
    return queryOptions({
        queryKey: ["libraryStats"],
        queryFn: async () => {
            const response = await fetch(`/library/stats`);
            const dat = (await response.json()) as LibraryStats;

            // convert lastItemAdded to Date
            dat.lastItemAdded = new Date(dat.lastItemAdded);
            return dat;
        },
    });
};
