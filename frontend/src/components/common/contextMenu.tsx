import {
    ChevronRight,
    Clipboard,
    HardDriveDownload,
    LayoutList,
    ListChecks,
    Maximize,
    Minimize2,
    Tag,
    Terminal,
    Trash2,
} from "lucide-react";
import {
    createContext,
    forwardRef,
    MouseEvent,
    TouchEvent,
    useContext,
    useEffect,
    useRef,
    useState,
} from "react";
import { Typography } from "@mui/material";
import Menu from "@mui/material/Menu";
import MenuItem, { MenuItemOwnProps } from "@mui/material/MenuItem";
import { useMutation, UseMutationOptions } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import { queryClient, TagI } from "@/components/common/_query";
import {
    useSelection,
    useSelectionLookupQueries,
} from "@/components/common/hooks/useSelection";
import { useSiblings } from "@/components/common/hooks/useSiblings";
import { useTerminalContext } from "@/components/frontpage/terminal";
import { ExpandableSib } from "@/components/tags/tagView";

import { ErrorDialog } from "./dialogs";

import styles from "./contextMenu.module.scss";
import ImportAutoSvg from "@/assets/importAuto.svg?react";

interface ContextMenuContextI {
    closeMenu: () => void;
    openMenuMouse: (event: MouseEvent) => void;
    startLongPressTimer: (event: TouchEvent) => void;
    handleTouchMove: (event: TouchEvent) => void;
    cancelLongPressTimer: (event: TouchEvent) => void;
    open: boolean;
    position: { left: number; top: number } | undefined;
}

const ContextMenuContext = createContext<ContextMenuContextI>({
    closeMenu: () => {},
    openMenuMouse: () => {},
    startLongPressTimer: () => {},
    handleTouchMove: () => {},
    cancelLongPressTimer: () => {},
    open: false,
    position: undefined,
});

/**
 * Context Menu that appears when right-clicking on a file or folder.
 * Use a SelectionProvider to manage the selected items to which the context menu applies.
 *
 * @param param0
 * Example
 * ```tsx
 * <SelectionProvider>
 *   <ContextMenu fp={fp}>
 *     <div>Some content</div>
 *   </ContextMenu>
 * </SelectionProvider>
 */

interface ContextMenuProps
    extends Omit<React.HTMLAttributes<HTMLDivElement>, "onContextMenu"> {
    children: React.ReactNode;
    actions?: JSX.Element[];
    identifier?: string;
}

export const defaultActions = [
    <SelectAllAction key="action-select-all" autoFocus />,
    <DeselectAllAction key="action-deselect-all" divider />,
    <RetagAction key="action-retag" />,
    <ImportAction key="action-import" />,
    <InteractiveImportAction key="action-interactive-import" />,
    <TerminalImportAction key="action-terminal-import" />,
    <UndoImportAction key="action-undo-import" />,
    <CopyPathAction key="action-copy-path" />,
    <DeleteAction key="action-delete" />,
];

