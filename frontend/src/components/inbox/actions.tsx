import {
    ClipboardCheckIcon,
    ClipboardIcon,
    CloudIcon,
    ComponentIcon,
    EllipsisVerticalIcon,
    EyeIcon,
    EyeOffIcon,
    GroupIcon,
    HistoryIcon,
    ImportIcon,
    RefreshCwIcon,
    TagIcon,
    TerminalIcon,
    Trash2Icon,
    UngroupIcon,
} from "lucide-react";
import { forwardRef, Ref, useState } from "react";
import {
    Box,
    BoxProps,
    Button,
    Checkbox,
    CircularProgress,
    IconButton,
    Menu,
    MenuItem,
    SpeedDial as MuiSpeedDial,
    SpeedDialAction as MuiSpeedDialAction,
    SpeedDialActionProps,
    SpeedDialIcon,
    SpeedDialProps,
    Tooltip,
    Typography,
    useMediaQuery,
    useTheme,
    Zoom,
} from "@mui/material";
import { useMutation, UseMutationOptions } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import { deleteFoldersMutationOptions } from "@/api/inbox";
import { enqueueMutationOptions } from "@/api/session";
import { EnqueueKind, File, Folder, JobStatusUpdate } from "@/pythonTypes";

import { useFolderSelectionContext } from "./folderSelectionContext";

import { InboxTypeIcon, SourceTypeIcon } from "../common/icons";
import { ClipboardCopyButton } from "../common/inputs/copy";
import { MutationButton } from "../common/inputs/mutationButton";
import {
    SplitButtonOptionProps,
    SplitButtonOptions,
} from "../common/inputs/splitButton";
import { formatDate } from "../common/units/time";
import { useStatusSocket } from "../common/websocket/status";
import { useTerminalContext } from "../frontpage/terminal";

/* --------------------------------- Actions -------------------------------- */
// Actions a user can take on a single or multiple folders implemented as speed dial

export function FolderActionsSpeedDial() {
    const isDesktop = useMediaQuery((theme) => theme.breakpoints.up("laptop"));
    const [open, setOpen] = useState(false);
    const { nSelected, selected } = useFolderSelectionContext();
    const theme = useTheme();
    const { socket } = useStatusSocket();

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
                <Spacer />
                <RetagAction />
                <SpeedDialMutationAction
                    icon={<ImportIcon />}
                    tooltip="Import"
                    // imports best candidate that is already present, independent of threshold
                    // or retag & import, ignoring any configured thresholds
                    mutationOptions={enqueueMutationOptions}
                    mutateArgs={{
                        socket,
                        selected,
                        kind: EnqueueKind.IMPORT_CANDIDATE,
                    }}
                />

                <Spacer />

                <SpeedDialMutationAction
                    icon={<SourceTypeIcon type="asis" />}
                    tooltip="Import (bootleg)"
                    mutationOptions={enqueueMutationOptions}
                    mutateArgs={{ socket, selected, kind: EnqueueKind.IMPORT_BOOTLEG }}
                />

                <TerminalImportAction />

                <Spacer />

                <CopyPathAction />
                <DeleteFoldersAction />
                <SpeedDialMutationAction
                    icon={<HistoryIcon />}
                    tooltip="Undo Import"
                    mutationOptions={enqueueMutationOptions}
                    mutateArgs={{
                        socket,
                        selected,
                        kind: EnqueueKind.IMPORT_UNDO,
                        delete_files: true,
                    }}
                />
            </SpeedDial>
        </Zoom>
    );
}

export function ImportSplitButton(
    props: Omit<SplitButtonOptionProps, "options" | "onClick">
) {
    const theme = useTheme();

    const sx = {
        alignItems: "center",
        justifyContent: "flex-start",
    };

    return (
        <SplitButtonOptions
            color="secondary"
            options={[
                {
                    label: "Import Best",
                    key: "retag",
                    buttonProps: {
                        startIcon: <ImportIcon size={theme.iconSize.lg} />,
                        sx,
                    },
                },
                {
                    label: "Import Bootleg",
                    key: "import",
                    buttonProps: {
                        startIcon: <ImportIcon size={theme.iconSize.lg} />,
                        sx,
                    },
                },
            ]}
            onClick={console.log}
            {...props}
        />
    );
}

export function RetagSplitButton(
    props: Omit<SplitButtonOptionProps, "options" | "onClick">
) {
    const theme = useTheme();

    const sx = {
        alignItems: "center",
        justifyContent: "flex-start",
    };

    return (
        <SplitButtonOptions
            color="secondary"
            variant="outlined"
            options={[
                {
                    label: "Retag",
                    key: "retag",
                    buttonProps: {
                        startIcon: <TagIcon size={theme.iconSize.lg} />,
                        sx,
                    },
                },
                {
                    label: "Retag",
                    key: "retag_import",
                    buttonProps: {
                        startIcon: <ImportIcon size={theme.iconSize.lg} />,
                        sx,
                    },
                },
            ]}
            onClick={console.log}
            {...props}
        />
    );
}

