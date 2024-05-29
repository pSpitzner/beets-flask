import { createFileRoute } from "@tanstack/react-router";
import "./inbox.scss";

import { useSuspenseQuery } from "@tanstack/react-query";
import { inboxQueryOptions } from "../lib/queryOptions";
import { FsPath } from "../lib/inbox";
import * as Collapsible from "@radix-ui/react-collapsible";
import { TriangleRightIcon } from "@radix-ui/react-icons";
import { StatusIcon } from "../components/common/statusIcon";
import { SimilarityBadge } from "../components/common/similarityBadge";

export const Route = createFileRoute("/inbox")({
    loader: (opts) => opts.context.queryClient.ensureQueryData(inboxQueryOptions()),
    component: () => <Inbox />,
});

export function Inbox() {
    const query = useSuspenseQuery(inboxQueryOptions());

    console.log(query.data);

    return (
        <div>
            <div className="InboxView">
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
    mergeLabels?: Boolean;
    level?: number;
}): JSX.Element {
    if (fp.type === "file") {
        return FileView({ fp: fp });
    }

    let subViews: JSX.Element[] = [];

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
        <div className={subViews.length > 0 ? "InboxFolder" : "InboxFolder Empty"}>
            <Collapsible.Root defaultOpen>
                <div key={fp.full_path} className="InboxFolderHeader">
                    {subViews.length > 0 ? (
                        <Collapsible.Trigger className="InboxFolderCollapseTrigger">
                            <TriangleRightIcon />
                        </Collapsible.Trigger>
                    ) : (
                        <TriangleRightIcon />
                    )}

                    {fp.is_album && <StatusIcon status="unknown" className="me-2" />}
                    {fp.is_album && <SimilarityBadge dist={null} className="me-2" />}
                    <div>{label}</div>
                </div>
                {subViews.length > 0 && (
                    <Collapsible.Content className="CollapsibleContent">
                        <div className="InboxFolderContent">{subViews}</div>
                    </Collapsible.Content>
                )}
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
        <div key={fp.full_path} className="InboxFile">
            <div>{fileName}</div>
        </div>
    );
}

function mergeSubFolderNames(
    parent: FsPath,
    name: string,
    merged: string = ""
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
