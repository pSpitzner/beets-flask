import { createFileRoute } from "@tanstack/react-router";

import {
    UseMutationOptions,
    useMutation,
    useSuspenseQuery,
} from "@tanstack/react-query";
import { TagI, TagGroupI } from "../lib/tag";
import { fetchTagById, fetchAllTagGroups, fetchTagGroupById } from "../lib/tag";
import {
    tagIdQueryOptions,
    tagGroupAllQueryOptions,
    tagGroupIdQueryOptions,
} from "../lib/tag";

import styles from "./inbox.module.scss";

import { TagView } from "@/components/common/tagView";

export const Route = createFileRoute("/tagGroup")({
    loader: (opts) =>
        opts.context.queryClient.ensureQueryData(tagGroupAllQueryOptions()),
    component: () => <TagGroupOverview />,
});

export function TagGroupOverview() {
    const query = useSuspenseQuery(tagGroupAllQueryOptions());

    return (
        <div>
            {query.data.map((tg) => (
                <TagGroupView tg={tg} />
            ))}
        </div>
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
export function TagGroupView({ tg }: { tg: TagGroupI }) {
    return (
        <div>
            <div className={styles.tagGroupView}>
                {tg.id}
                {tg.tag_ids.map((tagId) => (
                    <TagView tagId={tagId} />
                ))}
            </div>
        </div>
    );
}