export function ContextMenu({
    children,
    actions = defaultActions,
    identifier,
    ...props
}: ContextMenuProps) {
    const { addToSelection, removeFromSelection, selection } = useSelection();

    const [position, setPosition] = useState<{ left: number; top: number } | undefined>(
        undefined
    );

    const prevState = useRef<undefined | boolean>();
    const openMenuMouse = (event: React.MouseEvent) => {
        event.preventDefault();
        // we use the identifier to always include the currently clicked item in the
        // selection, and remember that we added it.
        if (identifier && selection.has(identifier)) {
            prevState.current = selection.get(identifier);
            addToSelection(identifier);
        }
        setPosition((prev?: { left: number; top: number }) =>
            prev === undefined
                ? {
                      left: event.clientX + 2,
                      top: event.clientY - 6,
                  }
                : undefined
        );
    };

    /* ------------------------------------------------------------------------------ */
    /*                          Long-press for touch devices                          */
    /* ------------------------------------------------------------------------------ */

    const LONG_PRESS_DURATION = 500; // Define the long press duration (in milliseconds)
    const touchTimeoutRef = useRef<number | null>(null);
    const touchStartCoords = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

    const startLongPressTimer = (event: TouchEvent) => {
        touchStartCoords.current = {
            x: event.touches[0].clientX,
            y: event.touches[0].clientY,
        };
        touchTimeoutRef.current = setTimeout(
            () => openMenuTouch(event),
            LONG_PRESS_DURATION
        );
    };

    const openMenuTouch = (event: TouchEvent) => {
        event.preventDefault();
        cancelLongPressTimer();

        const touch = event.touches[0];
        const { clientX, clientY } = touch;

        setPosition({
            left: clientX + 2,
            top: clientY - 6,
        });
    };

    const cancelLongPressTimer = () => {
        if (touchTimeoutRef.current) {
            clearTimeout(touchTimeoutRef.current);
            touchTimeoutRef.current = null;
        }
    };

    const handleTouchMove = (event: TouchEvent) => {
        const moveThreshold = 10;
        const { x, y } = touchStartCoords.current;
        const currentX = event.touches[0].clientX;
        const currentY = event.touches[0].clientY;

        if (
            Math.abs(currentX - x) > moveThreshold ||
            Math.abs(currentY - y) > moveThreshold
        ) {
            cancelLongPressTimer();
        }
    };

    /* ------------------------------------------------------------------------------ */

    const closeMenu = () => {
        if (prevState.current !== undefined) {
            if (identifier) {
                if (prevState.current) {
                    addToSelection(identifier);
                } else {
                    removeFromSelection(identifier);
                }
            }
            prevState.current = undefined;
        }
        // @sm did not manage to make the temporary selection persistent.
        // clearSelection();
        setPosition(undefined);
    };

    return (
        <ContextMenuContext.Provider
            value={{
                closeMenu,
                openMenuMouse,
                handleTouchMove,
                cancelLongPressTimer,
                startLongPressTimer,
                open: position !== undefined,
                position,
            }}
        >
            <Trigger {...props}>{children}</Trigger>
            <Menu
                open={position !== undefined}
                onClose={closeMenu} // enables `esc` and outside clicks to close the menu
                anchorReference="anchorPosition"
                anchorPosition={position}
                className={styles.ContextMenu}
            >
                {actions}
            </Menu>
        </ContextMenuContext.Provider>
    );
}

function useContextMenu() {
    return useContext(ContextMenuContext);
}

