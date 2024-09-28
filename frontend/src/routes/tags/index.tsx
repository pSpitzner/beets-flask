import { ComponentProps } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import {
    tagGroupAllQueryOptions,
    tagGroupIdQueryOptions,
} from "@/components/common/_query";
import { SiblingRefsProvider } from "@/components/common/hooks/useSiblings";
import { PageWrapper } from "@/components/common/page";
import TagGroupView from "@/components/tags/tagGroupView";
import { TagView } from "@/components/tags/tagView";

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
        <PageWrapper>
            <PredefinedTagGroup id="inbox" defaultExpanded />
            <PredefinedTagGroup id="recent" />
            <PredefinedTagGroup id="archive" />

            {manualTagGroups.map((group, i) => {
                return <ManualTagGroup key={i} id={group.id} tag_ids={group.tag_ids} />;
            })}
        </PageWrapper>
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
} & Omit<ComponentProps<typeof TagGroupView>, "children">) {
    return (
        <TagGroupView
            title={title}
            subtitle={subtitle}
            disabled={tag_ids.length === 0}
            {...props}
        >
            <SiblingRefsProvider>
                {tag_ids.map((tagId, i) => (
                    <TagView key={i} tagId={tagId} />
                ))}
            </SiblingRefsProvider>
        </TagGroupView>
    );
}

function PredefinedTagGroup({
    id,
    ...props
}: { id: string } & Partial<ComponentProps<typeof TagGroup>>) {
    const query = useSuspenseQuery(tagGroupIdQueryOptions(id));
    const group = query.data;
    const tag_ids = group.tag_ids;
    const title = id.charAt(0).toUpperCase() + id.slice(1);
    const subtitle = tag_ids.length === 1 ? "(1 tag)" : `(${tag_ids.length} tags)`;

    return <TagGroup tag_ids={tag_ids} title={title} subtitle={subtitle} {...props} />;
}
