import { createFileRoute } from "@tanstack/react-router";

import { UseMutationOptions, useSuspenseQuery } from "@tanstack/react-query";
import { FsPath, inboxQueryOptions } from "../lib/inbox";
import { StatusIcon } from "../components/common/statusIcon";
import { SimilarityBadge } from "../components/common/similarityBadge";

import styles from "./inbox.module.scss";
import { ChevronRight } from "lucide-react";
import { Settings2 } from "lucide-react";

import * as Collapsible from "@radix-ui/react-collapsible";
import { Checkbox, IconButton } from "@mui/material";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";

import { useState, MouseEvent } from "react";
import { IconTextButtonWithMutation } from "@/components/common/buttons";

export const Route = createFileRoute("/inbox")({
    loader: (opts) => opts.context.queryClient.ensureQueryData(inboxQueryOptions()),
    component: () => <Inbox />,
});

export function Inbox() {
    const query = useSuspenseQuery(inboxQueryOptions());

    return (
        <div className={styles.inboxView}>
            <FolderView fp={query.data} />
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
    /** The subviews for each child of the folder.
     */
    const numChildren = Object.keys(fp.children).length;
    const SubViews = () => {
        return Object.keys(fp.children).map((name) => {
            const child = fp.children[name];
            if (child.type === "directory") {
                if (!mergeLabels) {
                    return (
                        <FolderView
                            key={name}
                            fp={child}
                            label={name}
                            mergeLabels={false}
                        />
                    );
                } else {
                    const [subFp, subName, mergedName] = mergeSubFolderNames(fp, name);
                    return (
                        <FolderView
                            key={mergedName}
                            fp={subFp.children[subName]}
                            label={mergedName}
                            level={level + 1}
                        />
                    );
                }
            } else {
                return <FileView key={child.full_path} fp={child} />;
            }
        });
    };

    if (fp.type === "file") {
        return <FileView fp={fp} />;
    }

    if (level === 0) {
        // this takes care of the root folder
        return <SubViews />;
    }
    return (
        <div className={styles.folder} data-empty={numChildren < 1}>
            <Collapsible.Root defaultOpen>
                <div key={fp.full_path} className={styles.header}>
                    <Collapsible.Trigger
                        asChild
                        className={styles.trigger}
                        disabled={numChildren < 1}
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

                    <span>{label}</span>
                </div>
                <Collapsible.Content className={styles.content}>
                    <SubViews />
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
            const response = await fetch(`/tag/add`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    folder: fp.full_path,
                    kind: "preview",
                }),
            });
            if (!response.ok) {
                // log error code and message
                const j = await response.json();
                let msg = j.error || response.statusText;
                msg += j.trace ? `\n${j.trace}` : "";
                throw new Error(`Failed to add tag: ${msg}`);
            }
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
