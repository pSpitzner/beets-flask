import { UseMutationOptions } from "@tanstack/react-query";

import { useStatusSocket } from "@/components/common/websocket/status";
import { FolderSelectionContext } from "@/components/inbox/folderSelectionContext";
import {
    EnqueueKind,
    FolderStatus,
    FolderStatusResponse,
    JobStatusUpdate,
    SerializedException,
    SerializedSessionState,
} from "@/pythonTypes";

import { APIError, queryClient } from "./common";

import { Socket } from "socket.io-client";

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
        const res = (await response.json()) as
            | SerializedSessionState
            | SerializedException;
        // check if we have error as a key in res
        if ("type" in res) {
            // if we have an error, throw it
            throw new APIError(res);
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
export const enqueueMutationOptions: UseMutationOptions<
    Response | undefined,
    Error,
    {
        selected: FolderSelectionContext["selected"];
        kind: EnqueueKind;

        // Allow for extra params
        [key: string]: unknown;
    }
> = {
    mutationFn: async ({ selected, kind, ...extra }) => {
        return await fetch("/session/enqueue", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                kind: kind.toString(),
                folder_hashes: selected.hashes,
                folder_paths: selected.paths,
                ...extra,
            }),
        });
    },

    // Optimistic update for status
    onMutate: async ({ selected, kind }) => {
        const queryKey = statusQueryOptions.queryKey;
        await queryClient.cancelQueries({ queryKey });

        queryClient.setQueryData<FolderStatusResponse[]>(queryKey, (old) => {
            if (!old) return old;
            const found = new Set();
            const nex = old.map((status) => {
                if (selected.hashes.includes(status.hash)) {
                    status.status = FolderStatus.PENDING;
                    status.exc = null;
                    found.add(status.hash);
                }
                return status;
            });
            for (const hash of selected.hashes) {
                if (!found.has(hash)) {
                    nex.push({
                        path: selected.paths[selected.hashes.indexOf(hash)],
                        hash: hash,
                        status: FolderStatus.PENDING,
                        exc: null,
                    });
                }
            }
            return nex;
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
        socket: Socket;
        folder_hash: string;
        search_ids: string[];
        search_artist?: string;
        search_album?: string;
    }
> = {
    mutationKey: ["add_candidate"],
    mutationFn: async ({
        socket,
        folder_hash,
        search_ids,
        search_artist,
        search_album,
    }) => {
        async function waitForJobUpdate({
            socket,
            jobRef,
        }: {
            socket: Socket;
            jobRef: string;
        }) {
            let handleUpdate: (data: JobStatusUpdate) => void;

            const promiseTimeout = new Promise<never>((_, reject) => {
                setTimeout(() => {
                    socket.off("job_status_update", handleUpdate);
                    reject(
                        new Error(
                            "Timeout: Candidate lookup took longer than 30 seconds"
                        )
                    );
                }, 30_000);
            });

            const promiseSuccess = new Promise((resolve) => {
                handleUpdate = (data: JobStatusUpdate) => {
                    console.log("Socket Job update", data);
                    data.job_metas.forEach((meta) => {
                        if (meta.job_frontend_ref === jobRef) {
                            console.log("Match!", data);
                            socket.off("job_status_update", handleUpdate);
                            resolve(data);
                        }
                    });
                };
                socket.on("job_status_update", handleUpdate);
            });

            return Promise.race([promiseSuccess, promiseTimeout]);
        }

        const jobRef = `${folder_hash}-${Date.now()}-${Math.random()}`;
        const promiseResult = waitForJobUpdate({
            socket,
            jobRef: jobRef,
        });

        const res = await fetch("/session/add_candidates", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                folder_hashes: [folder_hash],
                search_ids,
                search_artist,
                search_album,
                job_frontend_ref: jobRef,
            }),
        });

        // no need to process, just for debugging, errors handled in custom fetch
        const _data = (await res.json()) as JobStatusUpdate;

        return promiseResult;
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

/* ----------------------------- Session status ----------------------------- */
export const statusQueryOptions = {
    queryKey: ["status", "all"],
    queryFn: async () => {
        // fetch initial status
        // further updates will be handled by the socket
        const response = await fetch("/session/status");
        return (await response.json()) as FolderStatusResponse[];
    },
};
