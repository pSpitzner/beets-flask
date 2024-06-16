import { createFileRoute } from "@tanstack/react-router";

import { useSuspenseQuery } from "@tanstack/react-query";
import { tagGroupAllQueryOptions, tagGroupIdQueryOptions } from "@/lib/tag";
import TagGroupView from "@/components/common/tagGroupView";

import styles from "./tags.module.scss";

import { TagView } from "@/components/common/tagView";
import { Typography } from "@mui/material";

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
            <PredefinedTagGroup id="inbox" />
            <PredefinedTagGroup id="recent" />

            {manualTagGroups.map((group, i) => {
                const subtitle =
                    group.tag_ids.length === 1
                        ? "(1 tag)"
                        : `(${group.tag_ids.length} tags)`;

                return (
                    <TagGroupView key={i} title={group.id} subtitle={subtitle}>
                        {group.tag_ids.map((tagId, i) => (
                            <TagView key={i} tagId={tagId} />
                        ))}
                    </TagGroupView>
                );
            })}

            <PredefinedTagGroup id="archive" />
        </>
    );
}

function PredefinedTagGroup({ id }: { id: string }) {
    const query = useSuspenseQuery(tagGroupIdQueryOptions(id));
    const group = query.data;
    const title = id.charAt(0).toUpperCase() + id.slice(1);
    const subtitle =
        group.tag_ids.length === 1 ? "(1 tag)" : `(${group.tag_ids.length} tags)`;

    return (
        <TagGroupView
            title={title}
            subtitle={subtitle}
            disabled={group.tag_ids.length === 0}
        >
            {group.tag_ids.map((tagId, i) => (
                <TagView key={i} tagId={tagId} />
            ))}
        </TagGroupView>
    );
}
