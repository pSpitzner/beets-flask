import { Suspense } from "react";
import { createFileRoute } from "@tanstack/react-router";

import { sessionQueryOptions } from "@/api/session";
import { PageWrapper } from "@/components/common/page";
import { TaskCandidates } from "@/components/import/candidates/candidate";

export const Route = createFileRoute("/_debug/session/$id")({
    component: RouteComponent,
    loader: ({ context, params }) => {
        return context.queryClient.ensureQueryData(
            sessionQueryOptions({ folderHash: params.id })
        );
    },
});

function RouteComponent() {
    const data = Route.useLoaderData();

    if (!data) {
        return "Session not found";
    }

    return (
        <Suspense fallback={<div>Loading...</div>}>
            <PageWrapper>
                <TaskCandidates task={data.tasks[0]}></TaskCandidates>
            </PageWrapper>
        </Suspense>
    );
}
