import { FsPath } from "@/lib/inbox";

import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";

import { UseMutationOptions } from "@tanstack/react-query";

import {
    useState,
    MouseEvent,
    createContext,
    useContext,
    useCallback,
    useRef,
    useEffect,
} from "react";
import { IconTextButtonWithMutation } from "@/components/common/buttons";
import { queryClient } from "@/main";
import { TagI } from "@/lib/tag";
import { Tag, HardDriveDownload, Clipboard, Terminal } from "lucide-react";

import { useTerminalContext } from "@/components/terminal";
import { SelectionProvider, useSelection } from "@/components/context/useSelection";

import styles from "./contextMenu.module.scss";

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
export default function ContextMenu({
    children,
    fp,
    className,
}: {
    children: React.ReactNode;
    fp?: FsPath;
    className?: string;
}) {
    const { addToSelection, removeFromSelection, isSelected, clearSelection } =
        useSelection();
    // we always want to include the currently clicked item in the selection,
    // and remember that we added it
    const [addCurrent, setAddCurrent] = useState(false);
    const [contextMenu, setContextMenu] = useState<{
        mouseX: number;
        mouseY: number;
    } | null>(null);

    const handleContextMenu = useCallback(
        (event: React.MouseEvent) => {
            if (fp && !isSelected(fp.full_path)) {
                setAddCurrent(true);
                addToSelection(fp.full_path);
            }
            event.preventDefault();
            setContextMenu(
                contextMenu === null
                    ? {
                          mouseX: event.clientX + 2,
                          mouseY: event.clientY - 6,
                      }
                    : null
            );
        },
        [fp, contextMenu, setContextMenu, addCurrent, addToSelection]
    );

    const handleClose = useCallback(() => {
        // if (addCurrent) {
        //     removeFromSelection(fp!.full_path);
        //     setAddCurrent(false);
        // }
        // @sm did not manage to make the temporary selection persistent.
        clearSelection();
        setContextMenu(null);
    }, [fp, addCurrent, setContextMenu]);

    return (
        <ClosingContext.Provider value={{ handleClose }}>
            <div onContextMenu={handleContextMenu} className={className}>
                {children}
                <Menu
                    open={contextMenu !== null}
                    onClose={handleClose} // enables `esc` and outside clicks to close the menu
                    anchorReference="anchorPosition"
                    anchorPosition={
                        contextMenu !== null
                            ? { top: contextMenu.mouseY, left: contextMenu.mouseX }
                            : undefined
                    }
                    // MenuListProps={{
                    //     "aria-labelledby": "basic-button",
                    // }}
                >
                    <SelectionSummary divider />
                    <RetagAction autoFocus />
                    <ImportAction />
                    <TerminalImportAction />
                    <CopyPathAction />
                </Menu>
            </div>
        </ClosingContext.Provider>
    );
}

const ClosingContext = createContext({ handleClose: () => {} });

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

function RetagAction({ ...props }: { [key: string]: any }) {
    const { handleClose } = useContext(ClosingContext);
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
            handleClose();
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
    const { handleClose } = useContext(ClosingContext);
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
            handleClose();
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
    const { handleClose } = useContext(ClosingContext);
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
                handleClose();
                navigator.clipboard.writeText(text.current).catch(console.error);
            }}
        >
            <Clipboard size={12} />
            <span>Copy Path</span>
        </MenuItem>
    );
}

function TerminalImportAction({ ...props }: { [key: string]: any }) {
    const { handleClose } = useContext(ClosingContext);
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
                handleClose();
                setOpen(true);
                inputText(`beet import -t ${text.current}`);
            }}
        >
            <Terminal size={12} />
            <span>Terminal Import</span>
        </MenuItem>
    );
}
