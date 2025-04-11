/** Includes function to interact with
 * our backend API for the inbox i.e.
 *
 * /api_v1/inbox
 */

import type { Folder } from "@/pythonTypes";

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
