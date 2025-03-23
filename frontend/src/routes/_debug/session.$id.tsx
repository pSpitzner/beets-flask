import { createFileRoute } from "@tanstack/react-router";

import { PageWrapper } from "@/components/common/page";
import { CandidateItem, CandidateList } from "@/components/import/candidateNew";
import { SerializedSessionState } from "@/pythonTypes";

export const Route = createFileRoute("/_debug/session/$id")({
    component: RouteComponent,
    loader: async ({ context, params }) => {
        return await context.queryClient.ensureQueryData(sessionQueryOptions(params.id));
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
        return response.json() as Promise<SerializedSessionState>;
    },
});

function RouteComponent() {
    const data = Route.useLoaderData();

    return (
        <PageWrapper>
            <CandidateList>
                {data.tasks[0].candidates
                    .sort((a, b) => a.distance - b.distance)
                    .map((c) => {
                        return <CandidateItem candidate={c} />;
                    })}
            </CandidateList>
        </PageWrapper>
    );
}
