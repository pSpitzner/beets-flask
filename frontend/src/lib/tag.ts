import { queryOptions } from "@tanstack/react-query";

export interface TagI {
    id: string;
    album_folder: string;
    album_folder_basename: string;
    status: string;
    kind: string;
    group_id: string;

    created_at: Date;
    updated_at: Date;

    distance?: number;
    match_url?: string;
    match_artist?: string;
    match_album?: string;
    preview?: string;
    num_tracks?: number;
}

// empty return if the tag is not in the database
type TagResponse = TagI | Record<string, never>;

export async function fetchTagById(tagId: string): Promise<TagResponse> {
    const response = await fetch(`/tag/id/${tagId}`);
    return (await response.json()) as TagResponse;
}

export const tagQueryOptions = (tagId?: string, tagPath?: string) => {
    if (!tagId && !tagPath) {
        throw new Error("tagId or tagPath must be specified in tagIdQueryOptions()");
    }

    return queryOptions({
        // invalidation -> tag
        queryKey: ["tag", tagId ?? tagPath],
        queryFn: () => {
            if (tagId) {
                return fetchTagById(tagId);
            } else {
                return fetchTagByPath(tagPath!);
            }
        },
    });
};

export async function fetchTagByPath(folderPath: string): Promise<TagResponse> {
    if (folderPath.startsWith("/")) folderPath = folderPath.slice(1);
    const response = await fetch(`/tag/path/${folderPath}`, {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
        },
    });
    return (await response.json()) as TagI;
}

export const tagPathQueryOptions = (path: string) => {
    return queryOptions({
        queryKey: ["tag", "path", path],
        queryFn: () => fetchTagByPath(path),
    });
};

export interface TagGroupI {
    id: string;
    tag_ids: string[];
}

export async function fetchTagGroupById(tagGroupId: string): Promise<TagGroupI> {
    const response = await fetch(`/tagGroup/id/${tagGroupId}`);
    return (await response.json()) as TagGroupI;
}

export const tagGroupIdQueryOptions = (tagGroupId: string) => {
    return queryOptions({
        queryKey: ["tagGroup", "id", tagGroupId],
        queryFn: () => fetchTagGroupById(tagGroupId),
    });
};

export async function fetchAllTagGroups(): Promise<TagGroupI[]> {
    const response = await fetch(`/tagGroup`);
    return (await response.json()) as TagGroupI[];
}

export const tagGroupAllQueryOptions = () => {
    return queryOptions({
        queryKey: ["tagGroup", "all"],
        queryFn: () => fetchAllTagGroups(),
    });
};
