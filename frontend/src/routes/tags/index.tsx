import { createFileRoute } from "@tanstack/react-router";

import { useSuspenseQuery } from "@tanstack/react-query";
import { TagGroupI } from "@/lib/tag";
import { tagGroupAllQueryOptions } from "@/lib/tag";
import TagGroupView from "@/components/common/tagGroupView";

import styles from "./tags.module.scss";

import { TagView } from "@/components/common/tagView";

export const Route = createFileRoute("/tags/")({
    loader: (opts) =>
        opts.context.queryClient.ensureQueryData(tagGroupAllQueryOptions()),
    component: () => <TagGroupOverview />,
});

export function TagGroupOverview() {
    const query = useSuspenseQuery(tagGroupAllQueryOptions());
    const tagGroups = query.data;

    if (tagGroups.length === 0) {
        return (
            <div className="flex items-center justify-center">
                <div>No tags yet</div>
            </div>
        );
    }

    return (
        <>
            {tagGroups.map((group, i) => (
                <TagGroupView key={i} title={group.id}>
                    {group.tag_ids.map((tagId, i) => (
                        <TagView key={i} tagId={tagId} />
                    ))}
                </TagGroupView>
            ))}
        </>
    );
}

/**
 * Renders a view for a tag group.
 * It recursively generates views for sub tag groups and tags within the tag group.
 *
 * @param {Object} props - The properties passed to the component.
 * @param {TagGroupI} props.tagGroup - The tag group object representing the tag group.
 *
 * @returns {JSX.Element} A JSX element representing the view for the tag group.
 */
export function TagGroupViewOld({ tg }: { tg: TagGroupI }) {
    return (
        <div>
            <div className={styles.tagGroupView}>
                {tg.id}
                {tg.tag_ids.map((tagId, i) => (
                    <TagView key={i} tagId={tagId} />
                ))}
            </div>
        </div>
    );
}
