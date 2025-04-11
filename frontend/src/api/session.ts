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
