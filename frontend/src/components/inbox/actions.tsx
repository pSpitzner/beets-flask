import {
    ClipboardIcon,
    EllipsisVerticalIcon,
    HistoryIcon,
    ImportIcon,
    RefreshCwIcon,
    TagIcon,
    TerminalIcon,
    Trash2Icon,
} from "lucide-react";
import { forwardRef, Ref, useEffect, useRef, useState } from "react";
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
import { useNavigate } from "@tanstack/react-router";

import { enqueueMutationOptions } from "@/api/session";
import { EnqueueKind, File, Folder } from "@/pythonTypes";

import { useFolderSelectionContext } from "./folderSelectionContext";

import { SourceTypeIcon } from "../common/icons";
import { ClipboardCopyButton } from "../common/inputs/copy";
import { useTerminalContext } from "../frontpage/terminal";

/* --------------------------------- Actions -------------------------------- */
// Actions a user can take on a single or multiple folders implemented as speed dial

export function FolderActionsSpeedDial() {
    const isDesktop = useMediaQuery((theme) => theme.breakpoints.up("laptop"));
    const [open, setOpen] = useState(false);
    const { nSelected, selected } = useFolderSelectionContext();
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
                <SpeedDialMutationAction
                    icon={<TagIcon />}
                    tooltip="Retag"
                    mutationOptions={enqueueMutationOptions}
                    mutateArgs={{ selected, kind: EnqueueKind.PREVIEW }}
                />

                <Spacer />

                <SpeedDialMutationAction
                    icon={<ImportIcon />}
                    tooltip="Import"
                    // imports best candidate that is already present, independent of threshold
                    // or retag & import, ignoring any configured thresholds
                    mutationOptions={enqueueMutationOptions}
                    mutateArgs={{ selected, kind: EnqueueKind.IMPORT_CANDIDATE }}
                />

                <SpeedDialMutationAction
                    icon={<SourceTypeIcon type="asis" />}
                    tooltip="Import (asis)"
                    mutationOptions={enqueueMutationOptions}
                    mutateArgs={{ selected, kind: EnqueueKind.IMPORT_BOOTLEG }}
                />

                <TerminalImportAction />

                <Spacer />

                <SpeedDialMutationAction
                    icon={<ClipboardIcon />}
                    tooltip="Copy path"
                    mutationOptions={enqueueMutationOptions}
                    mutateArgs={{}}
                />

                <SpeedDialMutationAction
                    icon={<Trash2Icon />}
                    tooltip="Delete folder"
                    mutationOptions={enqueueMutationOptions}
                    mutateArgs={{}}
                />

                <SpeedDialMutationAction
                    icon={<HistoryIcon />}
                    tooltip="Undo Import"
                    mutationOptions={enqueueMutationOptions}
                    mutateArgs={{}}
                />
            </SpeedDial>
        </Zoom>
    );
}

function Spacer() {
    const isDesktop = useMediaQuery((theme) => theme.breakpoints.up("laptop"));
    return isDesktop ? (
        <Box
            sx={{
                width: "1em",
                height: "1rem",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                border: "none !important",
            }}
        />
    ) : null;
}

