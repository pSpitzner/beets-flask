import { Box } from "@mui/material";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { queryClient } from "@/components/common/_query";
import { FolderActionsSpeedDial } from "@/components/inbox/actions";
import {
    FolderComponent,
    GridWrapper,
    SelectedStats,
} from "@/components/inbox/fileTree";
import { FolderSelectionProvider } from "@/components/inbox/folderSelectionContext";
import { Folder } from "@/pythonTypes";

/* ----------------------------- Data inbox tree ---------------------------- */
// Tree of inbox folders

export const inboxQueryOptions = () => ({
    queryKey: ["inbox"],
    queryFn: async () => {
        const response = await fetch(`/inbox/tree`);
        console.log("inbox tree response", response);
        return (await response.json()) as Folder[];
    },
});

/** Reset cache of the tree
 * needed for manual refresh.
 */
queryClient.setMutationDefaults(["refreshInboxTree"], {
    mutationFn: async () => {
        await fetch(`/inbox/tree/refresh`, { method: "POST" });
    },
    onSuccess: async () => {
        // Invalidate the query after the cache has been reset
        const q = inboxQueryOptions();

        // At least 0.5 second delay for loading indicator
        const ps = [
            queryClient.cancelQueries(q).then(() => queryClient.invalidateQueries(q)),
            new Promise((resolve) => setTimeout(resolve, 500)),
        ];
        await Promise.all(ps);
    },
});

/* ---------------------------------- Route --------------------------------- */

export const Route = createFileRoute("/inbox/")({
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
                sx={(theme) => ({
                    display: "flex",
                    flexDirection: "column",
                    height: "100%",
                    width: "100%",
                    alignItems: "center",
                    [theme.breakpoints.up("laptop")]: {
                        height: "auto",
                    },
                })}
            >
                <FolderSelectionProvider>
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
                                    height: "auto",
                                    borderRadius: 1,
                                },
                            };
                        }}
                    >
                        <SelectedStats />
                        {data.map((folder, i) => (
                            <GridWrapper>
                                <FolderComponent key={i} folder={folder} unSelectable />
                            </GridWrapper>
                        ))}
                        <Box
                            sx={(theme) => ({
                                width: "100%",
                                display: "flex",
                                position: "absolute",
                                bottom: theme.spacing(2),
                                justifyContent: "flex-end",
                                [theme.breakpoints.up("laptop")]: {
                                    justifyContent: "flex-start",
                                    position: "relative",
                                    bottom: "inherit",
                                },
                            })}
                        >
                            <FolderActionsSpeedDial />
                        </Box>
                    </Box>
                </FolderSelectionProvider>
            </Box>
        </>
    );
}
