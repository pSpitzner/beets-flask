import {
    EllipsisVerticalIcon,
    ImportIcon,
    RefreshCwIcon,
    TagIcon,
    Trash2Icon,
} from "lucide-react";
import { forwardRef, MouseEvent, Ref, useState } from "react";
import {
    Box,
    BoxProps,
    IconButton,
    Menu,
    MenuItem,
    SpeedDial as MuiSpeedDial,
    SpeedDialAction as MuiSpeedDialAction,
    SpeedDialActionProps,
    SpeedDialIcon,
    SpeedDialProps,
    Tooltip,
    useMediaQuery,
    useTheme,
    Zoom,
} from "@mui/material";
import { useMutation, UseMutationOptions } from "@tanstack/react-query";

import { EnqueueKind, File, Folder } from "@/pythonTypes";

import {
    FolderSelectionContext,
    useFolderSelectionContext,
} from "./folderSelectionContext";

import { SourceTypeIcon } from "../common/icons";
import { ClipboardCopyButton } from "../common/inputs/copy";

/* -------------------------------- Mutations ------------------------------- */

const enqueueMutationOptions = {
    mutationFn: async ({
        selected,
        kind,
    }: {
        selected: FolderSelectionContext["selected"];
        kind: EnqueueKind;
    }) => {
        return await fetch("/session/enqueue", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                kind: kind.toString(),
                folder_hashes: selected.hashes,
                folder_paths: selected.paths,
            }),
        });
    },
};

/* --------------------------------- Actions -------------------------------- */
// Actions a user can take on a single or multiple folders implemented as speed dial

export function FolderActionsSpeedDial() {
    const isDesktop = useMediaQuery((theme) => theme.breakpoints.up("laptop"));
    const [open, setOpen] = useState(false);
    const { nSelected, selected, deselectAll } = useFolderSelectionContext();
    const theme = useTheme();

    // Show speed dial only once something is selected
    // This is done via zoom component
    const transitionDuration = {
        enter: theme.transitions.duration.enteringScreen,
        exit: theme.transitions.duration.leavingScreen,
    };

    return (
        <Zoom
            in={nSelected > 0}
            timeout={transitionDuration.enter}
            style={{
                transitionDelay: `${nSelected > 0 ? transitionDuration.exit : 0}ms`,
                // FIXME: Transform origin should be centered on button not bottom right
                // not sure if this is easily doable tho
                transformOrigin: isDesktop ? "left" : "bottom right",
            }}
            unmountOnExit
        >
            <SpeedDial
                ariaLabel="FolderAction"
                open={open || isDesktop}
                onOpen={() => setOpen(true)}
                onClose={() => setOpen(false)}
                sx={
                    isDesktop
                        ? (theme) => ({
                              ".MuiSpeedDial-actions": {
                                  display: "flex",
                                  flexDirection: "row",
                                  ">*": {
                                      border: `1px solid ${theme.palette.divider}`,
                                  },
                              },
                              ".MuiSpeedDial-fab": {
                                  display: "none",
                              },
                          })
                        : undefined
                }
            >
                <SpeedDialAction
                    icon={<TagIcon />}
                    tooltip="Retag"
                    mutationOptions={enqueueMutationOptions}
                    mutateArgs={{ selected, kind: EnqueueKind.PREVIEW }}
                />

                <SpeedDialAction
                    icon={<ImportIcon />}
                    tooltip="Import"
                    // imports best candidate that is already present, independent of threshold
                    // or retag & import, ignoring any configured thresholds
                    mutationOptions={enqueueMutationOptions}
                    mutateArgs={{ selected, kind: EnqueueKind.AUTO }}
                />

                <SpeedDialAction
                    icon={<SourceTypeIcon type={"asis"} />}
                    tooltip="Import (asis)"
                    mutationOptions={enqueueMutationOptions}
                    mutateArgs={{ selected, kind: EnqueueKind.IMPORT_AS_IS }}
                />
            </SpeedDial>
        </Zoom>
    );
}

