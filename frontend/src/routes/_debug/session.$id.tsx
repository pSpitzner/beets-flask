import { PageWrapper } from "@/components/common/page";
import { SerializedCandidateState, SerializedSessionState } from "@/pythonTypes";
import { Box } from "@mui/material";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_debug/session/$id")({
    component: RouteComponent,
    loader: async ({ context, params }) => {
        return await context.queryClient.ensureQueryData(
            sessionQueryOptions(params.id)
        );
    },
});

const sessionQueryOptions = (id: string) => ({
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
            <Box
                sx={{
                    display: "grid",
                    gridTemplateColumns: "repeat(5, auto)",
                    columnGap: 2,
                }}
            >
                {data.tasks[0].candidates
                    .sort((a, b) => a.distance - b.distance)
                    .map((c) => {
                        return <Candidate candidate={c} />;
                    })}
            </Box>
        </PageWrapper>
    );
}

function Candidate({ candidate }: { candidate: SerializedCandidateState }) {
    return (
        <Box sx={{ display: "contents" }}>
            <Box sx={{ justifySelf: "flex-end" }}>
                {(Math.abs(candidate.distance - 1) * 100).toFixed(2)}%
            </Box>
            <span>{candidate.info.album}</span>
            <span>{candidate.info.artist}</span>
            <span>{candidate.type}</span>
            <span>{candidate.info.data_url}</span>
        </Box>
    );
}
