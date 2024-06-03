import { useSuspenseQuery } from "@tanstack/react-query";
import Ansi from "@curvenote/ansi-to-react";
import styles from "./tagView.module.scss";

import { TagI } from "@/lib/tag";
import { tagIdQueryOptions, tagPathQueryOptions } from "@/lib/tag";

export function TagView({ tagId, tagPath }: { tagId?: string; tagPath?: string }) {
    if (!tagId && !tagPath) {
        throw new Error("TagPreview requires either a tagId or tagPath");
    }

    const query = useSuspenseQuery(
        tagId ? tagIdQueryOptions(tagId) : tagPathQueryOptions(tagPath!)
    );

    return (
        <div className={styles.tagView}>
            <div className={styles.tagHeading}>{query.data.album_folder_basename}</div>
            <div className={styles.tagContent}>
                <TagPreview preview={query.data.preview} />
            </div>
        </div>
    );
}

export const TagPreview = ({
    tagId,
    tagPath,
    preview,
}: {
    tagId?: string;
    tagPath?: string;
    preview?: string;
}) => {
    let content: string = "";
    if (tagId) {
        const query = useSuspenseQuery(tagIdQueryOptions(tagId));
        content = query.data.preview as string;
    } else if (tagPath) {
        const query = useSuspenseQuery(tagPathQueryOptions(tagPath));
        content = query.data.preview as string;
    } else {
        content = preview as string;
    }

    return (
        <div className={styles.tagPreview}>
            {content ? <Ansi useClasses>{content}</Ansi> : <div>...</div>}
        </div>
    );
};
