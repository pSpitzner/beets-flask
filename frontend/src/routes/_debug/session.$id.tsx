import { createFileRoute } from "@tanstack/react-router";

import { PageWrapper } from "@/components/common/page";
import { TaskCandidates } from "@/components/import/candidateNew";
import { SerializedSessionState } from "@/pythonTypes";
import { APIError, ErrorData } from "@/components/common/_query";

export const Route = createFileRoute("/_debug/session/$id")({
    component: RouteComponent,
    loader: async ({ context, params }) => {
        return await context.queryClient.ensureQueryData(
            sessionQueryOptions(params.id)
        );
    },
});

export const sessionQueryOptions = (id: string) => ({
    queryKey: ["session", id],
    queryFn: async () => {
        const response = await fetch(`/session/by_folder`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ folder_hashes: [id], folder_paths: [] }),
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
