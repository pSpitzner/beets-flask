/** Includes function to interact with
 * our backend API for the inbox i.e.
 *
 * /api_v1/inbox
 */

import { UseMutationOptions } from "@tanstack/react-query";

import type { Folder, InboxStats } from "@/pythonTypes";

import { queryClient } from "./common";

// Tree of inbox folders
export const inboxQueryOptions = () => ({
    queryKey: ["inbox"],
    queryFn: async () => {
        const response = await fetch(`/inbox/tree`);
        return (await response.json()) as Folder[];
    },
});

/** Reset cache of the tree
 * needed for manual refresh.
 */
queryClient.setMutationDefaults(["refreshInboxTree"], {
    mutationFn: async () => {
        await fetch(`/inbox/tree/refresh`, { method: "POST" });
    },
    onSuccess: async () => {
        // Invalidate the query after the cache has been reset
        const q = inboxQueryOptions();

        // At least 0.5 second delay for loading indicator
        const ps = [
            queryClient.cancelQueries(q).then(() => queryClient.invalidateQueries(q)),
            new Promise((resolve) => setTimeout(resolve, 500)),
        ];
        await Promise.all(ps);
    },
});

// Some stats about the inbox(es)
export const inboxStatsQueryOptions = () => ({
    queryKey: ["inbox", "stats"],
    queryFn: async () => {
        const response = await fetch(`/inbox/stats`);
        const dat = (await response.json()) as InboxStats[];
        return dat;
    },
});

/* -------------------------------- Mutations ------------------------------- */
// Here for reference, not used yet but we might need it in the future

const deleteInboxMutation: UseMutationOptions<unknown, Error, string> = {
    mutationFn: async (inboxPath: string) => {
        return await fetch(`/inbox/path/${inboxPath}`, {
            method: "DELETE",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                with_status: [], // default, delete all, independent of status
            }),
        });
    },
    onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: ["inbox"] });
    },
};

const deleteInboxImportedMutation: UseMutationOptions<unknown, Error, string> = {
    mutationFn: async (inboxPath: string) => {
        return await fetch(`/inbox/path/${inboxPath}`, {
            method: "DELETE",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                with_status: ["imported"],
            }),
        });
    },
    onSuccess: async (_data, variables) => {
        await queryClient.invalidateQueries({ queryKey: ["inbox", "path", variables] });
    },
};
