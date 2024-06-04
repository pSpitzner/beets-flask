// TODO: get them from backend beets: beets.config["match"]["strong_rec_thresh"]
const strong_rec_thresh = 0.04;
const medium_rec_thresh = 0.25;

import { useSuspenseQuery } from "@tanstack/react-query";
import styles from "./similarityBadge.module.scss";
import { tagIdQueryOptions, tagPathQueryOptions } from "@/lib/tag";

import * as HoverCard from "@radix-ui/react-hover-card";
import { TagPreview } from "./tagView";

export function SimilarityBadge({
    dist,
    className,
}: {
    dist: null | number;
    className?: string;
}) {
    if (dist === null) {
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

export function SimilarityBadgeWithHover({
    tagId,
    tagPath,
    dist,
    preview,
    className,
}: {
    tagId?: string;
    tagPath?: string;
    dist?: null | number;
    preview?: string;
    className?: string;
}) {
    // query if tagId or tagPath is provided, otherwise assume and use provided dist and preview
    preview = preview as string;
    dist = dist as null | number;
    try {
        let query;
        if (tagId) {
            query = useSuspenseQuery(tagIdQueryOptions(tagId));
        } else if (tagPath) {
            query = useSuspenseQuery(tagPathQueryOptions(tagPath));
        }
        dist = dist || (query?.data.distance as null | number);
        preview = preview || (query?.data.preview as string);
    } catch (error) {
        dist = null;
        preview = "";
    }

    if (!preview) {
        // without preview, hover makes no sense
        return <SimilarityBadge dist={dist} className={className} />;
    }

    return (
        <HoverCard.Root openDelay={300}>
            <HoverCard.Trigger className={styles.hoverTrigger}>
                <SimilarityBadge dist={dist} className={className} />
            </HoverCard.Trigger>
            <HoverCard.Content
                side="right"
                sideOffset={0}
                alignOffset={15}
                align="start"
                className={styles.HoverContent}
            >
                <TagPreview preview={preview} />
            </HoverCard.Content>
        </HoverCard.Root>
    );
}
