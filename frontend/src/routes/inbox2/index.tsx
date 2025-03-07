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
import { Folder, SerializedCandidateState } from "@/pythonTypes";
import { queryClient } from "@/components/common/_query";

/* ----------------------------- Data inbox tree ---------------------------- */
// Tree of inbox folders

export const inboxQueryOptions = () => ({
    queryKey: ["inbox2"],
    queryFn: async () => {
        const response = await fetch(`/inbox2/tree`);
        console.log("inbox2 tree response", response);
        return (await response.json()) as Folder[];
    },
});

/** Reset cache of the tree
 * needed for manual refresh.
 */
queryClient.setMutationDefaults(["refreshInbox2Tree"], {
    mutationFn: async () => {
        await fetch(`/inbox2/tree/refresh`, { method: "POST" });
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

/* ----------------------------- Data candidates ---------------------------- */
// TODO: These routes do not exist yet in the backend

export const candidateQueryOptions = (folder: Folder) => ({
    // In the frontend we store the candidates by
    queryKey: ["candidates", { hash: folder.hash, path: folder.full_path }],
    queryFn: async () => {
        const response = await fetch(
            `/candidates/all?folder_hash=${folder.hash}&folder_path=${folder.full_path}`
        );
        return (await response.json()) as SerializedCandidateState[];
    },
});

/** Refetch the candidates for a given folder.
 */
queryClient.setMutationDefaults(["refreshCandidates"], {
    mutationFn: async (folder: Folder) => {
        return await fetch(`/candidates/refresh`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                folder_hash: folder.hash,
                folder_path: folder.full_path,
            }),
        });
    },
    onSuccess: async (_res, folder) => {
        const q = candidateQueryOptions(folder);

        // At least 0.5 second delay for loading indicator
        const ps = [
            queryClient.cancelQueries(q).then(() => queryClient.invalidateQueries(q)),
            new Promise((resolve) => setTimeout(resolve, 500)),
        ];
        await Promise.all(ps);
    },
});

/* ---------------------------------- Route --------------------------------- */

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