function Trigger({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
    const {
        openMenuMouse,
        startLongPressTimer,
        handleTouchMove,
        cancelLongPressTimer,
    } = useContextMenu();

    return (
        <div
            onContextMenu={openMenuMouse}
            onTouchStart={startLongPressTimer}
            onTouchMove={handleTouchMove}
            onTouchEnd={cancelLongPressTimer}
            onTouchCancel={cancelLongPressTimer}
            {...props}
        >
            {children}
        </div>
    );
}

/* ---------------------------------------------------------------------------------- */
/*                                   Simple Actions                                   */
/* ---------------------------------------------------------------------------------- */

export function SelectionSummary({ ...props }: Partial<ActionProps>) {
    const { numSelected } = useSelection();
    const N = useRef(numSelected());

    // on close, we reset N. prevent the menu from displaying 0 for a split second
    useEffect(() => {
        N.current = numSelected();
    }, [numSelected]);

    return (
        // make this a non-clickable heading
        <Heading {...props} text={N.current + " selected"} />
    );
}

export function SelectAllAction({ ...props }: Partial<ActionProps>) {
    const { selectAll } = useSelection();
    const { closeMenu } = useContextMenu();
    return (
        <Action
            {...props}
            onClick={() => {
                closeMenu();
                selectAll();
            }}
            text={"Select All"}
            icon={<ListChecks />}
        />
    );
}

export function DeselectAllAction({ ...props }: Partial<ActionProps>) {
    const { deselectAll } = useSelection();
    const { closeMenu } = useContextMenu();
    return (
        <Action
            {...props}
            onClick={() => {
                closeMenu();
                deselectAll();
            }}
            text={"Deselect All"}
            icon={<LayoutList />}
        />
    );
}

// for accordions that can be expanded, like in the tags view
export function ExpandAllAction({ ...props }: Partial<ActionProps>) {
    const { callOnSiblings } = useSiblings<ExpandableSib>();
    const { closeMenu } = useContextMenu();
    return (
        <Action
            {...props}
            onClick={() => {
                callOnSiblings((sib) => {
                    sib.setExpanded(true);
                });
                closeMenu();
            }}
            text={"Expand All"}
            icon={<Maximize />}
        />
    );
}

export function CollapseAllAction({ ...props }: Partial<ActionProps>) {
    const { callOnSiblings } = useSiblings<ExpandableSib>();
    const { closeMenu } = useContextMenu();
    return (
        <Action
            {...props}
            onClick={() => {
                callOnSiblings((sib) => {
                    sib.setExpanded(false);
                });
                closeMenu();
            }}
            text={"Collapse All"}
            icon={<Minimize2 />}
        />
    );
}

export function CopyPathAction(props: Partial<ActionProps>) {
    const { closeMenu } = useContextMenu();
    const { getSelected } = useSelection();
    const text = useRef("");

    useEffect(() => {
        // text.current = "'" + getSelected().join("' '") + "'";
        const selectedPaths = getSelected().map(_escapePathForBash);
        text.current = selectedPaths.join(" ");
    }, [getSelected, text]);

    return (
        <Action
            {...props}
            onClick={() => {
                closeMenu();
                navigator.clipboard.writeText(text.current).catch(console.error);
            }}
            icon={<Clipboard />}
            text={"Copy Path"}
        />
    );
}

export function InteractiveImportAction(props: Partial<ActionProps>) {
    const { closeMenu } = useContextMenu();
    const { getSelected } = useSelection();
    const navigate = useNavigate();
    const selected = getSelected();

    if (selected.length != 1) {
        return null;
    }

    return (
        <Action
            {...props}
            onClick={() => {
                navigate({
                    to: `/import`,
                    search: {
                        sessionPath: encodeURIComponent(selected[0]),
                    },
                })
                    .then(() => {
                        closeMenu();
                    })
                    .catch((error) => {
                        console.error("Navigation error:", error);
                        closeMenu();
                    });
                closeMenu();
            }}
            icon={<HardDriveDownload />}
            text={"Import (interactive)"}
        />
    );
}

export function TerminalImportAction(props: Partial<ActionProps>) {
    const { closeMenu } = useContextMenu();
    const { inputText, clearInput } = useTerminalContext();
    const { getSelected } = useSelection();
    const text = useRef("");
    const navigate = useNavigate();

    useEffect(() => {
        // text.current = "'" + getSelected().join("' '") + "'";
        const selectedPaths = getSelected().map(_escapePathForBash);
        if (selectedPaths.length > 1) {
            text.current = "\\\n  " + selectedPaths.join(" \\\n  ");
        } else {
            text.current = selectedPaths.join(" ");
        }
    }, [getSelected, text]);

    return (
        <Action
            {...props}
            onClick={() => {
                closeMenu();
                clearInput();
                inputText(`beet import -t ${text.current}`);
                // Redirect to term
                navigate({
                    to: "/terminal",
                }).catch(console.error);
            }}
            icon={<Terminal />}
            text={"Import (cli)"}
        />
    );
}

function _escapePathForBash(path: string) {
    return path.replace(/'/g, "'\\''").replace(/\\/g, "\\\\").replace(/ /g, "\\ ");
}

export function UndoImportAction(props: Partial<ActionProps>) {
    const { closeMenu } = useContextMenu();
    const { inputText, clearInput } = useTerminalContext();
    const { getSelected } = useSelection();
    const navigate = useNavigate();

    const [cmd, setCmd] = useState("");
    const [label, setLabel] = useState("Undo Import ...");

    const selected = getSelected();
    const selectedObjects = useSelectionLookupQueries(selected).map((i) => i.data);
    const undoableTags = selectedObjects
        .filter((sel) => sel?.tag && sel.tag.status == "imported")
        .map((sel) => sel?.tag?.id);

    useEffect(() => {
        setCmd(
            "beet remove -d gui_import_id:" + undoableTags.join(" , gui_import_id:")
        );
    }, [undoableTags]);

    useEffect(() => {
        const tagDesc =
            undoableTags.length === 1 ? "1 tag" : `${undoableTags.length} tags`;
        setLabel(`Undo Import (${tagDesc})`);
    }, [undoableTags]);

    if (undoableTags.length === 0) {
        return null; // Return null instead of an empty fragment for clarity.
    }

    return (
        <Action
            {...props}
            onClick={() => {
                closeMenu();
                clearInput();
                inputText(cmd);
                navigate({
                    to: "/terminal",
                }).catch(console.error);
            }}
            icon={<Terminal />}
            text={label}
        />
    );
}

/* ---------------------------------------------------------------------------------- */
/*                                  Mutation Actions                                  */
/* ---------------------------------------------------------------------------------- */

/**
 * Refresh or tag for the first time.
 */
export function RetagAction(props: Partial<ActionProps>) {
    const { closeMenu } = useContextMenu();
    const { getSelected } = useSelection();
    const retagOptions: UseMutationOptions = {
        mutationFn: async () => {
            await fetch(`/tag/add`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    folders: getSelected(),
                    kind: "preview",
                }),
            });
        },
        onSuccess: async () => {
            const selected = getSelected();
            for (const tagPath of selected) {
                await queryClient.setQueryData(["tag", tagPath], (old: TagI) => {
                    return { ...old, status: "pending" };
                });
            }
            closeMenu();
        },
        onError: (error: Error) => {
            console.error(error);
        },
    };

    return (
        <ActionWithMutation
            {...props}
            icon={<Tag />}
            text={"(Re-)Tag"}
            mutationOption={retagOptions}
        />
    );
}

