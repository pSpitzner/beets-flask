import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";

import { UseMutationOptions, useMutation } from "@tanstack/react-query";

import {
    useState,
    MouseEvent,
    createContext,
    useContext,
    useRef,
    useEffect,
    cloneElement,
    forwardRef,
    Ref,
} from "react";
import { IconTextButtonWithMutation } from "@/components/common/buttons";
import { queryClient } from "@/main";
import { TagI } from "@/lib/tag";
import { Tag, HardDriveDownload, Clipboard, Terminal } from "lucide-react";

import { useTerminalContext } from "@/components/terminal";
import { useSelection } from "@/components/context/useSelection";

import styles from "./contextMenu.module.scss";
import { useSiblings } from "@/components/context/useSiblings";
import { MenuList } from "@mui/material";
import { ErrorDialog } from "./dialogs";

interface ContextMenuContextI {
    closeMenu: () => void;
    openMenu: (event: MouseEvent) => void;
    open: boolean;
    position: { left: number; top: number } | undefined;
}

const ContextMenuContext = createContext<ContextMenuContextI>({
    openMenu: () => {},
    closeMenu: () => {},
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
    <CopyPathAction />,
];

export function ContextMenu({
    children,
    actions = defaultActions,
    identifier,
    ...props
}: ContextMenuProps) {
    const { addToSelection, removeFromSelection, selection } = useSelection();

    const [position, setPosition] = useState<
        | {
              left: number;
              top: number;
          }
        | undefined
    >(undefined);

    const prevState = useRef<undefined | boolean>();
    const openMenu = (event: React.MouseEvent) => {
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
            value={{ closeMenu, openMenu, open: position !== undefined, position }}
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
    const { openMenu } = useContextMenu();

    return (
        <div onContextMenu={openMenu} {...props}>
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
            getSelected().forEach(async (fullPath: string) => {
                await queryClient.setQueryData(["tag", fullPath], (old: TagI) => {
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
            getSelected().forEach(async (fullPath: string) => {
                await queryClient.setQueryData(["tag", fullPath], (old: TagI) => {
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
            <div className={styles.ActionText}>{text}</div>
            {icon && <div className={styles.ActionIcon}>{icon}</div>}
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
            <div className={styles.ActionText}>{isPending ? text + " ..." : text}</div>

            {icon && (
                <div className={styles.ActionIcon} ref={ref}>
                    {icon}
                </div>
            )}

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