export function FolderActionDesktopBar() {
    const theme = useTheme();
    const { socket } = useStatusSocket();
    const { selected } = useFolderSelectionContext();

    // TODO: load defaults from config
    const [setting, setSetting] = useState({
        group_albums: false,
        do_lookup: true,
    });

    const [importAsis, setImportAsIs] = useState(false);

    const enabled = selected.paths.length != 0;

    if (!enabled) {
        return null;
    }

    return (
        <Box
            sx={{
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                padding: 1,
                gap: 3,
            }}
        >
            {/* Retag */}
            <Box
                sx={{
                    display: "flex",
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 1,
                }}
            >
                <Tooltip
                    title={
                        setting.group_albums
                            ? "Currently grouping albums from metadata"
                            : "Not grouping (each folder is one album)"
                    }
                >
                    <Checkbox
                        disabled={!enabled}
                        color="secondary"
                        icon={
                            <ComponentIcon
                                size={theme.iconSize.sm}
                                fill={
                                    enabled
                                        ? theme.palette.secondary.main
                                        : theme.palette.action.disabled
                                }
                                stroke={
                                    enabled
                                        ? theme.palette.secondary.main
                                        : theme.palette.action.disabled
                                }
                            />
                        }
                        checkedIcon={<ComponentIcon size={theme.iconSize.sm} />}
                        checked={!setting.group_albums}
                        onChange={(e) => {
                            setSetting((prev) => ({
                                ...prev,
                                group_albums: !e.target.checked,
                            }));
                        }}
                    />
                </Tooltip>

                <Tooltip
                    title={
                        setting.do_lookup
                            ? "Using offline metadata (skipping online lookup)"
                            : "Doing online lookup"
                    }
                >
                    <Checkbox
                        disabled={!enabled}
                        color="secondary"
                        size="small"
                        icon={
                            <CloudIcon
                                size={theme.iconSize.sm}
                                fill={
                                    enabled
                                        ? theme.palette.secondary.main
                                        : theme.palette.action.disabled
                                }
                                stroke={
                                    enabled
                                        ? theme.palette.secondary.main
                                        : theme.palette.action.disabled
                                }
                            />
                        }
                        checkedIcon={<CloudIcon size={theme.iconSize.sm} />}
                        checked={setting.do_lookup}
                        onChange={(e) => {
                            setSetting((prev) => ({
                                ...prev,
                                do_lookup: e.target.checked,
                            }));
                        }}
                    />
                </Tooltip>

                <MutationButton
                    mutationOptions={enqueueMutationOptions}
                    mutateArgs={{
                        socket,
                        selected,
                        kind: EnqueueKind.PREVIEW,
                        group_albums: setting.group_albums,
                        autotag: setting.do_lookup,
                    }}
                    disabled={!enabled}
                    variant="outlined"
                    color="secondary"
                    startIcon={<TagIcon size={theme.iconSize.sm} />}
                >
                    Retag
                </MutationButton>
            </Box>

            {/* import */}
            <Box>
                <Tooltip
                    title={
                        importAsis
                            ? "Using existing file-metadata"
                            : "Using best online candidate"
                    }
                >
                    <Checkbox
                        disabled={!enabled}
                        color="secondary"
                        icon={
                            <InboxTypeIcon
                                type="bootleg"
                                size={theme.iconSize.sm}
                                fill={
                                    enabled
                                        ? theme.palette.secondary.main
                                        : theme.palette.action.disabled
                                }
                                stroke={
                                    enabled
                                        ? theme.palette.secondary.main
                                        : theme.palette.action.disabled
                                }
                            />
                        }
                        checkedIcon={
                            <InboxTypeIcon type="bootleg" size={theme.iconSize.sm} />
                        }
                        checked={!importAsis}
                        onChange={(e) => {
                            setImportAsIs(!e.target.checked);
                        }}
                    />
                </Tooltip>

                <MutationButton
                    mutationOptions={enqueueMutationOptions}
                    mutateArgs={{
                        socket,
                        selected,
                        kind: importAsis
                            ? EnqueueKind.IMPORT_BOOTLEG
                            : EnqueueKind.IMPORT_CANDIDATE,
                    }}
                    disabled={!enabled}
                    variant="contained"
                    color="secondary"
                    startIcon={<ImportIcon size={theme.iconSize.sm} />}
                >
                    Import {importAsis ? "Asis" : "Best"}
                </MutationButton>
            </Box>

            {/* extras */}
            <Box>
                <DeleteFoldersButton disable={!enabled} />
                <ClipboardCopyButton
                    disabled={!enabled}
                    color="secondary"
                    text={() => {
                        const config_escape_path = false; // TODO: get from config
                        let text = "";
                        let selectedPaths: string[];
                        if (config_escape_path) {
                            selectedPaths = selected.paths.map(_escapePathForBash);
                        } else {
                            selectedPaths = selected.paths;
                        }
                        if (selectedPaths.length > 1) {
                            text = selectedPaths.join("\\n");
                        } else {
                            text = selectedPaths.join(" ");
                        }
                        return text;
                    }}
                    icon_props={{ size: theme.iconSize.sm }}
                />
                <MutationButton
                    mutationOptions={enqueueMutationOptions}
                    mutateArgs={{
                        socket,
                        selected,
                        kind: EnqueueKind.IMPORT_UNDO,
                        delete_files: true,
                    }}
                    disabled={!enabled}
                    variant="outlined"
                    color="secondary"
                    startIcon={<HistoryIcon size={theme.iconSize.sm} />}
                >
                    Undo Import
                </MutationButton>
            </Box>
        </Box>
    );
}

