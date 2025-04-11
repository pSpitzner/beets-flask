import { queryOptions } from "@tanstack/react-query";

import { LibraryStats as _LibraryStats } from "@/pythonTypes";

export type LibraryStats = Omit<_LibraryStats, "lastItemAdded" | "lastItemModified"> & {
    lastItemAdded?: Date;
    lastItemModified?: Date;
};

// Some stats about the library
export const libraryStatsQueryOptions = () => {
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
