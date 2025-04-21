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

export const deleteFoldersMutationOptions: UseMutationOptions<
    Response | undefined,
    Error,
    {
        folderPaths: string[];
        folderHashes: string[];
    },
    {
        previousInbox: Folder[] | undefined;
    }
> = {
    mutationFn: async ({ folderPaths, folderHashes }) => {
        return await fetch(`/inbox/delete`, {
            method: "DELETE",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                folder_paths: folderPaths,
                folder_hashs: folderHashes,
            }),
        });
    },

    // Optimistic update
    onMutate: async ({ folderPaths, folderHashes }) => {
        // Cancel any outgoing refetches (so they don't overwrite our optimistic update)
        await queryClient.cancelQueries({ queryKey: ["inbox"] });
        // Snapshot the previous value
        const previousInbox = queryClient.getQueryData<Folder[]>(["inbox"]);
        // Optimistically update to the new value
        queryClient.setQueryData<Folder[]>(["inbox"], (old) => {
            if (!old) return old;
            return old.filter((folder) => {
                const folderPath = folder.full_path;
                const folderHash = folder.hash;
                return (
                    !folderPaths.includes(folderPath) &&
                    !folderHashes.includes(folderHash)
                );
            });
        });
        // Return a context object with the snapshotted value
        return { previousInbox };
    },
    onError: (_err, _variables, context) => {
        // If the mutation fails, use the context returned from onMutate
        queryClient.setQueryData(["inbox"], context?.previousInbox);
    },

    // If the mutation is successful, invalidate the query, this should trigger a refetch
    onSettled: async () => {
        await queryClient.invalidateQueries({ queryKey: ["inbox"] });
    },
};
