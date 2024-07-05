import { createFileRoute } from "@tanstack/react-router";

import { useSuspenseQuery } from "@tanstack/react-query";
import { tagGroupAllQueryOptions, tagGroupIdQueryOptions } from "@/lib/tag";
import TagGroupView from "@/components/common/tagGroupView";

import { TagView } from "@/components/common/tagView";
import { SiblingRefsProvider } from "@/components/context/useSiblings";
import { createRef, useMemo } from "react";

export const Route = createFileRoute("/tags/")({
    loader: (opts) =>
        opts.context.queryClient.ensureQueryData(tagGroupAllQueryOptions()),
    component: () => <TagGroupOverview />,
});

export function TagGroupOverview() {
    const query = useSuspenseQuery(tagGroupAllQueryOptions());
    const manualTagGroups = query.data;

    if (manualTagGroups.length === 0) {
        // since every tag has a default group, this is sufficent and we do not need
        //  to check our special groups separately.
        return (
            <div className="flex items-center justify-center">
                <div>No tags yet</div>
            </div>
        );
    }

    return (
        <>
            <PredefinedTagGroup id="inbox" defaultExpanded />
            <PredefinedTagGroup id="recent" />
            <PredefinedTagGroup id="archive" />

            {manualTagGroups.map((group, i) => {
                return <ManualTagGroup key={i} id={group.id} tag_ids={group.tag_ids} />;
            })}

        </>
    );
}

export function ManualTagGroup({ id, tag_ids }: { id: string; tag_ids: string[] }) {
    const title = id;
    const subtitle = tag_ids.length === 1 ? "(1 tag)" : `(${tag_ids.length} tags)`;

    return <TagGroup tag_ids={tag_ids} title={title} subtitle={subtitle} />;
}

function TagGroup({
    tag_ids,
    title,
    subtitle,
    ...props
}: {
    tag_ids: string[];
    title?: string;
    subtitle?: string;
    [key: string]: any;
}) {
    const tagRefs = useMemo(() => tag_ids.map(() => createRef()), [tag_ids]);
    return (
        <TagGroupView
            title={title}
            subtitle={subtitle}
            disabled={tag_ids.length === 0}
            {...props}
        >
            <SiblingRefsProvider>
                {tag_ids.map((tagId, i) => (
                    <TagView key={i} tagId={tagId} ref={tagRefs[i]} />
                ))}
            </SiblingRefsProvider>
        </TagGroupView>
    );
}

function PredefinedTagGroup({ id, ...props }: { id: string; [key: string]: any }) {
    const query = useSuspenseQuery(tagGroupIdQueryOptions(id));
    const group = query.data;
    const tag_ids = group.tag_ids;
    const title = id.charAt(0).toUpperCase() + id.slice(1);
    const subtitle = tag_ids.length === 1 ? "(1 tag)" : `(${tag_ids.length} tags)`;

    return <TagGroup tag_ids={tag_ids} title={title} subtitle={subtitle} {...props} />;
}
