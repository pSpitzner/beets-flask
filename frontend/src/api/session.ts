import { UseMutationOptions } from "@tanstack/react-query";

import { FolderSelectionContext } from "@/components/inbox/folderSelectionContext";
import { EnqueueKind, SerializedSessionState } from "@/pythonTypes";

import { APIError, ErrorData, queryClient } from "./common";

export const sessionQueryOptions = ({
    folderHash,
    folderPath,
}: {
    folderHash?: string;
    folderPath?: string;
}) => ({
    queryKey: ["session", { folderHash, folderPath }],
    queryFn: async () => {
        const response = await fetch(`/session/by_folder`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                folder_hashes: [folderHash],
                folder_paths: [folderPath],
            }),
        });
        // make sure we have a folder
        const res = (await response.json()) as SerializedSessionState | ErrorData;
        // check if we have error as a key in res
        if ("error" in res) {
            if (res["error"] == "Not Found") {
                return undefined;
            } else {
                throw new APIError(res);
            }
        }

        queryClient.setQueryData<SerializedSessionState>(
            ["session", { folderHash: res.folder_hash, folderPath: res.folder_path }],
            res
        );

        return res;
    },
});

/* ------------------------------ Invalidation ------------------------------ */

/** Invalidates all session data which
 * is related to the given folder/session.
 *
 * If a hash is given, this will only invalidate
 * the session with the given hash. Otherwise it will invalidates
 * all sessions with the given path.
 */
export async function invalidateSession(
    folderHash?: string,
    folderPath?: string,
    strict = false
): Promise<void> {
    console.debug("Invalidate session", folderHash, folderPath);
    await queryClient.invalidateQueries({
        predicate: (query) => {
            if (query.queryKey[0] !== "session") return false;
            const { folderHash: qHash, folderPath: qPath } = query.queryKey[1] as {
                folderHash?: string;
                folderPath?: string;
            };
            // If we have a hash, invalidate only this session
            if (folderHash && strict) {
                return qHash == folderHash;
            }
            // Otherwise invalidate all sessions with the given path
            return qPath == folderPath || qHash == folderPath;
        },
    });
}

/* -------------------------------- Mutations ------------------------------- */

/** Enqueue a new task
 * i.e. tag a folder of import a folder
 *
 * We have one entrypoint for invoking session
 * actions in the backend.
 */
export const enqueueMutationOptions = {
    mutationFn: async ({
        selected,
        kind,
    }: {
        selected: FolderSelectionContext["selected"];
        kind: EnqueueKind;
    }) => {
        return await fetch("/session/enqueue", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                kind: kind.toString(),
                folder_hashes: selected.hashes,
                folder_paths: selected.paths,
            }),
        });
    },
};

/** Add/Search a candidate
 * for a given session.
 *
 * A session can be uniquly indetified by
 * its folder_hash.
 */

export const addCandidateMutationOptions: UseMutationOptions<
    unknown,
    APIError,
    {
        folder_hash: string;
        search_ids: string[];
        search_artist?: string;
        search_album?: string;
    }
> = {
    mutationKey: ["add_candidate"],
    mutationFn: async ({ folder_hash, search_ids, search_artist, search_album }) => {
        return await fetch("/session/add_candidates", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                folder_hashes: [folder_hash],
                search_ids,
                search_artist,
                search_album,
            }),
        });
    },
    onSuccess: async (data, variables) => {
        // Invalidate the query after the cache has been reset
        const q = sessionQueryOptions({ folderHash: variables.folder_hash });

        // At least 0.5 second delay for loading indicator
        const ps = [
            queryClient.cancelQueries(q).then(() => queryClient.invalidateQueries(q)),
            new Promise((resolve) => setTimeout(resolve, 500)),
        ];
        await Promise.all(ps);
    },
};
