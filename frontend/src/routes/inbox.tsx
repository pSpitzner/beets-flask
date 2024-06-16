import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { FsPath, inboxQueryOptions } from "@/lib/inbox";
import { TagStatusIcon } from "@/components/common/statusIcon";
import { SimilarityBadgeWithHover } from "@/components/common/similarityBadge";
import ContextMenu from "@/components/common/contextMenu";

import styles from "./inbox.module.scss";
import { ChevronRight } from "lucide-react";

import * as Collapsible from "@radix-ui/react-collapsible";

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
    label?: string | JSX.Element;
    mergeLabels?: boolean;
    level?: number;
}): JSX.Element {
    // selecting rows
    const [isSelected, setIsSelected] = useState(false);
    const handleSelect = () => {
        if (fp.is_album) {
            setIsSelected(!isSelected);
        }
    };

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
                        <FolderView
                            key={mergedName}
                            fp={subFp.children[subName]}
                            label={mergedNameJsx}
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
                <ContextMenu className={styles.contextMenuHeaderWrapper} fp={fp}>
                    <div
                        key={fp.full_path}
                        className={styles.header}
                        data-selected={isSelected}
                        onClick={handleSelect}
                    >
                        <Collapsible.Trigger
                            asChild
                            className={styles.trigger}
                            disabled={numChildren < 1}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <ChevronRight />
                        </Collapsible.Trigger>

                        {fp.is_album && (
                            <div className={styles.albumIcons}>
                                <TagStatusIcon tagPath={fp.full_path} />
                                <SimilarityBadgeWithHover tagPath={fp.full_path} />
                                {/* <ActionMenu fp={fp} /> */}
                            </div>
                        )}

                        <span className={styles.label}>{label}</span>
                    </div>
                </ContextMenu>
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
