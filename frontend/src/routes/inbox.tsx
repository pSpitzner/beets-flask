import { createFileRoute } from "@tanstack/react-router";

import { useSuspenseQuery } from "@tanstack/react-query";
import { inboxQueryOptions } from "../lib/queryOptions";

import { FsPath } from "../lib/inbox";

export const Route = createFileRoute("/inbox")({
    loader: (opts) => opts.context.queryClient.ensureQueryData(inboxQueryOptions()),

    component: () => <Inbox />,
});

export function Inbox() {
    const query = useSuspenseQuery(inboxQueryOptions());

    console.log(query.data);
    return (
        <div>
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
}: {
    fp: FsPath;
    label?: string;
    mergeLabels?: boolean;
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
                    FolderView({ fp: subFp.children[subName], label: mergedNname })
                );
            }
        } else {
            subViews.push(FileView({ fp: fp.children[name] }));
        }
    }

    return (
        <div key={fp.full_path} className="ml-4">
            <span>{label}</span>
            {subViews}
        </div>
    );
}

export function FileView({ fp: fp }: { fp: FsPath }): JSX.Element {
    if (fp.type !== "file") {
        throw new TypeError("Expected a file, got a directory");
    }
    const fileName = fp.full_path.split("/").pop();
    return (
        <div key={fp.full_path} className="ml-4">
            <span>{fileName}</span>
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
