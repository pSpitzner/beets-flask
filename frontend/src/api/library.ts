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

import { queryClient } from "./common";

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
export const artUrl = (type: "item" | "album", id: number) =>
    `/library/${type}/${id}/art`;
export const artQueryOptions = ({
    type,
    id,
}: {
    type?: "item" | "album";
    id?: number;
}) =>
    queryOptions({
        queryKey: ["art", type, id],
        queryFn: async () => {
            if (id === undefined || id === null) {
                return null;
            }
            console.log("artQueryOptions", type, id);
            const url = artUrl(type!, id);
            const response = await fetch(url);
            const blob = await response.blob();
            const objectUrl = URL.createObjectURL(blob);
            return objectUrl;
        },
        retry: 1,
        gcTime: 1000 * 60 * 60 * 24, // 1 day
        staleTime: 1000 * 60 * 60 * 24, // 1 day
        refetchOnMount: false,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false, // Prevent refetch on network reconnect
    });

// Artist names
export const artistsQueryOptions = () => ({
    queryKey: ["artists"],
    queryFn: async () => {
        const response = await fetch(`/library/artist/`);
        return (await response.json()) as { name: string }[];
    },
    refetchOnWindowFocus: "always" as const,
});

interface AlbumResponseFull extends AlbumResponse {
    [key: string]: unknown; // enable indexing album[key]
}

export type Album<
    Expand extends boolean,
    Minimal extends boolean,
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
    retry: 1,
});

const commonQOptions = {
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
};

/* ---------------------------- Waveforms / Peaks --------------------------- */
// We precompute the waveform for each audio file on the server
// allows to show the waveform without loading the entire audio file first

async function fetchWaveform(url: string, signal: AbortSignal) {
    const response = await fetch(url, { signal });
    const blob = await response.blob();
    const arrayBuffer = await blob.arrayBuffer();
    const data = new Float32Array(arrayBuffer);
    return data;
}
export function waveformQueryOptions(id?: number) {
    return queryOptions({
        queryKey: ["item", "audio", "waveform", id],
        queryFn: async ({ signal }) => {
            if (!id) {
                return null;
            }
            return await fetchWaveform(`/library/item/${id}/audio/peaks`, signal);
        },
        retry: false,
        ...commonQOptions,
    });
}

export function prefetchWaveform(id: number) {
    return queryClient.prefetchQuery({
        queryKey: ["item", "audio", "waveform", id],
        queryFn: async ({ signal }) => {
            return await fetchWaveform(`/library/item/${id}/audio/peaks`, signal);
        },
        ...commonQOptions,
    });
}

/* ------------------------------- Audio files ------------------------------ */
// We add progress to the cache to allow inflight merging
// or prefetched and new queries

async function fetchAudio(id: number, signal: AbortSignal): Promise<HTMLAudioElement> {
    const mimeCodecs = "audio/webm; codecs=opus";
    const audio = new Audio();

    if (!MediaSource.isTypeSupported(mimeCodecs)) {
        console.warn("Audio streaming not supported, using fallback");
        const res = await fetch(`/library/item/${id}/audio`, { signal });
        audio.src = URL.createObjectURL(await res.blob());
        return audio;
    }

    const mediaSource = new MediaSource();
    let resolveSourceBuffer: (buffer: SourceBuffer) => void;

    // Create a promise to resolve when SourceBuffer is ready
    const sourceBufferReady = new Promise<SourceBuffer>((resolve) => {
        resolveSourceBuffer = resolve;
    });

    // Start fetch outside sourceopen
    const response = await fetch(`/library/item/${id}/audio`, { signal });
    if (!response.body) throw new Error(`Fetch error: ${response.status} no body!`);

    // Set up sourceopen handler (queues data until ready)
    mediaSource.addEventListener(
        "sourceopen",
        () => {
            const sourceBuffer = mediaSource.addSourceBuffer(mimeCodecs);
            sourceBuffer.mode = "sequence";
            resolveSourceBuffer(sourceBuffer);
        },
        { once: true }
    );

    (async () => {
        /** Warning: This is an absolute mess, I spend quite some time
         * here and tried to remove all race conditions
         * and add buffering to the audio stream.
         * Proceed with caution :)
         *
         * ref: https://developer.mozilla.org/en-US/docs/Web/API/MediaSource
         */
        audio.src = URL.createObjectURL(mediaSource);
        const sourceBuffer = await sourceBufferReady; // wait for sourceBuffer to be ready
        const contentLengthHeader = response.headers.get("Content-Length");
        const total = contentLengthHeader ? parseInt(contentLengthHeader, 10) : null;
        const reader = response.body!.getReader();

        // Process the stream
        let isAppending = false;
        let isEndOfStream = false;
        const appendQueue: ArrayBuffer[] = [];

        function processAppendQueue() {
            if (!isAppending && appendQueue.length > 0) {
                isAppending = true;
                const chunk = appendQueue.shift();
                if (chunk) {
                    sourceBuffer.appendBuffer(chunk);
                }
            }
        }

        function endStream() {
            if (isAppending) {
                isEndOfStream = true;
            } else {
                mediaSource.endOfStream();
            }
        }

        sourceBuffer.addEventListener("updateend", () => {
            isAppending = false;
            if (isEndOfStream && appendQueue.length === 0) {
                mediaSource.endOfStream();
            }
            processAppendQueue();
        });

        function appendChunk(chunk: ArrayBuffer) {
            appendQueue.push(chunk);
            processAppendQueue();
        }

        async function appendToBuffer() {
            // Read the data
            let loaded = 0;
            while (true) {
                const { done, value } = await reader.read();
                if (done) {
                    endStream();
                    break;
                }

                loaded += value.length;
                // NOTE: In theory we can add a
                // onProgress event here
                // but it is not clear if the total
                // length is known
                console.debug("loaded", loaded, total);

                appendChunk(value.buffer);
            }
        }

        await appendToBuffer();
    })().catch(console.error);

    /** No idea why but we need a short delay here to kick
     * into the micro task queue, only needed in chromium
     * based browsers. Maybe browser bug
     */
    await new Promise((resolve) => {
        setTimeout(() => {
            resolve(true);
        }, 100);
    });

    return audio;
}

export function itemAudioDataQueryOptions(id?: number) {
    return queryOptions({
        queryKey: ["item", "audio", id],
        queryFn: async ({ signal }) => {
            if (!id) {
                return null;
            }
            return await fetchAudio(id, signal);
        },
        ...commonQOptions,
    });
}

export function prefetchItemAudioData(id: number) {
    return queryClient.prefetchQuery({
        queryKey: ["item", "audio", id],
        queryFn: async ({ signal }) => {
            return await fetchAudio(id, signal);
        },
        ...commonQOptions,
    });
}
