import { createFileRoute } from "@tanstack/react-router";

import {
    UseMutationOptions,
    useMutation,
    useSuspenseQuery,
} from "@tanstack/react-query";
import { FsPath, inboxQueryOptions } from "../lib/inbox";
import { StatusIcon } from "../components/common/statusIcon";
import { SimilarityBadge } from "../components/common/similarityBadge";

import styles from "./inbox.module.scss";
import { ChevronRight, Icon } from "lucide-react";
import { Settings2 } from "lucide-react";

import * as Collapsible from "@radix-ui/react-collapsible";
import { Button, Checkbox, IconButton } from "@mui/material";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";

import { useState, MouseEvent } from "react";
import ErrorDialog from "@/components/common/dialogs";
import { IconTextButtonWithMutation } from "@/components/common/buttons";

export const Route = createFileRoute("/inbox")({
    loader: (opts) => opts.context.queryClient.ensureQueryData(inboxQueryOptions()),
    component: () => <Inbox />,
});

export function Inbox() {
    const query = useSuspenseQuery(inboxQueryOptions());

    return (
        <div>
            <div className={styles.inboxView}>
                <FolderView fp={query.data} />
            </div>
        </div>
    );
}

/**
 * Renders a view for a folder.
 * It recursively generates views for subfolders and files within the folder.
 *
 * @param {Object} props - The properties passed to the component.
 * @param {FsPath} props.fp - The file path object representing the folder.
 * @param {string} [props.label] - The label to display for the folder. Optional.
 * @param {boolean} [props.mergeLabels=false] - Whether to merge labels of nested folders. Optional, defaults to true.
 *
 * @returns {JSX.Element} A JSX element representing the view for the folder.
 */
export function FolderView({
    fp,
    label,
    mergeLabels = true,
    level = 0,
}: {
    fp: FsPath;
    label?: string;
    mergeLabels?: boolean;
    level?: number;
}): JSX.Element {
    if (fp.type === "file") {
        return FileView({ fp: fp });
    }

    const subViews: JSX.Element[] = [];

    // first, check if we can merge a sub-path.
    for (const name of Object.keys(fp.children)) {
        if (fp.children[name].type == "directory") {
            if (!mergeLabels) {
                subViews.push(
                    FolderView({
                        fp: fp.children[name],
                        label: name,
                        mergeLabels: false,
                    })
                );
            } else {
                const [subFp, subName, mergedNname] = mergeSubFolderNames(fp, name);
                subViews.push(
                    FolderView({
                        fp: subFp.children[subName],
                        label: mergedNname,
                        level: level + 1,
                    })
                );
            }
        } else {
            subViews.push(FileView({ fp: fp.children[name] }));
        }
    }

    if (level === 0) {
        // this takes care of the root folder
        return <>{subViews}</>;
    }
    return (
        <div className={styles.folder} data-empty={subViews.length < 1}>
            <Collapsible.Root defaultOpen>
                <div key={fp.full_path} className={styles.header}>
                    <Collapsible.Trigger
                        asChild
                        className={styles.trigger}
                        disabled={subViews.length < 1}
                    >
                        <ChevronRight />
                    </Collapsible.Trigger>

                    {fp.is_album && (
                        <div className="flex flex-row items-center justify-center gap-2 mx-1">
                            <Checkbox className="p-0 "></Checkbox>
                            <StatusIcon status="unknown" />
                            <SimilarityBadge dist={null} />
                            <ActionMenu fp={fp} />
                        </div>
                    )}

                    <div>{label}</div>
                </div>
                <Collapsible.Content className={styles.content}>
                    {subViews}
                </Collapsible.Content>
            </Collapsible.Root>
        </div>
    );
}

export function FileView({ fp: fp }: { fp: FsPath }): JSX.Element {
    if (fp.type !== "file") {
        throw new TypeError("Expected a file, got a directory");
    }
    const fileName = fp.full_path.split("/").pop();
    return (
        <div key={fp.full_path} className={styles.file}>
            <div>{fileName}</div>
        </div>
    );
}

export default function ActionMenu({ fp }: { fp: FsPath }) {
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const open = Boolean(anchorEl);
    const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
        setAnchorEl(event.currentTarget);
    };
    const handleClose = () => {
        setAnchorEl(null);
    };

    const retagOptions: UseMutationOptions = {
        mutationFn: async () => {
            return await fetch(`/tag/add`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    folder: fp.full_path,
                    kind: "preview",
                }),
            });
        },
        onSuccess: () => {
            handleClose();
        },
        onError: (error: Error) => {
            console.error(error);
        },
    };

    return (
        <div>
            <IconButton
                id="basic-button"
                aria-controls={open ? "basic-menu" : undefined}
                aria-haspopup="true"
                aria-expanded={open ? "true" : undefined}
                className="p-0 m-0"
                onClick={handleClick}
            >
                <Settings2 />
            </IconButton>

            <Menu
                id="basic-menu"
                anchorEl={anchorEl}
                open={open}
                onClose={handleClose}
                MenuListProps={{
                    "aria-labelledby": "basic-button",
                }}
            >
                <MenuItem sx={{ padding: 0 }}>
                    <IconTextButtonWithMutation
                        icon={<ChevronRight />}
                        text="(Re-)Tag"
                        color="inherit"
                        mutationOption={retagOptions}
                    />
                </MenuItem>
                <MenuItem
                    onClick={() => {
                        handleClose();
                    }}
                >
                    Import
                </MenuItem>
                <MenuItem
                    onClick={() => {
                        handleClose();
                        navigator.clipboard
                            .writeText(fp.full_path)
                            .catch(console.error);
                    }}
                >
                    Copy Path
                </MenuItem>
            </Menu>
        </div>
    );
}

function mergeSubFolderNames(
    parent: FsPath,
    name: string,
    merged = ""
): [FsPath, string, string] {
    const me = parent.children[name];
    const numChildren = Object.keys(me.children).length;

    let singleChild = null;
    let singleChildName = null;
    if (numChildren === 1) {
        singleChildName = Object.keys(me.children)[0];
        singleChild = me.children[singleChildName];
    }

    if (singleChildName && singleChild?.type === "directory") {
        return mergeSubFolderNames(me, singleChildName, merged + name + " / ");
    } else {
        return [parent, name, merged + name];
    }
}
