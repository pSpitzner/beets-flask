import {
    ClipboardIcon,
    FolderClockIcon,
    HistoryIcon,
    ImportIcon,
    InfoIcon,
    TagIcon,
    TerminalIcon,
    Trash2Icon,
} from "lucide-react";
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
import { MatchChip, StyledChip } from "@/components/common/chips";
import { Dialog } from "@/components/common/dialogs";
import {
    FileTypeIcon,
    FolderStatusIcon,
    FolderTypeIcon,
    PenaltyTypeIcon,
    SourceTypeIcon,
} from "@/components/common/icons";
import { PageWrapper } from "@/components/common/page";
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
        return await context.queryClient.ensureQueryData(inboxQueryOptions());
    },
});

function RouteComponent() {
    const { data } = useSuspenseQuery(inboxQueryOptions());

    return (
        <>
            <PageWrapper
                sx={(theme) => ({
                    display: "flex",
                    flexDirection: "column",
                    height: "100%",
                    alignItems: "center",
                    paddingTop: theme.spacing(1),
                    paddingInline: theme.spacing(0.5),
                    [theme.breakpoints.up("laptop")]: {
                        height: "auto",
                        paddingTop: theme.spacing(2),
                        paddingInline: theme.spacing(1),
                    },
                })}
            >
                <InboxRouteHeader />
                <FolderSelectionProvider>
                    <Box
                        sx={(theme) => ({
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "flex-end",
                            width: "100%",
                            position: "relative",
                            paddingBlock: theme.spacing(1),
                            paddingInline: theme.spacing(1.5),
                            backgroundColor: theme.palette.background.paper,
                            gap: theme.spacing(1),
                            borderRadius: 1,
                            [theme.breakpoints.up("laptop")]: {
                                height: "auto",
                            },
                        })}
                    >
                        <SelectedStats />
                        {data.map((folder, i) => (
                            <GridWrapper key={i}>
                                <FolderComponent key={i} folder={folder} unSelectable />
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
            </PageWrapper>
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
                alignItems: "center",
                flexGrow: 1,
                paddingInline: 1,
            }}
            {...props}
        >
            <Typography
                variant="h4"
                component="h1"
                fontWeight="bold"
                sx={(theme) => ({
                    alignSelf: "center",
                    mr: "auto",
                })}
            >
                Inbox
            </Typography>
            <Box
                sx={{
                    alignSelf: "center",
                    display: "flex",
                    gap: 1,
                    zIndex: 1,
                    p: 0.25,
                    borderRadius: 1,
                    color: "primary.muted",
                }}
            >
                <InfoDescription />
            </Box>
        </Box>
    );
}

/** Description of the inbox page, shown as modal on click */
function InfoDescription() {
    const theme = useTheme();
    const [open, setOpen] = useState(false);
    const data = Route.useLoaderData();

    const handleClose = () => {
        setOpen(false);
    };

    return (
        <>
            <IconButton
                sx={{
                    m: 0,
                    p: 0,
                    color: "inherit",
                }}
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
                title="Information"
                title_icon={<InfoIcon size={theme.iconSize.lg} />}
            >
                <DialogContent
                    sx={{
                        code: {
                            backgroundColor: theme.palette.background.default,
                            paddingInline: 0.5,
                            paddingBlock: 0.25,
                            borderRadius: 1,
                            fontFamily: "monospace",
                        },
                        "> p": {
                            marginTop: "0 !important",
                        },
                    }}
                >
                    <Box component="p">
                        The <b>Inbox</b> is your temporary holding area for new music
                        files before they're imported into your library. Drop an album
                        folder into{" "}
                        <Box component="code" whiteSpace="nowrap">
                            {data[0].full_path}
                        </Box>
                        to begin with the tagging and importing process.
                    </Box>
                    <Box component="p">
                        By default new inbox items are automatically tagged after a
                        short delay (configurable in the settings yaml). You can also
                        trigger the tagging manually by using the{" "}
                        <TagIcon size={theme.iconSize.sm - 2} strokeWidth={3.5} />{" "}
                        <b
                            style={{
                                whiteSpace: "nowrap",
                                display: "inline-flex",
                                gap: 0.5,
                            }}
                        >
                            Retag
                        </b>{" "}
                        action.
                    </Box>
                    {/* Actions */}
                    <Typography sx={{ fontWeight: "bold", marginBottom: 0.5 }}>
                        Actions
                    </Typography>
                    <Box component="p">
                        You may trigger an action on one or multiple folders by right
                        clicking on the folder or long pressing on mobile. You can also
                        select multiple folders and trigger an action on all of the
                        selected folders at once using the speed dial at the bottom left
                        (right on mobile).
                    </Box>
                    <Box
                        sx={{
                            display: "grid",
                            columnGap: 1,
                            gridTemplateColumns: "min-content max-content auto",
                            "> div": {
                                display: "grid",
                                gridTemplateColumns: "subgrid",
                                gridColumn: "span 3",
                                alignItems: "center",
                            },
                            pl: 1,
                        }}
                        component="p"
                    >
                        <Box>
                            <TagIcon size={theme.iconSize.md} />
                            <Typography>Retag</Typography>
                            <Typography variant="caption">(description)</Typography>
                        </Box>
                        <Box sx={{ mt: 0.75 }}>
                            <ImportIcon size={theme.iconSize.md} />
                            <Typography>Import</Typography>
                            <Typography variant="caption">(description)</Typography>
                        </Box>
                        <Box>
                            <SourceTypeIcon size={theme.iconSize.md} type="asis" />
                            <Typography>Import (asis)</Typography>
                            <Typography variant="caption">(description)</Typography>
                        </Box>
                        <Box>
                            <TerminalIcon size={theme.iconSize.md} />
                            <Typography>Import (via terminal)</Typography>
                            <Typography variant="caption">(description)</Typography>
                        </Box>
                        <Box sx={{ mt: 0.75 }}>
                            <ClipboardIcon size={theme.iconSize.md} />
                            <Typography>Copy path</Typography>
                            <Typography variant="caption">(description)</Typography>
                        </Box>
                        <Box>
                            <Trash2Icon size={theme.iconSize.md} />
                            <Typography>Delete folder</Typography>
                            <Typography variant="caption">(description)</Typography>
                        </Box>
                        <Box>
                            <HistoryIcon size={theme.iconSize.md} />
                            <Typography>Undo import</Typography>
                            <Typography variant="caption">(description)</Typography>
                        </Box>
                    </Box>
                    {/* Tree view */}
                    <Typography sx={{ fontWeight: "bold", marginBottom: 0.5 }}>
                        Tree view
                    </Typography>
                    <Box component="p">
                        The tree view shows the folder structure of your inbox. This is
                        very similar to a typical file explorer. You max expand and
                        collapse folders by clicking on the chevron icon.
                    </Box>
                    <Box sx={{ pl: 1 }} component="p">
                        <Box
                            sx={{
                                display: "flex",
                                gap: 1,
                                alignItems: "center",
                            }}
                        >
                            <FolderTypeIcon
                                isAlbum={false}
                                isOpen={false}
                                size={theme.iconSize.lg}
                            />
                            <FolderTypeIcon
                                isAlbum={false}
                                isOpen={true}
                                size={theme.iconSize.lg}
                            />
                            <Typography>Folders in your inbox</Typography>
                        </Box>
                        <Box
                            sx={{
                                display: "flex",
                                gap: 1,
                                alignItems: "center",
                            }}
                        >
                            <FolderTypeIcon
                                isAlbum={true}
                                isOpen={false}
                                size={theme.iconSize.lg}
                            />
                            <FolderTypeIcon
                                isAlbum={true}
                                isOpen={true}
                                size={theme.iconSize.lg}
                            />
                            <Typography>
                                Music album (identified as such by beets)
                            </Typography>
                        </Box>
                        <Box
                            sx={{
                                display: "flex",
                                gap: 1,
                                alignItems: "center",
                            }}
                        >
                            <FileTypeIcon type={"mp3"} size={theme.iconSize.lg} />
                            <FileTypeIcon type={"txt"} size={theme.iconSize.lg} />
                            <Typography>
                                Any file (icons varies by file extension)
                            </Typography>
                        </Box>
                    </Box>
                    {/* Chips */}
                    <Typography sx={{ fontWeight: "bold", marginBottom: 0.5 }}>
                        Chips
                    </Typography>
                    <Box component="p">
                        Once a folder is tagged or imported{" "}
                        <StyledChip
                            label="chips"
                            size="small"
                            sx={{ width: "min-content", display: "inline-flex" }}
                            variant="outlined"
                        />{" "}
                        will be shown in the row of the folder. These chips indicate the
                        status of the folder and gives additional information about the
                        best tag candidate.
                    </Box>
                    <Box
                        component="p"
                        sx={{
                            display: "grid",
                            columnGap: 1,
                            rowGap: 0.5,
                            gridTemplateColumns: "min-content auto",
                            alignItems: "center",
                            pl: 1,
                        }}
                    >
                        <StyledChip
                            icon={
                                <PenaltyTypeIcon
                                    type="duplicate"
                                    size={theme.iconSize.sm}
                                />
                            }
                            label="Duplicate"
                            size="small"
                            color="error"
                            variant="outlined"
                        />
                        <Typography variant="caption">
                            This album is already in your beets library! Click on the
                            chip to jump to the item in your library.
                        </Typography>
                        <StyledChip
                            icon={
                                <FolderStatusIcon status={1} size={theme.iconSize.sm} />
                            }
                            label="status"
                            size="small"
                            variant="outlined"
                            color="info"
                        />
                        <Typography variant="caption">
                            The current status of a the most recent action on this
                            folder. This may indicate the live status if an action is
                            currently running.
                        </Typography>
                        <MatchChip source="mb" distance={0.01} />
                        <Typography variant="caption">
                            Shows the quality and metadata source of the best matching
                            tag candidate. For beets veterans, you may think of this as
                            the data source and penalty.
                        </Typography>
                        <StyledChip
                            icon={<FolderClockIcon size={theme.iconSize.sm} />}
                            label="Integrity"
                            size="small"
                            variant="outlined"
                            color="warning"
                        />
                        <Typography variant="caption">
                            The integrity check of the folder failed. This may be due to
                            changes to a folder after it was tagged or imported.
                        </Typography>
                    </Box>
                </DialogContent>
            </Dialog>
        </>
    );
}
