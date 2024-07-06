import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";

import {
    UseMutationOptions,
    useMutation,
} from "@tanstack/react-query";

import {
    useState,
    MouseEvent,
    TouchEvent,
    createContext,
    useContext,
    useRef,
    useEffect,
    cloneElement,
    forwardRef,
} from "react";
import { queryClient } from "@/main";
import { TagI } from "@/lib/tag";
import {
    Tag,
    HardDriveDownload,
    Clipboard,
    Terminal,
    Trash2,
    ChevronRight,
    LayoutList,
    ListChecks,
    Maximize,
    Minimize2,
} from "lucide-react";

import { useTerminalContext } from "@/components/terminal";
import {
    useSelection,
    useSelectionLookupQueries,
} from "@/components/context/useSelection";

import styles from "./contextMenu.module.scss";
import { useSiblings } from "@/components/context/useSiblings";
import { ErrorDialog } from "./dialogs";
import { Typography } from "@mui/material";

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
    actions?: React.ReactNode[];
    identifier?: string;
}

export const defaultActions = [
    <SelectAllAction autoFocus />,
    <DeselectAllAction divider />,
    <RetagAction />,
    <ImportAction />,
    <TerminalImportAction />,
    <UndoImportAction />,
    <CopyPathAction />,
    <DeleteAction />,
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
                {actions.map((action, index) =>
                    cloneElement(action as React.ReactElement, {
                        key: (action as React.ReactElement).key || `action-${index}`,
                    })
                )}
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

export function SelectionSummary({ ...props }: { [key: string]: any }) {
    const { numSelected } = useSelection();
    const N = useRef(numSelected());

    // on close, we reset N. prevent the menu from displaying 0 for a split second
    useEffect(() => {
        N.current = numSelected();
    }, []);

    return (
        // make this a non-clickable heading
        <Heading {...props} text={N.current + " selected"} />
    );
}

export function SelectAllAction({ ...props }: { [key: string]: any }) {
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

export function DeselectAllAction({ ...props }: { [key: string]: any }) {
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
export function ExpandAllAction({ ...props }: { [key: string]: any }) {
    const { siblings } = useSiblings();
    const { closeMenu } = useContextMenu();
    return (
        <Action
            {...props}
            onClick={() => {
                siblings.forEach((sibling: React.RefObject<any>) => {
                    sibling.current.setExpanded(true);
                });
                closeMenu();
            }}
            text={"Expand All"}
            icon={<Maximize />}
        />
    );
}

export function CollapseAllAction({ ...props }: { [key: string]: any }) {
    const { siblings } = useSiblings();
    const { closeMenu } = useContextMenu();
    return (
        <Action
            {...props}
            onClick={() => {
                siblings.forEach((sibling: React.RefObject<any>) => {
                    sibling.current.setExpanded(false);
                });
                closeMenu();
            }}
            text={"Collapse All"}
            icon={<Minimize2 />}
        />
    );
}

export function CopyPathAction({ ...props }: { [key: string]: any }) {
    const { closeMenu } = useContextMenu();
    const { getSelected } = useSelection();
    const text = useRef("");

    useEffect(() => {
        text.current = "'" + getSelected().join("' '") + "'";
    }, [text]);

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

export function TerminalImportAction({ ...props }: { [key: string]: any }) {
    const { closeMenu } = useContextMenu();
    const { setOpen, inputText, clearInput } = useTerminalContext();
    const { getSelected } = useSelection();
    const text = useRef("");

    useEffect(() => {
        text.current = "'" + getSelected().join("' '") + "'";
    }, [text]);

    return (
        <Action
            {...props}
            onClick={() => {
                closeMenu();
                setOpen(true);
                clearInput();
                inputText(`beet import -t ${text.current}`);
            }}
            icon={<Terminal />}
            text={"Terminal Import"}
        />
    );
}

export function UndoImportAction(props: Record<string, unknown>) {
    const { closeMenu } = useContextMenu();
    const { setOpen, inputText, clearInput } = useTerminalContext();
    const { getSelected } = useSelection();

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
                setOpen(true);
                clearInput();
                inputText(cmd);
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
export function RetagAction({ ...props }: { [key: string]: any }) {
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
            getSelected().forEach(async (tagPath: string) => {
                await queryClient.setQueryData(["tag", tagPath], (old: TagI) => {
                    return { ...old, status: "pending" };
                });
            });
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

export function ImportAction({ ...props }: { [key: string]: any }) {
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
            getSelected().forEach(async (tagPath: string) => {
                await queryClient.setQueryData(["tag", tagPath], (old: TagI) => {
                    return { ...old, status: "pending" };
                });
            });
        },
        onError: (error: Error) => {
            console.error(error);
        },
    };

    return (
        <ActionWithMutation
            {...props}
            icon={<HardDriveDownload />}
            text={"Import"}
            mutationOption={importOptions}
        />
    );
}

export function DeleteAction({ ...props }: { [key: string]: any }) {
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
/*                                   Action Helpers                                   */
/* ---------------------------------------------------------------------------------- */

function Action({
    onClick,
    icon,
    text,
    className,
    ...props
}: {
    onClick?: () => void;
    icon?: React.ReactNode;
    text: React.ReactNode;
    className?: string;
    [key: string]: any;
}) {
    const { closeMenu } = useContextMenu();

    return (
        <MenuItem
            {...props}
            className={`${styles.Action} ${className ? className : ""}`}
            onClick={onClick || closeMenu}
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
    {
        mutationOption,
        icon,
        text,
        className,
        ...props
    }: {
        mutationOption: UseMutationOptions;
        icon: React.ReactNode;
        text: React.ReactNode;
        className?: string;
        [key: string]: any;
    },
    ref?: React.Ref<HTMLDivElement>
) {
    const { isSuccess, isPending, mutate, isError, error, reset } =
        useMutation(mutationOption);

    return (
        <MenuItem
            {...props}
            className={`${styles.Action} ${className ? className : ""}`}
            onClick={(event: React.MouseEvent) => {
                event.stopPropagation();
                if (isSuccess) {
                    reset();
                } else {
                    mutate();
                }
            }}
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
            <div className={styles.ActionText}>{isPending ? text + " ..." : text}</div>

            {isError && <ErrorDialog open={isError} error={error} onClose={reset} />}
        </MenuItem>
    );
});

function Heading({
    onClick,
    icon,
    text,
    className,
    ...props
}: {
    onClick?: () => void;
    icon?: React.ReactNode;
    text: React.ReactNode;
    className?: string;
    [key: string]: any;
}) {
    return (
        <MenuItem disabled className={`${styles.Action} ${styles.Heading}`} {...props}>
            <div className={styles.ActionText}>{text}</div>
            {icon && <div className={styles.ActionIcon}>{icon}</div>}
        </MenuItem>
    );
}
