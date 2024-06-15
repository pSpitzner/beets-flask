import { queryOptions } from "@tanstack/react-query";

export interface MinimalArtist {
    name: string;
    albums: MinimalAlbum[];
}

export interface MinimalAlbum {
    id: number;
    name: string;
}

export interface Album extends MinimalAlbum {
    items: MinimalItem[];
}

export interface MinimalItem {
    id: number;
    name: string;
}

export interface Item extends MinimalItem {
    album?: string;
    album_id?: number;
    artist?: string;
    artist_sort?: string;
    artist_ids?: number[];
    isrc?: string;
}

function _url_parse_minimal_expand(
    url: string,
    { minimal, expand }: { minimal: boolean; expand: boolean }
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

export const artistsQueryOptions = () =>
    queryOptions({
        queryKey: ["artists"],
        queryFn: () => fetchArtists(),
    });

export async function fetchArtists(): Promise<MinimalArtist[]> {
    const response = await fetch(`/library/artist/`);
    return (await response.json()) as MinimalArtist[];
}

export const artistQueryOptions = ({
    name,
    expand = false,
    minimal = true,
}: {
    name: string;
    expand?: boolean;
    minimal?: boolean;
}) =>
    queryOptions({
        queryKey: ["artist", name, expand, minimal],
        queryFn: () => fetchArtist({ name, expand, minimal }),
    });

export async function fetchArtist({
    name,
    expand = false,
    minimal = true,
}: {
    name: string;
    expand?: boolean;
    minimal?: boolean;
}): Promise<MinimalArtist> {
    let url = _url_parse_minimal_expand(`/library/artist/${name}`, { expand, minimal });
    const response = await fetch(url);
    return (await response.json()) as MinimalArtist;
}

export const albumQueryOptions = ({
    id,
    expand = true,
    minimal = true,
}: {
    id: number;
    expand?: boolean;
    minimal?: boolean;
}) =>
    queryOptions({
        queryKey: ["album", id, expand, minimal],
        queryFn: () => fetchAlbum({ id, expand, minimal }),
    });

export async function fetchAlbum({
    id,
    expand = false,
    minimal = true,
}: {
    id: number;
    expand?: boolean;
    minimal?: boolean;
}): Promise<MinimalAlbum> {
    let url = _url_parse_minimal_expand(`/library/album/${id}`, { expand, minimal });
    console.log(url);
    const response = await fetch(url);
    return (await response.json()) as MinimalAlbum;
}

export const itemQueryOptions = ({
    id,
    expand = false,
    minimal = true,
}: {
    id: number;
    expand?: boolean;
    minimal?: boolean;
}) =>
    queryOptions({
        queryKey: ["item", id, expand, minimal],
        queryFn: () => fetchItem({ id, expand, minimal }),
    });

export async function fetchItem({
    id,
    expand = false,
    minimal = true,
}: {
    id: number;
    expand?: boolean;
    minimal?: boolean;
}): Promise<Item> {
    let url = _url_parse_minimal_expand(`/library/item/${id}`, { expand, minimal });
    const response = await fetch(url);
    return (await response.json()) as Item;
}