function DeleteFoldersButton({ disable = false }: { disable?: boolean }) {
    const theme = useTheme();
    const { selected, deselectAll } = useFolderSelectionContext();

    // TODO: confirm popup + modifier key (alt? strg/cmd?) to skip confirmation

    return (
        <MutationButton
            mutationOptions={deleteFoldersMutationOptions}
            mutateArgs={{
                folderPaths: selected.paths,
                folderHashes: selected.hashes,
            }}
            onClick={() => {
                deselectAll();
            }}
            color="secondary"
            disabled={disable}
            children={<Trash2Icon size={theme.iconSize.md} />}
        />
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

interface MutationActionProps<D, E, V> {
    mutateArgs: V;
    mutationOptions: UseMutationOptions<D, E, V>;
}

function SpeedDialMutationAction<D, E, V>({
    icon,
    tooltip,
    mutateArgs,
    mutationOptions,
    ...props
}: {
    icon: React.ReactNode;
    tooltip: string;
} & MutationActionProps<D, E, V> &
    SpeedDialActionProps) {
    const { isPending, mutate } = useMutation(mutationOptions);

    return (
        <SpeedDialAction
            icon={icon}
            onClick={() => {
                mutate(mutateArgs);
            }}
            tooltip={tooltip}
            sx={{
                animation: isPending ? "spin 1s linear infinite" : "none",
                "@keyframes spin": {
                    from: { transform: "rotate(0deg)" },
                    to: { transform: "rotate(360deg)" },
                },
            }}
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
                    children: (
                        <Typography sx={{ backgroundColor: "red" }}>
                            {tooltip}
                        </Typography>
                    ),
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
    const navigate = useNavigate();

    return (
        <SpeedDialAction
            icon={<TerminalIcon />}
            tooltip="Import (cli)"
            onClick={() => {
                clearInput();
                let text = "";
                const importId = "cli-" + Math.random().toString(36).slice(2, 16);
                const importDate = formatDate(new Date(), "%Y%m%d_%H%M%S");
                const selectedPaths = selected.paths.map(_escapePathForBash);

                text = "\\\n  " + selectedPaths.join(" \\\n  ");
                text += ` \\\n  --set gui_import_id='${importId}'`;
                text += ` \\\n  --set gui_import_date='${importDate}'`;

                inputText(`beet import -t ${text}`);
                navigate({
                    to: "/terminal",
                }).catch(console.error);
            }}
            {...props}
        />
    );
}

function DeleteFoldersAction({ ...props }: SpeedDialActionProps) {
    const { selected, deselectAll } = useFolderSelectionContext();
    const { mutate, isPending } = useMutation(deleteFoldersMutationOptions);

    // TODO: confirm popup + modifier key (alt? strg/cmd?) to skip confirmation

    return (
        <SpeedDialAction
            icon={!isPending ? <Trash2Icon /> : <CircularProgress />}
            tooltip="Delete folders"
            onClick={() => {
                mutate({
                    folderPaths: selected.paths,
                    folderHashes: selected.hashes,
                });
                deselectAll();
            }}
            {...props}
        />
    );
}

function CopyPathAction({ ...props }: SpeedDialActionProps) {
    const { selected } = useFolderSelectionContext();
    const [copied, setCopied] = useState(false);

    return (
        <SpeedDialAction
            icon={!copied ? <ClipboardIcon /> : <ClipboardCheckIcon />}
            tooltip="Copy path"
            onClick={() => {
                const config_escape_path = false; // TODO: get from config
                let text = "";
                let selectedPaths: string[];
                if (config_escape_path) {
                    selectedPaths = selected.paths.map(_escapePathForBash);
                } else {
                    selectedPaths = selected.paths;
                }
                if (selectedPaths.length > 1) {
                    text = selectedPaths.join("\\n");
                } else {
                    text = selectedPaths.join(" ");
                }
                navigator.clipboard.writeText(text).catch(console.error);
                setCopied(true);
                setTimeout(() => setCopied(false), 5000);
            }}
            {...props}
        />
    );
}

function RetagAction({ ...props }: SpeedDialActionProps) {
    const theme = useTheme();
    const { socket } = useStatusSocket();
    const { selected } = useFolderSelectionContext();

    // TODO: load defaults from config
    const [setting, setSetting] = useState({
        group_albums: false,
        skip_lookup: false,
    });

    return (
        <>
            <Box
                sx={{
                    display: "flex",
                    flexDirection: "row",
                    alignItems: "center",
                    border: "none !important",
                    outline: "none",
                    marginRight: 2,
                }}
            >
                <SpeedDialMutationAction
                    icon={<TagIcon />}
                    tooltip={"Retag"}
                    mutationOptions={enqueueMutationOptions}
                    mutateArgs={{
                        socket,
                        selected,
                        kind: EnqueueKind.PREVIEW,
                        group_albums: setting.group_albums,
                        autotag: !setting.skip_lookup,
                    }}
                    sx={{
                        marginRight: 0,
                        [theme.breakpoints.up("tablet")]: {
                            border: "1px solid rgba(255, 255, 255, 0.12)",
                        },
                    }}
                    {...props}
                />
                <Box
                    sx={(theme) => ({
                        display: "flex",
                        border: "1px solid rgba(255, 255, 255, 0.12)",
                        marginLeft: "-0.5rem",
                        paddingLeft: "0.5rem",
                        borderTopRightRadius: "15px",
                        borderBottomRightRadius: "15px",
                        paddingRight: "0.25rem",
                        [theme.breakpoints.down("tablet")]: {
                            display: "none",
                        },
                    })}
                >
                    <Tooltip title="Group albums">
                        <Checkbox
                            size="small"
                            icon={<GroupIcon size={theme.iconSize.lg} />}
                            checkedIcon={<UngroupIcon size={theme.iconSize.lg} />}
                            sx={{
                                margin: "0px",
                                borderRadius: "0px",
                                width: "30px",
                                height: "30px",
                                minHeight: "30px",
                                minWidth: "30px",
                                padding: 0.5,
                            }}
                            checked={!setting.group_albums}
                            onChange={(e) => {
                                setSetting((prev) => ({
                                    ...prev,
                                    group_albums: !e.target.checked,
                                }));
                            }}
                        />
                    </Tooltip>
                    <Tooltip title="Skip lookup">
                        <Checkbox
                            size="small"
                            icon={<EyeOffIcon size={theme.iconSize.lg} />}
                            checkedIcon={<EyeIcon size={theme.iconSize.lg} />}
                            disableRipple
                            sx={{
                                margin: "0px",
                                borderRadius: "0px",
                                width: "30px",
                                height: "30px",
                                minHeight: "30px",
                                minWidth: "30px",
                                padding: 0.5,
                            }}
                            checked={!setting.skip_lookup}
                            onChange={(e) => {
                                setSetting((prev) => ({
                                    ...prev,
                                    skip_lookup: !e.target.checked,
                                }));
                            }}
                        />
                    </Tooltip>
                </Box>
            </Box>
        </>
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

/* ---------------------- Simple Buttons with feedback ---------------------- */

export function RetagButton({
    folderPaths,
    folderHashes,
    onRetag,
    ...props
}: {
    folderPaths: string[];
    folderHashes: string[];
    onRetag?: (update: JobStatusUpdate[]) => void;
} & React.ComponentProps<typeof Button>) {
    const theme = useTheme();
    const { socket } = useStatusSocket();
    // TODO: How to show errors?
    const { mutateAsync, isPending } = useMutation(enqueueMutationOptions);

    return (
        <Button
            size="small"
            onClick={async () => {
                if (!socket) {
                    console.error("No socket connection");
                    return;
                }
                const r = await mutateAsync({
                    socket,
                    selected: {
                        paths: folderPaths,
                        hashes: folderHashes,
                    },
                    kind: EnqueueKind.PREVIEW,
                });
                onRetag?.(r);
            }}
            loading={isPending}
            endIcon={<TagIcon size={theme.iconSize.sm} />}
            {...props}
        >
            (Re)tag
        </Button>
    );
}
