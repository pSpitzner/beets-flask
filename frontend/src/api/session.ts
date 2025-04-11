import { SerializedSessionState } from "@/pythonTypes";

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
