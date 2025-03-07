import { Box } from "@mui/material";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import {
    FolderActions,
    FolderComponent,
    FoldersSelectionProvider,
    GridWrapper,
    SelectedStats,
} from "@/components/inbox2/comps";
import { Folder } from "@/pythonTypes";
import { queryClient } from "@/components/common/_query";

/** Get inbox folder tree
 */
export const inboxQueryOptions = () => ({
    queryKey: ["inbox2"],
    queryFn: async () => {
        const response = await fetch(`/inbox2/tree`);
        return (await response.json()) as Folder[];
    },
});

/** Define mutation to reset cache of the tree
 * needed for manual refresh
 */
queryClient.setMutationDefaults(["refreshInbox2Tree"], {
    mutationFn: async () => {
        await fetch(`/inbox2/cache`, { method: "DELETE" });
    },
    onMutate: async () => {
        const q = inboxQueryOptions();

        // At least 0.5 second delay for loading indicator
        const ps = [
            queryClient.cancelQueries(q).then(() => queryClient.invalidateQueries(q)),
            new Promise((resolve) => setTimeout(resolve, 500)),
        ];
        await Promise.all(ps);
    },
});

export const Route = createFileRoute("/inbox2/")({
    component: RouteComponent,
    loader: async ({ context }) => {
        await context.queryClient.ensureQueryData(inboxQueryOptions());
    },
});

function RouteComponent() {
    const { data } = useSuspenseQuery(inboxQueryOptions());

    return (
        <>
            <Box
                sx={{
                    display: "flex",
                    flexDirection: "column",
                    height: "100%",
                    width: "100%",
                    alignItems: "center",
                }}
            >
                <FoldersSelectionProvider>
                    <Box
                        sx={(theme) => {
                            return {
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "flex-end",
                                width: "100%",
                                height: "100%",
                                maxWidth: "100%",
                                position: "relative",
                                paddingBlock: theme.spacing(1),
                                paddingInline: theme.spacing(2),
                                backgroundColor: theme.palette.background.paper,
                                gap: theme.spacing(1),
                                [theme.breakpoints.up("laptop")]: {
                                    // Styles for desktop
                                    margin: theme.spacing(2),
                                    minWidth: theme.breakpoints.values["laptop"],
                                    width: "calc(100% - " + theme.spacing(2) + " * 2)",
                                    maxWidth: theme.breakpoints.values["desktop"],
                                    height: "unset",
                                },
                            };
                        }}
                    >
                        <SelectedStats />

                        <GridWrapper>
                            {data.map((folder, i) => (
                                <FolderComponent key={i} folder={folder} unSelectable />
                            ))}
                        </GridWrapper>
                        <Box sx={{ flexGrow: "grow" }}>
                            <FolderActions />
                        </Box>
                    </Box>
                </FoldersSelectionProvider>
            </Box>
        </>
    );
}
