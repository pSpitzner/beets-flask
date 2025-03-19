import { JSONPretty } from "@/components/common/json";
import { PageWrapper } from "@/components/common/page";
import { statusQueryOptions } from "@/components/common/websocket/status";
import { Button, Typography } from "@mui/material";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_debug/jobs")({
    component: RouteComponent,
});

function RouteComponent() {
    const { data: queues, refetch: refetchQueues } = useSuspenseQuery({
        queryKey: ["queues"],
        queryFn: async () => {
            const response = await fetch("/monitor/queues");
            return response.json();
        },
    });

    const { data: jobs, refetch: refetchJobs } = useSuspenseQuery(statusQueryOptions);

    return (
        <PageWrapper sx={{ gap: "1rem", display: "flex", flexDirection: "column" }}>
            <Typography variant="h4">Debugging Jobs</Typography>
            <Typography variant="body1">
                This page is for debugging the redis jobs that are currently running or
                queued. Was create to check if our live updates with sockets are
                propagating and invalidate the correct queries.
            </Typography>
            <Button
                onClick={() => {
                    refetchQueues();
                    refetchJobs();
                }}
                variant="contained"
                sx={{ width: "fit-content" }}
            >
                Reload
            </Button>

            <JSONPretty {...queues} />
            <JSONPretty {...jobs} />
        </PageWrapper>
    );
}
