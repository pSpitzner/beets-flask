/** Everything related to library sources */

import { AlbumSource, ItemSource } from '@/pythonTypes';

/** Normalize the source name */
export function sourceName(source: ItemSource | AlbumSource): string {
    switch (source.source) {
        case 'mb':
        case 'musicbrainz':
            return 'MusicBrainz';
        case 'spotify':
            return 'Spotify';
        default:
            return source.source;
    }
}

/** Given an external source and an id from this source
 *  create the href/url to the .
 */
export function sourceHref<T extends string | string[]>(
    source: string,
    value: T,
    type: string = 'track'
): T | undefined {
    let base: string | undefined = undefined;
    switch (source) {
        case 'mb':
        case 'musicbrainz':
            base = 'https://musicbrainz.org';
            switch (type) {
                case 'track':
                    base += '/recording';
                    break;
                case 'artist':
                case 'albumartist':
                    base += '/artist';
                    break;
                case 'album':
                    base += '/release';
                    break;
                default:
                    console.warn(`Unknown type: ${type}`);
                    return undefined;
            }
            break;
        case 'spotify':
            base = 'https://open.spotify.com';
            switch (type) {
                case 'track':
                    base += '/track';
                    break;
                case 'artist':
                case 'albumartist':
                    base += '/artist';
                    break;
                case 'album':
                    base += '/album';
                    break;
                default:
                    console.warn(`Unknown type: ${type}`);
                    return undefined;
            }
            break;
        default:
            console.warn(`Unknown source: ${source}`);
            return undefined;
    }
    if (base === undefined) return undefined;

    if (value instanceof Array) {
        return value.map((v) => `${base}/${v}`) as T;
    }
    return `${base}/${value}` as T;
}

export function isItemSource(
    source: ItemSource | AlbumSource
): source is ItemSource {
    return Object.keys(source).includes('track_id');
}
