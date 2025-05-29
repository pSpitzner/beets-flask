import { Box } from "@mui/material";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { FolderComponent } from "@/components/sessiondraft/comps";
import { Folder } from "@/pythonTypes";

const inboxQueryOptions = () => ({
    queryKey: ["inbox"],
    queryFn: async () => {
        const response = await fetch(`/inbox/tree`);
        return (await response.json()) as Folder[];
    },
});

export const Route = createFileRoute("/sessiondraft/")({
    component: RouteComponent,
    loader: async ({ context }) => {
        await context.queryClient.ensureQueryData(inboxQueryOptions());
    },
});

function RouteComponent() {
    const { data } = useSuspenseQuery(inboxQueryOptions());
    const flat = _unpack_tree(data[0]);

    return (
        <Box
            sx={{
                // margin: "auto",
                // display: "flex",
                // flexDirection: "column",
                // alignItems: "flex-end",
                overflowY: "scroll",
                height: "calc(100vh - 48px)",
                scrollSnapType: "y proximity",
            }}
        >
            {flat.map((folder, i) => (
                <FolderComponent key={i} folder={folder} />
            ))}
        </Box>
    );
}

function _unpack_tree(root: Folder) {
    const flat: Folder[] = [];

    function unpack(folder: Folder) {
        flat.push(folder);
        for (const child of Object.values(folder.children)) {
            if (child.type === "directory") {
                unpack(child);
            }
        }
    }

    unpack(root);
    return flat;
}
