import { useQuery } from "@tanstack/react-query";
import Ansi from "@curvenote/ansi-to-react";
import styles from "./tagView.module.scss";

import { tagQueryOptions } from "@/lib/tag";
import { APIError } from "@/lib/fetch";

export function TagView({ tagId, tagPath }: { tagId?: string; tagPath?: string }) {
    if (!tagId && !tagPath) {
        throw new Error("TagView requires either a tagId or tagPath");
    }

    const { data, isLoading, isPending, isError } = useQuery(
        tagQueryOptions(tagId, tagPath)
    );

    if (isLoading || isPending) {
        return <div>Loading...</div>;
    }
    if (isError) {
        return <div>Error...</div>;
    }

    return (
        <div className={styles.tagView}>
            <div className={styles.tagHeading}>{data.album_folder_basename}</div>
            <div className={styles.tagContent}>
                <TagPreview tagId={tagId} tagPath={tagPath} />
            </div>
        </div>
    );
}

export const TagPreview = ({
    tagId,
    tagPath,
}: {
    tagId?: string;
    tagPath?: string;
}) => {
    const { data, isLoading, isPending, isError, error } = useQuery(
        tagQueryOptions(tagId, tagPath)
    );

    if (isLoading || isPending) {
        return <div className={styles.tagPreview}>Loading...</div>;
    }
    if (isError && error instanceof APIError) {
        return <div className={styles.tagPreview}>APIError...</div>;
    } else if (isError) {
        return <div className={styles.tagPreview}>Error...</div>;
    }

    const content = data.preview ?? "...";

    return (
        <div className={styles.tagPreview}>
            <Ansi useClasses>{content}</Ansi>
        </div>
    );
};