export function ImportAction(props: Partial<ActionProps>) {
    const { closeMenu } = useContextMenu();
    const { getSelected } = useSelection();
    const importOptions: UseMutationOptions = {
        mutationFn: async () => {
            await fetch(`/tag/add`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    folders: getSelected(),
                    kind: "import",
                }),
            });
        },
        onSuccess: async () => {
            closeMenu();
            const selected = getSelected();
            for (const tagPath of selected) {
                await queryClient.setQueryData(["tag", tagPath], (old: TagI) => {
                    return { ...old, status: "pending" };
                });
            }
        },
        onError: (error: Error) => {
            console.error(error);
        },
    };

    return (
        <ActionWithMutation
            {...props}
            icon={<ImportAutoSvg />}
            text={"Import (auto)"}
            mutationOption={importOptions}
        />
    );
}

export function DeleteAction(props: Partial<ActionProps>) {
    const { closeMenu } = useContextMenu();
    const { getSelected } = useSelection();
    const selection = getSelected();
    const deleteOptions: UseMutationOptions = {
        mutationFn: async () => {
            await fetch(`/inbox/path`, {
                method: "DELETE",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    folders: selection,
                    with_status: [],
                }),
            });
        },
        onSuccess: () => {
            closeMenu();
            queryClient.invalidateQueries({ queryKey: ["inbox"] }).catch(console.error);
            queryClient
                .invalidateQueries({ queryKey: ["tagGroup"] })
                .catch(console.error);
        },
        onError: (error: Error) => {
            console.error(error);
        },
    };

    return (
        <ActionWithMutation
            {...props}
            icon={<Trash2 color="red" />}
            text={<Typography color="red">Delete Folder</Typography>}
            mutationOption={deleteOptions}
        />
    );
}

/* ---------------------------------------------------------------------------------- */
/*                          Base action definitions                                   */
/* ---------------------------------------------------------------------------------- */

interface ActionWithMutationProps extends ActionProps {
    mutationOption: UseMutationOptions;
}

interface ActionProps extends MenuItemOwnProps {
    onClick?: () => void;
    icon?: React.ReactNode;
    text: React.ReactNode;
    className?: string;
}

function Action({ onClick, icon, text, className, ...props }: ActionProps) {
    const { closeMenu } = useContextMenu();

    return (
        <MenuItem
            className={`${styles.Action} ${className ? className : ""}`}
            onClick={onClick ?? closeMenu}
            {...props}
        >
            {icon ? (
                <div className={styles.ActionIcon}>{icon}</div>
            ) : (
                <div className={styles.ActionIcon}>
                    <ChevronRight />
                </div>
            )}
            <div className={styles.ActionText}>{text}</div>
        </MenuItem>
    );
}

const ActionWithMutation = forwardRef(function ActionWithMutation(
    { mutationOption, icon, text, className, ...props }: ActionWithMutationProps,
    ref?: React.Ref<HTMLDivElement>
) {
    const { isSuccess, isPending, mutate, isError, error, reset } =
        useMutation(mutationOption);

    return (
        <MenuItem
            className={`${styles.Action} ${className ? className : ""}`}
            onClick={(event: React.MouseEvent) => {
                event.stopPropagation();
                if (isSuccess) {
                    reset();
                } else {
                    mutate();
                }
            }}
            {...props}
        >
            {icon ? (
                <div className={styles.ActionIcon} ref={ref}>
                    {icon}
                </div>
            ) : (
                <div className={styles.ActionIcon} ref={ref}>
                    <ChevronRight />
                </div>
            )}
            <div className={styles.ActionText}>{isPending ? <>{text}...</> : text}</div>

            {isError && <ErrorDialog open={isError} error={error} onClose={reset} />}
        </MenuItem>
    );
});

function Heading({
    icon,
    text,
    className,
    ...props
}: {
    icon?: React.ReactNode;
    text: React.ReactNode;
    className?: string;
} & MenuItemOwnProps) {
    return (
        <MenuItem
            disabled
            className={`${styles.Action} ${styles.Heading} ${className ?? ""}`}
            {...props}
        >
            <div className={styles.ActionText}>{text}</div>
            {icon && <div className={styles.ActionIcon}>{icon}</div>}
        </MenuItem>
    );
}