export function RefreshAllFoldersButton() {
    // See inbox2 route
    const { mutate, isPending } = useMutation({
        mutationKey: ["refreshInboxTree"],
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

function SpeedDialMutationAction<T>({
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
        <SpeedDialAction
            icon={icon}
            onClick={() => {
                mutate(mutateArgs);
            }}
            tooltip={tooltip}
            {...props}
        />
    );
}

function SpeedDialAction({
    icon,
    tooltip,
    onClick,
    ...props
}: {
    icon: React.ReactNode;
    tooltip: string;
    onClick?: React.MouseEventHandler<HTMLDivElement>;
} & SpeedDialActionProps) {
    // In theory we should check for touch instead of a breakpoint but tbh
    // im too lazy to figure out how to do that properly
    const isMobile = !useMediaQuery((theme) => theme.breakpoints.up("laptop"));

    return (
        <MuiSpeedDialAction
            icon={icon}
            onClick={onClick}
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

/* ---------------------------- Specific Actions ---------------------------- */

function TerminalImportAction({ ...props }: SpeedDialActionProps) {
    const { inputText, clearInput } = useTerminalContext();
    const { selected } = useFolderSelectionContext();
    const text = useRef("");
    const navigate = useNavigate();

    useEffect(() => {
        const selectedPaths = selected.paths.map(_escapePathForBash);
        if (selectedPaths.length > 1) {
            text.current = "\\\n  " + selectedPaths.join(" \\\n  ");
        } else {
            text.current = selectedPaths.join(" ");
        }
    }, [selected, text]);

    return (
        <SpeedDialAction
            icon={<TerminalIcon />}
            tooltip="Import (cli)"
            onClick={() => {
                clearInput();
                inputText(`beet import -t ${text.current}`);
                navigate({
                    to: "/terminal",
                }).catch(console.error);
            }}
            {...props}
        />
    );
}

function _escapePathForBash(path: string) {
    // escaping path is fishy, but this seems to be the best compromise
    // https://stackoverflow.com/questions/1779858/how-do-i-escape-a-string-for-a-shell-command-in-node
    return `'${path.replace(/'/g, `'\\''`)}'`;
}

/* ------------------------------ More actions ------------------------------ */

/** MoreActions component with three dots icon
 * and a menu with actions. Allows to be opened
 * anchored to a specific element or position.
 */
export function MoreActions({
    f,
    anchor,
    setAnchor,
    ...props
}: {
    f: Folder | File;
    anchor: { top: number; left: number } | HTMLElement | null;
    setAnchor: (
        anchor:
            | {
                  top: number;
                  left: number;
              }
            | HTMLElement
            | null
    ) => void;
} & BoxProps) {
    const theme = useTheme();

    const closeMenu = () => {
        setAnchor(null);
    };

    return (
        <Box
            {...props}
            onClick={(e) => {
                // Prevents deselecting the current item when clicking on the menu
                // This is a bit of a hack, but it works
                e.preventDefault();
                e.stopPropagation();
            }}
        >
            <IconButton
                onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setAnchor(e.currentTarget);
                }}
                sx={{ padding: "0px", margin: "0px" }}
                disableRipple
            >
                <EllipsisVerticalIcon size={theme.iconSize.lg} />
            </IconButton>
            <Menu
                onClose={closeMenu}
                anchorEl={anchor instanceof Element ? anchor : null}
                open={anchor !== null}
                anchorOrigin={{
                    vertical: "bottom",
                    horizontal: "right",
                }}
                transformOrigin={{
                    vertical: "top",
                    horizontal: anchor instanceof Element ? "right" : "center",
                }}
                anchorReference={
                    anchor instanceof Element ? "anchorEl" : "anchorPosition"
                }
                anchorPosition={
                    !(anchor instanceof Element)
                        ? anchor
                            ? anchor
                            : undefined
                        : undefined
                }
            >
                <MoreActionsItems f={f} handleClose={closeMenu} />
            </Menu>
        </Box>
    );
}

function MoreActionsItems({
    f,
    handleClose,
}: {
    f: Folder | File;
    handleClose: () => void;
}) {
    return (
        <>
            <MenuItem>
                <ClipboardCopyButton
                    text={f.full_path}
                    icon_props={{
                        size: 24,
                    }}
                    sx={{
                        margin: 0,
                        display: "flex",
                        gap: "0.5rem",
                        fontSize: "1rem",
                        padding: "0",
                    }}
                    onCopied={() => {
                        setTimeout(() => {
                            handleClose();
                        }, 500);
                    }}
                >
                    Copy Path
                </ClipboardCopyButton>
            </MenuItem>
        </>
    );
}
