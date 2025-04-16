import { Suspense } from "react";
import { Box } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { sessionQueryOptions } from "@/api/session";
import { PageWrapper } from "@/components/common/page";
import { TaskCandidates } from "@/components/import/candidates/candidate";

export const Route = createFileRoute("/_debug/session/$id")({
    component: RouteComponent,
    loader: async ({ context, params }) => {
        await context.queryClient.prefetchQuery(
            sessionQueryOptions({ folderHash: params.id })
        );
    },
});

function RouteComponent() {
    const { data } = useQuery(
        sessionQueryOptions({ folderHash: Route.useParams().id })
    );

    if (!data) {
        return "Session not found";
    }

    // Prototype for session exc handling
    // TODO: Make it nicer and better suited for
    // different exceptions
    if (data.exc) {
        return (
            <Box>
                <h1>Failed at {data.status.progress}</h1>
                <p>{data.exc.message}</p>
                <pre>{JSON.stringify(data.exc, null, 2)}</pre>
            </Box>
        );
    }

    return (
        <Suspense fallback={<div>Loading...</div>}>
            <PageWrapper>
                <TaskCandidates
                    task={data.tasks[0]}
                    folderHash={data.folder_hash}
                ></TaskCandidates>
            </PageWrapper>
        </Suspense>
    );
}
