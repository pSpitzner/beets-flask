import { queryOptions } from "@tanstack/react-query";

import {
    AlbumResponse,
    AlbumResponseExpanded,
    AlbumResponseMinimal,
    AlbumResponseMinimalExpanded,
    ItemResponse,
    ItemResponseMinimal,
    LibraryStats as _LibraryStats,
} from "@/pythonTypes";

export type LibraryStats = Omit<_LibraryStats, "lastItemAdded" | "lastItemModified"> & {
    lastItemAdded?: Date;
    lastItemModified?: Date;
};

// Some stats about the library
export const libraryStatsQueryOptions = () => {
    return queryOptions({
        queryKey: ["libraryStats"],
        queryFn: async () => {
            const response = await fetch(`/library/stats`);
            const dat = (await response.json()) as _LibraryStats;

            return {
                ...dat,
                lastItemAdded: dat.lastItemAdded
                    ? new Date(dat.lastItemAdded)
                    : undefined,
                lastItemModified: dat.lastItemModified
                    ? new Date(dat.lastItemModified)
                    : undefined,
            } as LibraryStats;
        },
    });
};

// Art for a library item or album
export const artQueryOptions = ({ type, id }: { type?: string; id?: number }) =>
    queryOptions({
        queryKey: ["art", type, id],
        queryFn: async () => {
            if (id === undefined || id === null) {
                return undefined;
            }
            console.log("artQueryOptions", type, id);
            const url = `/library/${type}/${id}/art`;
            const response = await fetch(url);
            const blob = await response.blob();
            const objectUrl = URL.createObjectURL(blob);
            return objectUrl;
        },
    });

// Artist names
export const artistsQueryOptions = () => ({
    queryKey: ["artists"],
    queryFn: async () => {
        const response = await fetch(`/library/artist/`);
        return (await response.json()) as { name: string }[];
    },
});

interface AlbumResponseFull extends AlbumResponse {
    [key: string]: unknown; // enable indexing album[key]
}

export type Album<
    Minimal extends boolean,
    Expand extends boolean,
> = Minimal extends true
    ? Expand extends true
        ? AlbumResponseMinimalExpanded
        : AlbumResponseMinimal
    : Expand extends true
      ? AlbumResponseExpanded
      : AlbumResponseFull;

export interface ItemResponseFull extends ItemResponse {
    [key: string]: unknown; // enable indexing item[key]
}

export type Item<Minimal extends boolean> = Minimal extends true
    ? ItemResponseMinimal
    : ItemResponseFull;

function _url_parse_minimal_expand(
    url: string,
    minimal: boolean = false,
    expand: boolean = false
) {
    const params = [];
    if (minimal) {
        params.push("minimal");
    }
    if (expand) {
        params.push("expand");
    }
    return params.length ? `${url}?${params.join("&")}` : url;
}

// All albums for a specific artist
export const albumsByArtistQueryOptions = <
    Expand extends boolean,
    Minimal extends boolean,
>(
    name: string,
    expand: Expand = true as Expand,
    minimal: Minimal = true as Minimal
) => ({
    queryKey: ["artist", name, expand, minimal],
    queryFn: async (): Promise<Album<typeof expand, typeof minimal>[]> => {
        const url = _url_parse_minimal_expand(
            `/library/artist/${name}/albums`,
            minimal,
            expand
        );
        const response = await fetch(url);
        return (await response.json()) as Album<typeof expand, typeof minimal>[];
    },
});

// An album by its ID
export const albumQueryOptions = <Expand extends boolean, Minimal extends boolean>(
    id: number,
    expand: Expand = true as Expand,
    minimal: Minimal = true as Minimal
) => ({
    queryKey: ["album", id, expand, minimal],
    queryFn: async (): Promise<Album<typeof expand, typeof minimal>> => {
        console.log("albumQueryOptions", id, expand, minimal);
        const url = _url_parse_minimal_expand(`/library/album/${id}`, minimal, expand);
        const response = await fetch(url);
        console.log("albumQueryOptions response", response);
        return (await response.json()) as Album<typeof expand, typeof minimal>;
    },
});

// An item by its ID
export const itemQueryOptions = <Minimal extends boolean>(
    id: number,
    minimal: Minimal = true as Minimal
) => ({
    queryKey: ["item", id, minimal],
    queryFn: async (): Promise<Item<typeof minimal>> => {
        const url = _url_parse_minimal_expand(`/library/item/${id}`, minimal);
        const response = await fetch(url);
        return (await response.json()) as Item<typeof minimal>;
    },
});

// Search for an item or album
export const searchQueryOptions = <T extends "item" | "album">(
    searchFor: string,
    type: T
) =>
    queryOptions({
        queryKey: ["search", type, searchFor],
        queryFn: async ({ signal }) => {
            const expand = false;
            const minimal = true;
            const url = _url_parse_minimal_expand(
                `/library/${type}/query/${encodeURIComponent(searchFor)}`,
                minimal,
                expand
            );
            const response = await fetch(url, { signal });
            return (await response.json()) as (T extends "item"
                ? Item<true>
                : Album<true, false>)[];
        },
    });

// An album imported by us
export const albumImportedOptions = <Expand extends boolean, Minimal extends boolean>(
    task_id: string,
    expand: Expand = true as Expand,
    minimal: Minimal = true as Minimal
) => ({
    queryKey: ["album", task_id, expand, minimal],
    queryFn: async (): Promise<Album<typeof expand, typeof minimal>> => {
        const url = _url_parse_minimal_expand(
            `/library/album/bf_id/${task_id}`,
            minimal,
            expand
        );
        const response = await fetch(url);
        return (await response.json()) as Album<typeof expand, typeof minimal>;
    },
});
