import Box from "@mui/material/Box";
import * as HoverCard from "@radix-ui/react-hover-card";
import { useQuery } from "@tanstack/react-query";

import { tagQueryOptions } from "@/components/common/_query";
import { useConfig } from "@/components/common/hooks/useConfig";

import { TagPreview } from "./tagView";

import "@/main.css";
import styles from "./similarityBadge.module.scss";

export function TagSimilarityBadgeWithHover({
    tagId,
    tagPath,
    className,
    charWidth = 3,
}: {
    tagId?: string;
    tagPath?: string;
    className?: string;
    charWidth?: number;
}) {
    // query if tagId or tagPath is provided, otherwise assume and use provided dist and preview
    const { data, isLoading, isPending, isError } = useQuery(
        tagQueryOptions(tagId, tagPath)
    );

    if (isLoading || isPending || isError) {
        return (
            <SimilarityBadge
                dist={undefined}
                className={className}
                charWidth={charWidth}
            />
        );
    }

    if (!data?.preview) {
        // without preview, hover makes no sense
        return (
            <SimilarityBadge
                dist={data?.distance}
                className={className}
                charWidth={charWidth}
            />
        );
    }

    return (
        <SimilarityBadgeWithHover
            dist={data.distance}
            className={className}
            charWidth={charWidth}
        >
            <TagPreview tagId={tagId} tagPath={tagPath} />
        </SimilarityBadgeWithHover>
    );
}

export function SimilarityBadgeWithHover({
    dist,
    className,
    children,
    charWidth = 3,
}: {
    dist?: number;
    className?: string;
    children: React.ReactNode;
    charWidth?: number;
}) {
    return (
        <HoverCard.Root openDelay={300}>
            <HoverCard.Trigger>
                <SimilarityBadge
                    dist={dist}
                    className={className}
                    charWidth={charWidth}
                />
            </HoverCard.Trigger>
            <HoverCard.Content
                side="right"
                sideOffset={0}
                alignOffset={15}
                align="start"
                className={"HoverContent"}
            >
                {children}
            </HoverCard.Content>
        </HoverCard.Root>
    );
}

export function SimilarityBadge({
    dist,
    className,
    charWidth = 3,
}: {
    dist?: number;
    className?: string;
    charWidth?: number;
}) {
    const config = useConfig();
    const strong_rec_thresh = config?.match.strong_rec_thresh || 0.04;
    const medium_rec_thresh = config?.match.medium_rec_thresh || 0.025;

    let simClass = styles.tbd; // Default class
    let simText = "tbd"; // Default text

    if (dist !== undefined && dist !== null) {
        const simPercentage = `${Math.floor((1 - dist) * 100)}%`;
        simText = simPercentage;

        if (dist <= strong_rec_thresh) {
            simClass = styles.strong;
        } else if (dist <= medium_rec_thresh) {
            simClass = styles.medium;
        } else {
            simClass = styles.weak;
        }
    }

    const combinedClassName = `${className ? `${className} ` : ""}${styles.SimilarityBadgeInner} ${simClass}`;

    return (
        <Box
            sx={{
                width: `calc(${charWidth}ch + 0.6rem)`,
            }}
            className={styles.SimilarityBadgeOuter}
        >
            <Box className={combinedClassName}>{simText}</Box>
        </Box>
    );
}

export function SimilarityBadgeWithText({
    text,
    color,
    className,
    charWidth = 3,
}: {
    text?: string;
    color?: "strong" | "medium" | "weak" | "tbd" | "custom";
    className?: string;
    charWidth?: number;
}) {
    let simClass = styles.tbd;
    switch (color) {
        case "strong":
            simClass = styles.strong;
            break;
        case "medium":
            simClass = styles.medium;
            break;
        case "weak":
            simClass = styles.weak;
            break;
        case "custom":
            simClass = styles.custom;
            break;
        default:
            simClass = styles.tbd;
    }

    const combinedClassName = `${className ? `${className} ` : ""}${styles.SimilarityBadgeInner} ${simClass}`;

    return (
        <Box
            sx={{
                width: `calc(${charWidth}ch + 0.6rem)`,
            }}
            className={styles.SimilarityBadgeOuter}
        >
            <Box className={combinedClassName}>{text}</Box>
        </Box>
    );
}
