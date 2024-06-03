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

export async function fetchTagById(tagId: string): Promise<TagI> {
    const response = await fetch(`/tag/id/${tagId}`);
    if (!response.ok) {
        throw new Error("Network response was not ok");
    }
    try {
        return (await response.json()) as TagI;
    } catch (e) {
        throw new Error("Failed to parse response as JSON in fetchTagById()");
    }
}

export const tagIdQueryOptions = (tagId: string) => {
    return queryOptions({
        queryKey: ["tag", "id", tagId],
        queryFn: () => fetchTagById(tagId),
    });
};

export async function fetchTagByPath(folderPath: string): Promise<TagI> {
    const response = await fetch(`/tag/path/${folderPath}`);
    if (!response.ok) {
        throw new Error("Network response was not ok");
    }
    try {
        return (await response.json()) as TagI;
    } catch (e) {
        throw new Error("Failed to parse response as JSON in fetchTagByPath()");
    }
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
    if (!response.ok) {
        throw new Error("Network response was not ok");
    }
    try {
        return (await response.json()) as TagGroupI;
    } catch (e) {
        throw new Error("Failed to parse response as JSON in fetchTagGroupById()");
    }
}

export const tagGroupIdQueryOptions = (tagGroupId: string) => {
    return queryOptions({
        queryKey: ["tagGroup", "id", tagGroupId],
        queryFn: () => fetchTagGroupById(tagGroupId),
    });
};

export async function fetchAllTagGroups(): Promise<TagGroupI[]> {
    const response = await fetch(`/tagGroup`);
    if (!response.ok) {
        throw new Error("Network response was not ok");
    }
    try {
        return (await response.json()) as TagGroupI[];
    } catch (e) {
        throw new Error("Failed to parse response as JSON in fetchTagAllGroups()");
    }
}

export const tagGroupAllQueryOptions = () => {
    return queryOptions({
        queryKey: ["tagGroup", "all"],
        queryFn: () => fetchAllTagGroups(),
    });
};
