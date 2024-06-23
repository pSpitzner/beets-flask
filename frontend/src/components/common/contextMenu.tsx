import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";

import { UseMutationOptions } from "@tanstack/react-query";

import {
    useState,
    MouseEvent,
    createContext,
    useContext,
    useRef,
    useEffect,
    cloneElement,
} from "react";
import { IconTextButtonWithMutation } from "@/components/common/buttons";
import { queryClient } from "@/main";
import { TagI } from "@/lib/tag";
import { Tag, HardDriveDownload, Clipboard, Terminal } from "lucide-react";

import { useTerminalContext } from "@/components/terminal";
import { useSelection } from "@/components/context/useSelection";

import styles from "./contextMenu.module.scss";
import { useSiblings } from "@/components/context/useSiblings";

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
    <SelectionSummary divider />,
    <SelectAllAction />,
    <DeselectAllAction />,
    <RetagAction autoFocus />,
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
/*                                       Actions                                      */
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
        <MenuItem disabled className={styles.menuHeading} {...props}>
            <span>{N.current} selected</span>
        </MenuItem>
    );
}

export function SelectAllAction({ ...props }: { [key: string]: any }) {
    const { selectAll } = useSelection();
    const { closeMenu } = useContextMenu();
    return (
        <MenuItem
            {...props}
            className={styles.menuItem}
            onClick={() => {
                closeMenu();
                selectAll();
            }}
        >
            <span>Select All</span>
        </MenuItem>
    );
}

export function DeselectAllAction({ ...props }: { [key: string]: any }) {
    const { deselectAll } = useSelection();
    const { closeMenu } = useContextMenu();
    return (
        <MenuItem
            {...props}
            className={styles.menuItem}
            onClick={() => {
                closeMenu();
                deselectAll();
            }}
        >
            <span>Deselect All</span>
        </MenuItem>
    );
}

// for accordions that can be expanded, like in the tags view
export function ExpandAllAction({ ...props }: { [key: string]: any }) {
    const { siblings } = useSiblings();
    const { closeMenu } = useContextMenu();
    const handleClick = () => {
        siblings.forEach((sibling : React.RefObject<any>) => {
            sibling.current.setExpanded(true);
        });
        closeMenu();
    }

    return (
        <MenuItem
            {...props}
            className={styles.menuItem}
            onClick={handleClick}
        >
            <span>Expand All</span>
        </MenuItem>
    );
}

export function CollapseAllAction({ ...props }: { [key: string]: any }) {
    const { siblings } = useSiblings();
    const { closeMenu } = useContextMenu();
    const handleClick = () => {
        siblings.forEach((sibling: React.RefObject<any>) => {
            sibling.current.setExpanded(false);
        });
        closeMenu();
    };

    return (
        <MenuItem {...props} className={styles.menuItem} onClick={handleClick}>
            <span>Collapse All</span>
        </MenuItem>
    );
}

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
        <MenuItem {...props} className={styles.menuItem}>
            <IconTextButtonWithMutation
                icon={<Tag size={12} />}
                text="(Re-)Tag"
                color="inherit"
                mutationOption={retagOptions}
            />
        </MenuItem>
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
        <MenuItem {...props} className={styles.menuItem}>
            <IconTextButtonWithMutation
                icon={<HardDriveDownload size={12} />}
                text="Import"
                color="inherit"
                mutationOption={importOptions}
            />
        </MenuItem>
    );
}

export function CopyPathAction({ ...props }: { [key: string]: any }) {
    const { closeMenu } = useContextMenu();
    const { getSelected } = useSelection();
    const text = useRef("");

    useEffect(() => {
        text.current = "'" + getSelected().join("' '") + "'";
    }, []);

    return (
        <MenuItem
            {...props}
            className={styles.menuItem}
            onClick={() => {
                closeMenu();
                navigator.clipboard.writeText(text.current).catch(console.error);
            }}
        >
            <Clipboard size={12} />
            <span>Copy Path</span>
        </MenuItem>
    );
}

export function TerminalImportAction({ ...props }: { [key: string]: any }) {
    const { closeMenu } = useContextMenu();
    const { setOpen, inputText, clearInput } = useTerminalContext();
    const { getSelected } = useSelection();
    const text = useRef("");

    useEffect(() => {
        text.current = "'" + getSelected().join("' '") + "'";
    }, []);

    return (
        <MenuItem
            {...props}
            onClick={() => {
                closeMenu();
                setOpen(true);
                clearInput();
                inputText(`beet import -t ${text.current}`);
            }}
        >
            <Terminal size={12} />
            <span>Terminal Import</span>
        </MenuItem>
    );
}
