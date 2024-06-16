import { FsPath } from "@/lib/inbox";

import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";

import { UseMutationOptions } from "@tanstack/react-query";

import { useState, MouseEvent, createContext, useContext } from "react";
import { IconTextButtonWithMutation } from "@/components/common/buttons";
import { queryClient } from "@/main";
import { TagI } from "@/lib/tag";
import { Tag, HardDriveDownload, Clipboard, Terminal } from "lucide-react";

import { useTerminalContext } from "@/components/terminal";

import styles from "./contextMenu.module.scss";

export default function ContextMenu({
    children,
    fp,
    className,
}: {
    children: React.ReactNode;
    // TODO: likely we do not need FsPath in the ContextMenu fullPath should do.
    // however, we will likely want a context to deal with multi-selection!
    fp: FsPath;
    className?: string;
}) {
    const [contextMenu, setContextMenu] = useState<{
        mouseX: number;
        mouseY: number;
    } | null>(null);

    const handleContextMenu = (event: React.MouseEvent) => {
        event.preventDefault();
        setContextMenu(
            contextMenu === null
                ? {
                      mouseX: event.clientX + 2,
                      mouseY: event.clientY - 6,
                  }
                : null
        );
    };

    const handleClose = () => {
        setContextMenu(null);
    };

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
                    MenuListProps={{
                        "aria-labelledby": "basic-button",
                    }}
                >
                    <RetagAction fullPath={fp.full_path} />
                    <ImportAction fullPath={fp.full_path} />
                    <TerminalImportAction fullPath={fp.full_path} />
                    <CopyPathAction fullPath={fp.full_path} />
                </Menu>
            </div>
        </ClosingContext.Provider>
    );
}

const ClosingContext = createContext({ handleClose: () => {} });

function RetagAction({ fullPath, ...props }: { fullPath: string; [key: string]: any }) {
    const { handleClose } = useContext(ClosingContext);
    const retagOptions: UseMutationOptions = {
        mutationFn: async () => {
            await fetch(`/tag/add`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    folder: fullPath,
                    kind: "preview",
                }),
            });
        },
        onSuccess: async () => {
            handleClose();
            await queryClient.setQueryData(["tag", fullPath], (old: TagI) => {
                return { ...old, status: "pending" };
            });
        },
        onError: (error: Error) => {
            handleClose();
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

function ImportAction({
    fullPath,
    ...props
}: {
    fullPath: string;
    [key: string]: any;
}) {
    const { handleClose } = useContext(ClosingContext);
    const importOptions: UseMutationOptions = {
        mutationFn: async () => {
            await fetch(`/tag/add`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    folder: fullPath,
                    kind: "import",
                }),
            });
        },
        onSuccess: async () => {
            handleClose();
            await queryClient.setQueryData(["tag", fullPath], (old: TagI) => {
                return { ...old, status: "pending" };
            });
        },
        onError: (error: Error) => {
            handleClose();
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

function CopyPathAction({
    fullPath,
    ...props
}: {
    fullPath: string;
    [key: string]: any;
}) {
    const { handleClose } = useContext(ClosingContext);

    return (
        <MenuItem
            {...props}
            className={styles.menuItem}
            onClick={() => {
                handleClose();
                navigator.clipboard.writeText(fullPath).catch(console.error);
            }}
        >
            <Clipboard size={12} />
            <span>Copy Path</span>
        </MenuItem>
    );
}

function TerminalImportAction({
    fullPath,
    ...props
}: {
    fullPath: string;
    [key: string]: any;
}) {
    const { handleClose } = useContext(ClosingContext);
    const { setOpen, inputText } = useTerminalContext();

    return (
        <MenuItem
            {...props}
            onClick={() => {
                handleClose();
                setOpen(true);
                inputText(`beet import -t '${fullPath}'`);
            }}
        >
            <Terminal size={12} />
            <span>Terminal Import</span>
        </MenuItem>
    );
}
