import { queryOptions } from "@tanstack/react-query";

export interface MinimalArtist {
    // backend: /artist
    // beets has no ids for artists?
    name: string;
}

export interface Artist extends MinimalArtist {
    // backend: /artist/[aristName]?minimal
    albums: MinimalAlbum[];
}

export interface MinimalAlbum {
    // backend: /album/[id1,id2,id3...]
    id: number;
    name: string;
}

export interface Album extends MinimalAlbum {
    // backend: /album/albumId/items or /artist/[aristName]?minimal&expand
    items: MinimalItem[];
}

export interface MinimalItem {
    // items are essnetially tracks
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

function _url_parse_minimal_extended(url: string, minimal: boolean, extended: boolean) {
    const params = [];
    if (minimal) {
        params.push("minimal");
    }
    if (extended) {
        params.push("extend");
    }
    return params.length ? `${url}?${params.join("&")}` : url;
}


export async function fetchArtists(): Promise<MinimalArtist[]> {
    const response = await fetch(`/library/artist/`);
    return await response.json() as MinimalArtist[];
}

export const artistsQueryOptions = () =>
    queryOptions({
        queryKey: ["artists"],
        queryFn: () => fetchArtists(),
    });

export async function fetchArtist(
    name: string,
    minimal: boolean = true,
    expand: boolean = false
): Promise<MinimalArtist> {
    let url = _url_parse_minimal_extended(`/library/artist/${name}`,minimal,expand);
    const response = await fetch(url);
    return await response.json() as MinimalArtist;
}

export const artistQueryOptions = (
    name: string,
    minimal: boolean = true,
    expand: boolean = false
) =>
    queryOptions({
        queryKey: ["artist", name, minimal, expand],
        queryFn: () => fetchArtist(name),
    });

export async function fetchAlbum(
    id: number,
    minimal: boolean = true,
    expand: boolean = false
): Promise<MinimalAlbum> {
    let url = _url_parse_minimal_extended(`/library/album/${id}`,minimal, expand);
    const response = await fetch(url);
    return (await response.json()) as MinimalAlbum;
}

export const albumQueryOptions = (
    id: number,
    minimal: boolean = true,
    expand: boolean = false
) =>
    queryOptions({
        queryKey: ["album", id, minimal, expand],
        queryFn: () => fetchAlbum(id),
    });

export async function fetchItem(
    id: number,
    minimal: boolean = true,
    expand: boolean = false
): Promise<Item> {
    let url = _url_parse_minimal_extended(`/library/item/${id}`,minimal, expand);
    const response = await fetch(url);
    return (await response.json()) as Item;
}

export const itemQueryOptions = (
    id: number,
    minimal: boolean = true,
    expand: boolean = false
) =>
    queryOptions({
        queryKey: ["item", id, minimal, expand],
        queryFn: () => fetchItem(id),
    });
