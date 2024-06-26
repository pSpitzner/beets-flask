import { queryClient } from "@/main";
import { UseMutationOptions, queryOptions } from "@tanstack/react-query";

// these guys can be infinetely nested and represent a file path on disk.
export interface FsPath {
    full_path: string;
    is_album: boolean;
    type: "directory" | "file";
    children: Record<string, FsPath>;
}

export const inboxQueryOptions = () =>
    queryOptions({
        queryKey: ["inbox"],
        queryFn: async function fetchInboxes() {
            const response = await fetch(`/inbox`);
            return (await response.json()) as FsPath[];
        },
    });

export const fsPathQueryOptions = (path: string) =>
    queryOptions({
        queryKey: ["inbox", "path", path],
        queryFn: () => fetchFsPath(path),
    });
async function fetchFsPath(folderPath: string): Promise<FsPath> {
    if (folderPath.startsWith("/")) folderPath = folderPath.slice(1);
    const response = await fetch(`/inbox/path/${folderPath}`);
    return (await response.json()) as FsPath;
}

export interface InboxStats {
    nFiles: number;
    size: number;
    nTagged: number;
    sizeTagged: number;
    inboxName: string;
    inboxPath: string;
    lastTagged?: Date;
}

export const inboxStatsQueryOptions = () => {
    return queryOptions({
        queryKey: ["inbox", "stats"],
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

/* -------------------------------------------------------------------------- */
/*                                  Mutations                                 */
/* -------------------------------------------------------------------------- */

export const deleteInboxMutation: UseMutationOptions<unknown, Error, string> = {
    mutationFn: async (inboxPath: string) => {
        return await fetch(`/inbox/path/${inboxPath}`, { method: "DELETE" });
    },
};

export const deleteInboxImportedMutation: UseMutationOptions = {
    mutationFn: async () => {},
};

export const retagInboxNewMutation: UseMutationOptions<unknown, Error, string> = {
    mutationFn: async (inboxPath: string) => {
        return await fetch(`/inbox/autotag`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                folder: inboxPath,
                kind: "preview",
                with_status: ["notag"],
            }),
        });
    },
};

export const retagInboxAllMutation: UseMutationOptions<unknown, Error, string> = {
    mutationFn: async (inboxPath: string) => {
        return await fetch(`/inbox/autotag`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                folder: inboxPath,
                kind: "preview",
                with_status: ["unmatched", "failed", "tagged", "notag"],
            }),
        });
    },
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["inbox"] });
    },
};
