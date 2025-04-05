import { queryOptions, UseMutationOptions } from "@tanstack/react-query";

import { queryClient } from "@/components/common/_query";

// these guys can be infinetely nested and represent a file path on disk.
export interface FsPath {
    full_path: string;
    is_album: boolean;
    is_inbox?: boolean;
    type: "directory" | "file";
    children: Record<string, FsPath>;
}

export const inboxQueryAllOptions = () =>
    queryOptions({
        queryKey: ["inbox"],
        queryFn: async () => {
            const response = await fetch(`/inbox`);
            return (await response.json()) as FsPath[];
        },
    });

export const inboxQueryByPathOptions = (path: string) =>
    queryOptions({
        queryKey: ["inbox", "path", path],
        queryFn: async () => {
            if (path.startsWith("/")) path = path.slice(1);
            const response = await fetch(`/inbox/path/${path}`);
            return (await response.json()) as FsPath;
        },
    });

// A flat array of paths in the inbox
export const inboxPathsQueryOptions = (show_files = false) => {
    return queryOptions({
        queryKey: ["inbox", "paths", show_files],
        queryFn: async () => {
            const response = await fetch(`/inbox/flatPaths`, {
                method: "POST",
                body: JSON.stringify({
                    show_files,
                }),
            });
            return (await response.json()) as string[];
        },
    });
};

/* -------------------------------------------------------------------------- */
/*                                  Mutations                                 */
/* -------------------------------------------------------------------------- */

export const deleteInboxMutation: UseMutationOptions<unknown, Error, string> = {
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

export const deleteInboxImportedMutation: UseMutationOptions<unknown, Error, string> = {
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
