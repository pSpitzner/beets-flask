import { Box, Button, Typography } from "@mui/material";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { jobsQueryOptions, queuesQueryOptions } from "@/api/monitor";
import { JSONPretty } from "@/components/common/debugging/json";
import { PageWrapper } from "@/components/common/page";

export const Route = createFileRoute("/debug/jobs")({
    component: RouteComponent,
});

function RouteComponent() {
    const { data: queues, refetch: refetchQueues } =
        useSuspenseQuery(queuesQueryOptions);

    const { data: jobs, refetch: refetchJobs } = useSuspenseQuery(jobsQueryOptions);

    return (
        <PageWrapper sx={{ gap: "1rem", display: "flex", flexDirection: "column" }}>
            <Typography variant="h4">Debugging Jobs</Typography>
            <Typography variant="body1">
                This page is for debugging the redis jobs that are currently running or
                queued. Was create to check if our live updates with sockets are
                propagating and invalidate the correct queries.
            </Typography>
            <Button
                onClick={async () => {
                    await Promise.all([refetchQueues(), refetchJobs()]);
                }}
                variant="contained"
                sx={{ width: "fit-content" }}
            >
                Reload
            </Button>
            <Typography variant="h5">Queues</Typography>
            <JSONPretty {...queues} />
            <Typography variant="h5">Jobs</Typography>
            {jobs?.map((job) => (
                <Box sx={{ display: "flex", flexDirection: "row", gap: "1rem" }}>
                    <JSONPretty {...job} />
                </Box>
            ))}
            {jobs.length === 0 && (
                <Typography variant="body1">No running/queued jobs found</Typography>
            )}
        </PageWrapper>
    );
}