export function RefreshAllFoldersButton() {
    // See inbox2 route
    const { mutate, isPending } = useMutation({
        mutationKey: ["refreshInbox2Tree"],
    });
    const theme = useTheme();

    return (
        <Tooltip title="Refresh folders">
            <IconButton
                onClick={() => mutate()}
                sx={{
                    animation: isPending ? "spin 1s linear infinite" : "none",
                    "@keyframes spin": {
                        from: { transform: "rotate(0deg)" },
                        to: { transform: "rotate(360deg)" },
                    },
                }}
                disabled={isPending}
            >
                <RefreshCwIcon size={theme.iconSize.lg} />
            </IconButton>
        </Tooltip>
    );
}

export function DeleteAllImportedFolderButton() {
    const theme = useTheme();

    return (
        <Tooltip title="Delete all imported albums">
            <IconButton>
                <Trash2Icon size={theme.iconSize.lg} />
            </IconButton>
        </Tooltip>
    );
}

/* --------------------------- Speed dial generics -------------------------- */
// We might want to move this into common namespace

const SpeedDial = forwardRef(function SpeedDial(
    props: SpeedDialProps,
    ref: Ref<HTMLDivElement>
) {
    // speed dial opens left on big screens
    const isLaptopUp = useMediaQuery((theme) => theme.breakpoints.up("laptop"));

    return (
        <MuiSpeedDial
            color="primary"
            icon={<SpeedDialIcon />}
            direction={isLaptopUp ? "left" : undefined}
            sx={(theme) => {
                return {
                    position: "absolute",
                    bottom: theme.spacing(1),
                    right: theme.spacing(1),
                    [theme.breakpoints.up("laptop")]: {
                        position: "relative",
                        display: "flex",
                        bottom: "0",
                        right: "0",
                    },
                };
            }}
            ref={ref}
            {...props}
        />
    );
});

function SpeedDialAction<T>({
    icon,
    tooltip,
    mutateArgs,
    mutationOptions,
    ...props
}: {
    icon: React.ReactNode;
    tooltip: string;
    mutationOptions: UseMutationOptions<unknown, Error, T>;
    mutateArgs: T;
} & SpeedDialActionProps) {
    // In theory we should check for touch instead of a breakpoint but tbh
    // im too lazy to figure out how to do that properly
    const isMobile = !useMediaQuery((theme) => theme.breakpoints.up("laptop"));

    const { isSuccess, isPending, mutate, isError, error, reset } =
        useMutation(mutationOptions);

    return (
        <MuiSpeedDialAction
            icon={icon}
            onClick={() => {
                mutate(mutateArgs);
            }}
            slotProps={{
                tooltip: {
                    // show tooltips always on mobile devices
                    open: isMobile ?? undefined,
                    title: tooltip,
                },
                staticTooltipLabel: {
                    sx: (theme) => ({
                        right: "3.5rem",
                        whiteSpace: "nowrap",
                        [theme.breakpoints.up("laptop")]: {
                            bottom: "1.5rem",
                            right: "0",
                            display: "flex",
                        },
                    }),
                },
            }}
            {...props}
        />
    );
}

/** Simple context menu with some items
 *
 * TODO: Rethink
 */
export function MoreActions({ f, ...props }: { f: Folder | File } & BoxProps) {
    const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
    const theme = useTheme();

    return (
        <Box {...props}>
            <IconButton
                onClick={(e) => {
                    setAnchorEl(e.currentTarget);
                }}
                sx={{ padding: "0px", margin: "0px" }}
                disableRipple
            >
                <EllipsisVerticalIcon size={theme.iconSize.lg} />
            </IconButton>
            <Menu
                onClose={() => setAnchorEl(null)}
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
            >
                <MenuItem
                    onClick={() => {
                        // copy full path to clipboard
                        navigator.clipboard.writeText(f.full_path).catch(console.error);
                        setAnchorEl(null);
                    }}
                >
                    <ClipboardCopyButton
                        text={f.full_path}
                        icon_props={{
                            size: theme.iconSize.lg,
                        }}
                        sx={{
                            margin: 0,
                            display: "flex",
                            gap: "0.5rem",
                            fontSize: "1rem",
                            padding: "0",
                        }}
                    >
                        Copy Path
                    </ClipboardCopyButton>
                </MenuItem>
            </Menu>
        </Box>
    );
}
