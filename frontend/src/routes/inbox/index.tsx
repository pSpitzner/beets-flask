import { InfoIcon } from "lucide-react";
import { useState } from "react";
import {
    Box,
    BoxProps,
    DialogContent,
    IconButton,
    Typography,
    useTheme,
} from "@mui/material";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { inboxQueryOptions } from "@/api/inbox";
import { Dialog } from "@/components/common/dialogs";
import { FolderActionsSpeedDial } from "@/components/inbox/actions";
import {
    FolderComponent,
    GridWrapper,
    SelectedStats,
} from "@/components/inbox/fileTree";
import { FolderSelectionProvider } from "@/components/inbox/folderSelectionContext";

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
                    alignItems: "center",
                    [theme.breakpoints.up("laptop")]: {
                        height: "auto",
                    },
                })}
            >
                <Box
                    sx={(theme) => ({
                        width: "100%",
                        maxWidth: "100%",
                        // Wrapper for dynamic page width
                        [theme.breakpoints.up("laptop")]: {
                            height: "auto",
                            minWidth: theme.breakpoints.values["laptop"],
                            width: "calc(100% - " + theme.spacing(2) + " * 2)",
                            maxWidth: theme.breakpoints.values["desktop"],
                            // Styles for desktop
                            marginInline: theme.spacing(2),
                            marginTop: theme.spacing(2),
                            marginBottom: theme.spacing(1),
                        },
                    })}
                >
                    <InboxRouteHeader />
                    <FolderSelectionProvider>
                        <Box
                            sx={(theme) => {
                                return {
                                    display: "flex",
                                    flexDirection: "column",
                                    alignItems: "flex-end",
                                    height: "100%",
                                    position: "relative",
                                    paddingBlock: theme.spacing(1),
                                    paddingInline: theme.spacing(1.5),
                                    backgroundColor: theme.palette.background.paper,
                                    gap: theme.spacing(1),
                                    [theme.breakpoints.up("laptop")]: {
                                        height: "auto",
                                        borderRadius: 1,
                                    },
                                };
                            }}
                        >
                            <SelectedStats />
                            {data.map((folder, i) => (
                                <GridWrapper>
                                    <FolderComponent
                                        key={i}
                                        folder={folder}
                                        unSelectable
                                    />
                                </GridWrapper>
                            ))}
                        </Box>
                        <Box
                            sx={(theme) => ({
                                maxWidth: theme.breakpoints.values["desktop"],
                                width: "100%",
                                display: "flex",
                                position: "absolute",
                                bottom: theme.spacing(2),
                                right: theme.spacing(2),
                                justifyContent: "flex-end",
                                [theme.breakpoints.up("laptop")]: {
                                    justifyContent: "flex-start",
                                    position: "relative",
                                    bottom: "inherit",
                                    right: "inherit",
                                },
                            })}
                        >
                            <FolderActionsSpeedDial />
                        </Box>
                    </FolderSelectionProvider>
                </Box>
            </Box>
        </>
    );
}

/** A simple route header showing
 * a title and some
 * additional information.
 */
function InboxRouteHeader({ ...props }: BoxProps) {
    return (
        <Box
            sx={{
                display: "flex",
                justifyContent: "space-between",
                width: "100%",
                paddingInline: 1,
                alignItems: "center",
            }}
            {...props}
        >
            <Typography variant="h4" component="h1" fontWeight="bold">
                Inbox
            </Typography>
            <InfoDescription />
        </Box>
    );
}

/** Description of the inbox page, shown as modal on click */
function InfoDescription() {
    const theme = useTheme();
    const [open, setOpen] = useState(false);

    const handleClose = () => {
        setOpen(false);
    };

    return (
        <>
            <IconButton
                sx={(theme) => ({
                    m: 0,
                    p: 0,
                    color: "gray",
                })}
                size="small"
                onClick={() => {
                    setOpen(true);
                }}
            >
                <InfoIcon />
            </IconButton>
            <Dialog
                open={open}
                onClose={handleClose}
                title="Info"
                title_icon={<InfoIcon size={theme.iconSize.lg} />}
            >
                {/*TODO*/}
                <DialogContent>
                    This is your temporary holding area for new music files before
                    they're officially imported into your library. Drop your audio files
                    into the <code>XXX</code> folder to begin processing with Beets.
                </DialogContent>
            </Dialog>
        </>
    );
}
