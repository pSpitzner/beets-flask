import { queryOptions } from "@tanstack/react-query";

export const LIB_BROWSE_ROUTE = "/library/browse";

export interface MinimalArtist {
    name: string;
    albums: MinimalAlbum[];
}

export interface MinimalAlbum {
    id: number;
    name: string; // added by us for consistency, not a beets-fields
    albumartist: string;
    year: number;
}

export interface Album extends MinimalAlbum {
    [key: string]: unknown; // enable indexing item[key]
    items?: MinimalItem[];

    artist?: string; // if this field exists depends on which part of beets we ask. looking up online data does have it, library queries dont.

    // not sure how we best type this.
    // these are fields from candidate lookups
    data_source?: string; // "MusicBrainz"
    data_url?: string; // "https://musicbrainz.org/release/bf06691a-4e43-4e9b-94a7-2d733f2976d9";

    // these are fields from the library
    added?: number; // 1707767640.980912
    album?: string; // "Away From the Sun"
    albumartist_credit?: string; // "3 Doors Down"
    albumartist_sort?: string; // "3 Doors Down"
    albumartists?: string[]; // ["3 Doors Down"]
    albumartists_credit?: string[]; // ["3 Doors Down"]
    albumartists_sort?: string[]; // ["3 Doors Down"]
    albumdisambig?: string; // "BMG club edition"
    albumstatus?: string; // "Official"
    albumtype?: string; // "album"
    albumtypes?: string[]; // ["album"]
    artpath?: string; // "None"
    asin?: string; // ""
    barcode?: string; // ""
    catalognum?: string; // "440 064 396-2"
    comp?: number; // 0
    country?: string; // "US"
    day?: number; // 12
    discogs_albumid?: number; // 0
    discogs_artistid?: number; // 0
    discogs_labelid?: number; // 0
    disctotal?: number; // 1
    genre?: string; // "Post-Grunge; Hard Rock; Alternative Rock; Rock"
    label?: string; // ""
    language?: string; // "eng"
    mb_albumartistid?: string; // "2386cd66-e923-4e8e-bf14-2eebe2e9b973"
    mb_albumid?: string; // "9a7b7d7c-3e5d-4006-a97f-06e10a12cb16"
    mb_releasegroupid?: string; // "8f4d4f05-36ed-3c81-86a7-aae2a03b1520"
    month?: number; // 11
    original_day?: number; // 11
    original_month?: number; // 11
    original_year?: number; // 2002
    // r128_album_gain?: null; // null
    release_group_title?: string; // "Away From the Sun"
    releasegroupdisambig?: string; // ""
    // rg_album_gain?: null; // null
    // rg_album_peak?: null; // null
    script?: string; // "Latn"
    style?: string; // ""
}

export interface MinimalItem {
    id: number;
    name: string; // Track title, added by us for consistency, not a beets-fields
    artist: string; // "Basstripper"
    albumartist: string; // "Basstripper"
    album: string; // "In the City / Wasted"
    album_id: number; // 1
    year: number; // 2023
    isrc: string; // "US39N2308955"
}

export interface Item extends MinimalItem {
    [key: string]: unknown; // enable indexing item[key]

