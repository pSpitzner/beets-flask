import { ImportIcon, TagIcon } from "lucide-react";
import { useState } from "react";
import { Box, SpeedDial, SpeedDialAction, SpeedDialIcon, useTheme, Zoom } from "@mui/material";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import {
    FolderActions,
    FolderComponent,
    FoldersSelectionProvider,
    SelectedStats,
    useFoldersContext,
} from "@/components/inbox2/comps";
import { Folder } from "@/pythonTypes";

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
        await context.queryClient.ensureQueryData(inboxQueryOptions());
    },
});

function RouteComponent() {
    const { data } = useSuspenseQuery(inboxQueryOptions());

    return (
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

                    <Box sx={{ display: "flex", width: "100%", flexDirection: "column" }}>
                        {data.map((folder, i) => (
                            <FolderComponent key={i} folder={folder} />
                        ))}
                    </Box>
                    <Box sx={{ flexGrow: "grow" }}>
                        <FolderActions />
                    </Box>
                </Box>
            </FoldersSelectionProvider>
        </Box>
    );
}

/** The is a history example.
 *
 * Zoom is an interesting mui component
 *
 */
function TestFab() {
    const [open, setOpen] = useState(false);
    const handleOpen = () => setOpen(true);
    const handleClose = () => setOpen(false);
    const { nSelected } = useFoldersContext();
    const theme = useTheme();

    const transitionDuration = {
        enter: theme.transitions.duration.enteringScreen,
        exit: theme.transitions.duration.leavingScreen,
    };

    return (
        <Box sx={{ flexGrow: 1 }}>
            <Zoom
                in={nSelected > 0}
                timeout={transitionDuration.enter}
                style={{
                    transitionDelay: `${nSelected > 0 ? transitionDuration.exit : 0}ms`,
                    transformOrigin: "bottom right",
                }}
                unmountOnExit
            >
                <SpeedDial
                    color="primary"
                    icon={<SpeedDialIcon />}
                    onClose={handleClose}
                    onOpen={handleOpen}
                    open={open}
                    ariaLabel="Actions"
                >
                    <SpeedDialAction
                        icon={<ImportIcon />}
                        onClick={handleClose}
                        slotProps={{
                            tooltip: {
                                open: true,
                                title: "Import",
                            },
                            staticTooltipLabel: {
                                sx: {
                                    right: "3.5rem",
                                },
                            },
                        }}
                    />
                    <SpeedDialAction
                        key={"foo"}
                        icon={<TagIcon />}
                        onClick={handleClose}
                        slotProps={{
                            tooltip: {
                                open: true,
                                title: "Retag",
                            },
                            staticTooltipLabel: {
                                sx: {
                                    right: "3.5rem",
                                },
                            },
                        }}
                    />
                </SpeedDial>
            </Zoom>
        </Box>
    );
}
