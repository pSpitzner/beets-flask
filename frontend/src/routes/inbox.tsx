import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { FsPath, inboxQueryOptions } from "@/lib/inbox";
import { TagStatusIcon } from "@/components/common/statusIcon";
import { SimilarityBadgeWithHover } from "@/components/common/similarityBadge";
import { SelectionProvider, useSelection } from "@/components/context/useSelection";
import {
    ContextMenu,
    SelectionSummary,
    defaultActions,
} from "@/components/common/contextMenu";

import styles from "./inbox.module.scss";
import { ChevronRight } from "lucide-react";

import * as Collapsible from "@radix-ui/react-collapsible";
import { useEffect, useState } from "react";
import { useConfig } from "@/components/context/useConfig";

export const Route = createFileRoute("/inbox")({
    loader: (opts) => opts.context.queryClient.ensureQueryData(inboxQueryOptions()),
    component: () => <Inbox />,
});

export function Inbox() {
    const query = useSuspenseQuery(inboxQueryOptions());
    const inboxes = query.data;

    if (inboxes.length == 0) {
        return <>No inboxes found. Check your config!</>;
    }

    return inboxes.map((inboxFp, i) => {
        return (
            <SelectionProvider key={i}>
                <div className={styles.inboxView}>
                    <FolderTreeView fp={inboxFp} />
                </div>
            </SelectionProvider>
        );
    });
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
export function FolderTreeView({
    fp,
    label,
    level = 0,
}: {
    fp: FsPath;
    label?: string | React.ReactNode;
    level?: number;
}): React.ReactNode {
    /** The subviews for each child of the folder.
     */

    const config = useConfig();

    const defaultExpandState = (fp.is_album && !config.gui.inbox.expand_files) ? false : true
    const [expanded, setExpanded] = useState<boolean>(defaultExpandState);
    const numChildren = Object.keys(fp.children).length;
    const uid = `collapsible-${fp.full_path}`;

    useEffect(() => {
        const savedState = localStorage.getItem(uid);
        if (savedState !== null) {
            setExpanded(JSON.parse(savedState));
        }
    }, [uid]);

    const handleExpandedChange = (isOpen: boolean) => {
        setExpanded(isOpen);
        localStorage.setItem(uid, JSON.stringify(isOpen));
    };

    if (fp.type === "file") {
        return <File fp={fp} />;
    }

    if (level === 0) {
        // this takes care of the root folder
        return <SubFolders fp={fp} level={level} />;
    }

    return (
        <div className={styles.folder} data-empty={numChildren < 1}>
            <Collapsible.Root open={expanded} onOpenChange={handleExpandedChange}>
                <ContextMenu
                    className={styles.contextMenuHeaderWrapper}
                    identifier={fp.full_path}
                    actions={[<SelectionSummary />, ...defaultActions]}
                >
                    <Folder fp={fp} label={label} />
                </ContextMenu>
                <Collapsible.Content className={styles.content}>
                    <SubFolders fp={fp} level={level} />
                </Collapsible.Content>
            </Collapsible.Root>
        </div>
    );
}

function SubFolders({ fp, level }: { fp: FsPath; level: number }) {

    return Object.keys(fp.children).map((name) => {
        const child = fp.children[name];
        if (child.type === "directory") {
            const [subFp, subName, mergedName] = concatSubFolderNames(fp, name);
            // enable line wrapping
            const mergedNameJsx = (
                <>
                    {mergedName.split(" / ").map((part, i, arr) => (
                        <span key={i}>
                            {part}
                            {i < arr.length - 1 && " / "}
                        </span>
                    ))}
                </>
            );
            return (
                <FolderTreeView
                    key={mergedName}
                    fp={subFp.children[subName]}
                    label={mergedNameJsx}
                    level={level + 1}
                />
            );
        } else {
            return <File key={child.full_path} fp={child} />;
        }
    });
}

// actual content, wrapped by the context menu
function Folder({ fp, label }: { fp: FsPath; label?: React.ReactNode }) {
    const { isSelected, toggleSelection, markSelectable } = useSelection();
    const handleSelect = () => {
        if (fp.is_album) {
            toggleSelection(fp.full_path);
        }
    };
    const numChildren = Object.keys(fp.children).length;

    useEffect(() => {
        // Register as selectable
        if (fp.is_album && numChildren > 0) {
            markSelectable(fp.full_path);
        }
    }, []);

    return (
        <div
            key={fp.full_path}
            className={styles.header}
            data-selected={isSelected(fp.full_path)}
            onClick={handleSelect}
        >
            {numChildren > 0 ? (
                <Collapsible.Trigger
                    asChild
                    className={styles.trigger}
                    onClick={(e) => {
                        console.log(e, fp.full_path);
                        e.stopPropagation();
                    }}
                >
                    <ChevronRight />
                </Collapsible.Trigger>
            ) : (
                <div>
                    <ChevronRight />
                </div>
            )}

            {fp.is_album && (
                <div className={styles.albumIcons}>
                    <TagStatusIcon
                        className={styles.albumIcon}
                        tagPath={fp.full_path}
                    />
                    <SimilarityBadgeWithHover tagPath={fp.full_path} />
                </div>
            )}

            <span className={styles.label}>{label}</span>
        </div>
    );
}

function File({ fp: fp }: { fp: FsPath }): JSX.Element {
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

function concatSubFolderNames(
    parent: FsPath,
    name: string,
    merged = ""
): [FsPath, string, string] {
    const config = useConfig();
    if (!config.gui.inbox.concat_nested_folders) {
        return [parent, name, merged + name];
    }

    const me = parent.children[name];
    const numChildren = Object.keys(me.children).length;

    let singleChild = null;
    let singleChildName = null;
    if (numChildren === 1) {
        singleChildName = Object.keys(me.children)[0];
        singleChild = me.children[singleChildName];
    }

    if (singleChildName && singleChild?.type === "directory") {
        return concatSubFolderNames(me, singleChildName, merged + name + " / ");
    } else {
        return [parent, name, merged + name];
    }
}
