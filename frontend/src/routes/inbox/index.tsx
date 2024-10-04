import { ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { Card, Typography } from "@mui/material";
import * as Collapsible from "@radix-ui/react-collapsible";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { FsPath, inboxQueryByPathOptions } from "@/components/common/_query";
import { ContextMenu, defaultActions, SelectionSummary } from "@/components/common/contextMenu";
import { MinimalConfig, useConfig } from "@/components/common/hooks/useConfig";
import { SelectionProvider, useSelection } from "@/components/common/hooks/useSelection";
import { PageWrapper } from "@/components/common/page";
import { TagSimilarityBadgeWithHover } from "@/components/tags/similarityBadge";
import { TagStatusIcon } from "@/components/tags/statusIcon";

import styles from "@/components/inbox/inbox.module.scss";

export const Route = createFileRoute("/inbox/")({
    component: Inboxes,
});

function Inboxes() {
    const config = useConfig();
    const inboxes = config.gui.inbox.folders;

    if (Object.keys(inboxes).length == 0) {
        return <>No inboxes found. Check your config!</>;
    }

    return (
        <PageWrapper>
            {Object.values(inboxes).map((inbox, i) => {
                return <Inbox key={i} name={inbox.name} path={inbox.path} />;
            })}
        </PageWrapper>
    );
}

function Inbox({ name, path }: { name: string; path: string }) {
    const { data, isLoading, isPending, isError, error } = useQuery(inboxQueryByPathOptions(path));

    const heading = (
        <Typography gutterBottom variant="h6" component="div">
            {name}
        </Typography>
    );

    if (isLoading || isPending) {
        return (
            <Card className={styles.inboxView}>
                {heading}
                <>Loading ...</>
            </Card>
        );
    }

    if (isError) {
        return (
            <Card className={styles.inboxView}>
                {heading}
                Error: {error.message}
            </Card>
        );
    }

    return (
        <SelectionProvider>
            <Card className={styles.inboxView}>
                {heading}
                <FolderTreeView fp={data} />
            </Card>
        </SelectionProvider>
    );
}

function FolderTreeView({
    fp,
    label,
    level = 0,
}: {
    fp: FsPath;
    label?: string;
    level?: number;
}): React.ReactNode {
    const config = useConfig();
    const defaultExpandState = fp.is_album && !config.gui.inbox.expand_files ? false : true;
    const [expanded, setExpanded] = useState<boolean>(defaultExpandState);
    const numChildren = Object.keys(fp.children).length;
    const uid = `collapsible-${fp.full_path}`;

    useEffect(() => {
        const savedState = localStorage.getItem(uid);
        if (savedState !== null) {
            setExpanded(JSON.parse(savedState) as boolean);
        }
    }, [uid]);

    const handleExpandedChange = (isOpen: boolean) => {
        setExpanded(isOpen);
        localStorage.setItem(uid, JSON.stringify(isOpen));
    };

    if (fp.type === "file") {
        return <File fp={fp} />;
    }

    return (
        <div className={styles.folder} data-empty={numChildren < 1}>
            <Collapsible.Root open={expanded} onOpenChange={handleExpandedChange}>
                <ContextMenu
                    className={styles.contextMenuHeaderWrapper}
                    identifier={fp.full_path}
                    actions={[<SelectionSummary key={0} />, ...defaultActions]}
                >
                    <Folder fp={fp} label={label ?? fp.full_path.replaceAll("/", " / ")} />
                </ContextMenu>
                <Collapsible.Content className={styles.content}>
                    <SubFolders fp={fp} level={level} />
                </Collapsible.Content>
            </Collapsible.Root>
        </div>
    );
}

function SubFolders({ fp, level }: { fp: FsPath; level: number }) {
    const config = useConfig();
    return (
        <>
            {Object.keys(fp.children).map((name) => {
                const child = fp.children[name];
                const [subFp, subName, mergedName] = concatSubFolderNames(fp, name, config);
                // enable line wrapping
                return (
                    <FolderTreeView
                        key={child.full_path}
                        fp={subFp.children[subName]}
                        label={mergedName}
                        level={level + 1}
                    />
                );
            })}
        </>
    );
}

// actual content, wrapped by the context menu
function Folder({ fp, label }: { fp: FsPath; label: string }) {
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
    }, [fp.full_path, fp.is_album, markSelectable, numChildren]);

    return (
        <div
            key={`folder-${fp.full_path}`}
            className={styles.header}
            data-selected={isSelected(fp.full_path)}
            onClick={handleSelect}
        >
            {numChildren > 0 ? (
                <Collapsible.Trigger
                    asChild
                    className={styles.trigger}
                    onClick={(e) => {
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
                    <TagStatusIcon className={styles.albumIcon} tagPath={fp.full_path} />
                    <TagSimilarityBadgeWithHover tagPath={fp.full_path} />
                </div>
            )}

            <span className={styles.label}>
                <WrapableAtSlash label={label} />
            </span>
        </div>
    );
}

function WrapableAtSlash({ label }: { label: string }) {
    return (
        <>
            {label.split(" / ").map((part, i, arr) => (
                <span key={i}>
                    {part}
                    {i < arr.length - 1 && " / "}
                </span>
            ))}
        </>
    );
}

function File({ fp: fp }: { fp: FsPath }): JSX.Element {
    if (fp.type !== "file") {
        throw new TypeError("Expected a file, got a directory");
    }
    const fileName = fp.full_path.split("/").pop();
    return (
        <div key={`file-${fp.full_path}`} className={styles.file}>
            <div>{fileName}</div>
        </div>
    );
}

function concatSubFolderNames(
    parent: FsPath,
    name: string,
    config: MinimalConfig,
    merged = ""
): [FsPath, string, string] {
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
        return concatSubFolderNames(me, singleChildName, config, merged + name + " / ");
    } else {
        return [parent, name, merged + name];
    }
}
