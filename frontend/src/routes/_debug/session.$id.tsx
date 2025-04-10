import { createFileRoute } from "@tanstack/react-router";

import { APIError, ErrorData, queryClient } from "@/components/common/_query";
import { PageWrapper } from "@/components/common/page";
import { TaskCandidates } from "@/components/import/candidates/candidate";
import { SerializedSessionState } from "@/pythonTypes";

export const Route = createFileRoute("/_debug/session/$id")({
    component: RouteComponent,
    loader: async ({ context, params }) => {
        return await context.queryClient.ensureQueryData(
            sessionQueryOptions({ folderHash: params.id })
        );
    },
});

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

function RouteComponent() {
    const data = Route.useLoaderData();

    if (!data) {
        return "Session not found";
    }

    return (
        <PageWrapper>
            <TaskCandidates task={data.tasks[0]}></TaskCandidates>
        </PageWrapper>
    );
}