    albumartist_credit?: string; // "Basstripper"
    albumartist_sort?: string; // "Basstripper"
    albumartists?: string[]; // ["Basstripper"]
    albumartists_credit?: string[]; // ["Basstripper"]
    albumartists_sort?: string[]; // ["Basstripper"]
    albumdisambig?: string; // ""
    albumstatus?: string; // "Official"
    albumtype?: string; // "single"
    albumtypes?: string[]; // ["single"]
    acoustid_fingerprint?: string; // ""
    acoustid_id?: string; // ""
    added?: number; // 1715716057.413927
    arranger?: string; // ""
    artist_credit?: string; // "Basstripper"
    artist_sort?: string; // "Basstripper"
    artists?: string[]; // ["Basstripper"]
    artists_credit?: string[]; // ["Basstripper"]
    artists_ids?: number[]; // []
    artists_sort?: string[]; // ["Basstripper"]
    asin?: string; // ""
    barcode?: string; // "197338612422"
    bitrate?: number; // 1033095
    bitrate_mode?: string; // ""
    bpm?: number; // 0
    catalognum?: string; // ""
    channels?: number; // 2
    comments?: string; // ""
    comp?: number; // 0
    composer?: string; // ""
    composer_sort?: string; // ""
    country?: string; // ""
    data_source?: string; // "MusicBrainz"
    day?: number; // 14
    disc?: number; // 1
    discogs_albumid?: number; // 0
    discogs_artistid?: number; // 0
    discogs_labelid?: number; // 0
    disctitle?: string; // ""
    disctotal?: number; // 1
    encoder?: string; // ""
    encoder_info?: string; // ""
    encoder_settings?: string; // ""
    format?: string; // "FLAC"
    genre?: string; // ""
    grouping?: string; // ""
    initial_key?: string; // null
    label?: string; // "DnB Allstars Records"
    language?: string; // ""
    length?: number; // 156.34643990929706
    lyricist?: string; // ""
    lyrics?: string; // ""
    mb_albumartistid?: string; // "82687fdf-84d6-49ac-bff2-de88cb42e5a2"
    mb_albumartistids?: string[]; // ["82687fdf-84d6-49ac-bff2-de88cb42e5a2"]
    mb_albumid?: string; // "3a76ece6-89ec-43c6-920f-ff955d2e4f9e"
    mb_artistid?: string; // "82687fdf-84d6-49ac-bff2-de88cb42e5a2"
    mb_artistids?: string[]; // ["82687fdf-84d6-49ac-bff2-de88cb42e5a2"]
    mb_releasegroupid?: string; // "6e46e8cc-2546-45d1-a24c-23982cf36980"
    mb_releasetrackid?: string; // "6886cc80-ccbe-4c92-a8b5-b066b39a666f"
    mb_trackid?: string; // "ee846065-2f7d-4e87-ae3f-b925c75359c1"
    mb_workid?: string; // ""
    media?: string; // "Digital Media"
    month?: number; // 7
    mtime?: number; // 1715716092
    original_day?: number; // 14
    original_month?: number; // 7
    original_year?: number; // 2023
    path?: string; // "/music/imported/Basstripper/In the City - Wasted/01 In the City [1033kbps].flac"
    // r128_album_gain?: null; // null
    // r128_track_gain?: null; // null
    release_group_title?: string; // "In the City / Wasted"
    releasegroupdisambig?: string; // ""
    remixer?: string; // ""
    // rg_album_gain?: null; // null
    // rg_album_peak?: null; // null
    // rg_track_gain?: null; // null
    // rg_track_peak?: null; // null
    samplerate?: number; // 44100
    script?: string; // "Latn"
    size?: number; // 20487451
    style?: string; // ""
    title?: string; // "In the City"
    track?: number; // 1
    track_alt?: string; // "1"
    trackdisambig?: string; // ""
    tracktotal?: number; // 2
    work?: string; // ""
    work_disambig?: string; // ""
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
        queryFn: async () => {
            const response = await fetch(`/library/artist/`);
            return (await response.json()) as MinimalArtist[];
        },
    });

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
        queryFn: async (): Promise<MinimalArtist> => {
            const url = _url_parse_minimal_expand(`/library/artist/${name}`, {
                expand,
                minimal,
            });
            const response = await fetch(url);
            return (await response.json()) as MinimalArtist;
        },
    });

export const albumQueryOptions = ({
    id,
    expand = true,
    minimal = true,
}: {
    id?: number;
    expand?: boolean;
    minimal?: boolean;
}) =>
    queryOptions({
        queryKey: ["album", id, expand, minimal],
        queryFn: async (): Promise<null | MinimalAlbum | Album> => {
            if (id === undefined || id === null) {
                return null;
            }
            const url = _url_parse_minimal_expand(`/library/album/${id}`, {
                expand,
                minimal,
            });
            const response = await fetch(url);
            return (await response.json()) as MinimalAlbum | Album;
        },
    });

export const itemQueryOptions = ({
    id,
    expand = false,
    minimal = true,
}: {
    id?: number;
    expand?: boolean;
    minimal?: boolean;
}) =>
    queryOptions({
        queryKey: ["item", id, expand, minimal],
        queryFn: async () => {
            if (id === undefined || id === null) {
                return null;
            }
            const url = _url_parse_minimal_expand(`/library/item/${id}`, {
                expand,
                minimal,
            });
            const response = await fetch(url);
            return (await response.json()) as Item;
        },
    });

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

/* ---------------------------------------------------------------------------------- */
/*                                       Search                                       */
/* ---------------------------------------------------------------------------------- */

export interface SearchResult<T extends MinimalItem | MinimalAlbum> {
    results: T[];
}

export const searchQueryOptions = <T extends MinimalItem | MinimalAlbum>({
    searchFor,
    type,
}: {
    searchFor: string;
    type: "item" | "album";
}) =>
    queryOptions({
        queryKey: ["search", type, searchFor],
        queryFn: async ({ signal }) => {
            const expand = false;
            const minimal = true;
            const url = _url_parse_minimal_expand(
                `/library/${type}/query/${encodeURIComponent(searchFor)}`,
                {
                    expand,
                    minimal,
                }
            );
            const response = await fetch(url, { signal });
            return (await response.json()) as SearchResult<T>;
        },
    });

/* ---------------------------------------------------------------------------------- */
/*                                        Stats                                       */
/* ---------------------------------------------------------------------------------- */

export interface LibraryStats {
    libraryPath: string;
    items: number;
    albums: number;
    artists: number;
    genres: number;
    labels: number;
    size: number;
    lastItemAdded?: Date;
    lastItemModified?: Date;
}

export const libraryStatsQueryOptions = () => {
    return queryOptions({
        queryKey: ["libraryStats"],
        queryFn: async () => {
            const response = await fetch(`/library/stats`);
            const dat = (await response.json()) as LibraryStats;

            // convert lastItemAdded to Date
            if (dat.lastItemAdded) dat.lastItemAdded = new Date(dat.lastItemAdded);
            if (dat.lastItemModified)
                dat.lastItemModified = new Date(dat.lastItemModified);

            return dat;
        },
    });
};
