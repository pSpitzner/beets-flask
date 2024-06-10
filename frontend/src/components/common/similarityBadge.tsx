// TODO: get them from backend beets: beets.config["match"]["strong_rec_thresh"]
const strong_rec_thresh = 0.04;
const medium_rec_thresh = 0.25;

import { useQuery } from "@tanstack/react-query";
import styles from "./similarityBadge.module.scss";
import { tagQueryOptions } from "@/lib/tag";

import * as HoverCard from "@radix-ui/react-hover-card";

import { TagPreview } from "./tagView";

export function SimilarityBadgeWithHover({
    tagId,
    tagPath,
    className,
}: {
    tagId?: string;
    tagPath?: string;
    className?: string;
}) {
    // query if tagId or tagPath is provided, otherwise assume and use provided dist and preview
    const { data, isLoading, isPending, isError } = useQuery(
        tagQueryOptions(tagId, tagPath)
    );

    if (isLoading || isPending || isError) {
        return <SimilarityBadge dist={undefined} className={className} />;
    }

    if (!data?.preview) {
        // without preview, hover makes no sense
        return <SimilarityBadge dist={data?.distance} className={className} />;
    }

    return (
        <HoverCard.Root openDelay={300}>
            <HoverCard.Trigger className={styles.hoverTrigger}>
                <SimilarityBadge dist={data.distance} className={className} />
            </HoverCard.Trigger>
            <HoverCard.Content
                side="right"
                sideOffset={0}
                alignOffset={15}
                align="start"
                className={styles.HoverContent}
            >
                <TagPreview tagId={tagId} tagPath={tagPath} />
            </HoverCard.Content>
        </HoverCard.Root>
    );
}

export function SimilarityBadge({
    dist,
    className,
}: {
    dist?: number;
    className?: string;
}) {
    if (dist == undefined) {
        return (
            <span className={`${className} ${styles.SimilarityBadge} ${styles.tbd}`}>
                tbd
            </span>
        );
    }

    const sim = `${Math.floor((1 - dist) * 100)}%`;
    if (dist <= strong_rec_thresh) {
        return (
            <span className={`${className} ${styles.SimilarityBadge} ${styles.strong}`}>
                {sim}
            </span>
        );
    } else if (dist <= medium_rec_thresh) {
        return (
            <span className={`${className} ${styles.SimilarityBadge} ${styles.medium}`}>
                {sim}
            </span>
        );
    } else {
        return (
            <span className={`${className} ${styles.SimilarityBadge} ${styles.weak}`}>
                {sim}
            </span>
        );
    }
}
