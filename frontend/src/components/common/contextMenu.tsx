import { FsPath } from "@/lib/inbox";

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
} from "react";
import { IconTextButtonWithMutation } from "@/components/common/buttons";
import { queryClient } from "@/main";
import { TagI } from "@/lib/tag";
import { Tag, HardDriveDownload, Clipboard, Terminal } from "lucide-react";

import { useTerminalContext } from "@/components/terminal";
import { useSelection } from "@/components/context/useSelection";

import styles from "./contextMenu.module.scss";

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
    actions?: React.ReactNode;
    fp?: FsPath;
}

export default function ContextMenu({
    children,
    fp,
    actions,
    ...props
}: ContextMenuProps) {
    const { addToSelection, removeFromSelection, selection } = useSelection();

    // we always want to include the currently clicked item in the selection,
    // and remember that we added it
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
        if (fp && selection.has(fp.full_path)) {
            prevState.current = selection.get(fp.full_path);
            addToSelection(fp.full_path);
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
            if (fp) {
                if (prevState.current) {
                    addToSelection(fp.full_path);
                } else {
                    removeFromSelection(fp.full_path);
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
                {actions ? (
                    <>
                        <SelectionSummary divider />
                        <SelectAllAction />
                        <RetagAction autoFocus />
                        <ImportAction />
                        <TerminalImportAction />
                        <CopyPathAction />
                    </>
                ) : null}
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

function SelectionSummary({ ...props }: { [key: string]: any }) {
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

function SelectAllAction({ ...props }: { [key: string]: any }) {
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

function RetagAction({ ...props }: { [key: string]: any }) {
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
                icon={<Tag size={12} />}
                text="(Re-)Tag"
                color="inherit"
                mutationOption={retagOptions}
            />
        </MenuItem>
    );
}

function ImportAction({ ...props }: { [key: string]: any }) {
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

function CopyPathAction({ ...props }: { [key: string]: any }) {
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

function TerminalImportAction({ ...props }: { [key: string]: any }) {
    const { closeMenu } = useContextMenu();
    const { setOpen, inputText } = useTerminalContext();
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
                inputText(`beet import -t ${text.current}`);
            }}
        >
            <Terminal size={12} />
            <span>Terminal Import</span>
        </MenuItem>
    );
}
