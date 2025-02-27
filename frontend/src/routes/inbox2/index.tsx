import {
    FolderComponent,
    FoldersSelectionProvider,
    SelectedStats,
} from "@/components/inbox2/comps";
import { Folder } from "@/pythonTypes";
import { Box } from "@mui/material";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

const inboxQueryOptions = () => ({
    queryKey: ["inbox2"],
    queryFn: async () => {
        const response = await fetch(`/inbox2/tree`);
        return (await response.json()) as Folder[];
    },
});

export const Route = createFileRoute("/inbox2/")({
    component: RouteComponent,
    loader: async ({ context }) => {
        context.queryClient.ensureQueryData(inboxQueryOptions());
    },
});

function RouteComponent() {
    const { data } = useSuspenseQuery(inboxQueryOptions());

    return (
        <Box sx={{ maxWidth: 800, margin: "auto" }}>
            <FoldersSelectionProvider>
                <SelectedStats />
                {data.map((folder, i) => (
                    <FolderComponent key={i} folder={folder} />
                ))}
            </FoldersSelectionProvider>
        </Box>
    );
}
