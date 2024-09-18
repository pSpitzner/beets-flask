// Type definitions for the import module, reflecting those in the backend

export interface ImportState {
    selection_states: SelectionState[];
    status: string;
}

export interface SelectionState {
    id: string;
    candidate_states: CandidateState[];
    current_candidate_id: string | null;
    duplicate_action: "skip" | "merge" | "keep" | "remove" | null;
    items: ItemInfo[];
    completed: boolean;
    toppath?: string; // folder supplied to import by user
    paths: string[]; // lowest level (album folders) of music
}

export interface BaseCandidateState {
    id: string;
    diff_preview?: string;
    cur_artist: string;
    cur_album: string;
    penalties: string[];
    duplicate_in_library: boolean;
    distance: number;
}

export interface AlbumCandidateState extends BaseCandidateState {
    type: "album";
    info: AlbumInfo;
    tracks: TrackInfo[];
    items: ItemInfo[];
    extra_tracks: TrackInfo[];
    extra_items: ItemInfo[];
    mapping: Record<number, number>;
}

export interface TrackCandidateState extends BaseCandidateState {
    type: "track";
    info: TrackInfo;
}

export type CandidateState = AlbumCandidateState | TrackCandidateState;

export interface MusicInfo {
    type: "item" | "track" | "album";
    artist?: string;
    album?: string;
    data_url?: string;
    data_source?: string;
    year?: number;
    genre?: string;
    media?: string;
}

export interface AlbumInfo extends MusicInfo {
    type: "album";
    mediums?: number; // number of discs
}

export interface TrackInfo extends MusicInfo {
    type: "track";
    title?: string;
    length?: number;
    isrc?: string;
    index?: number; // 1-based
}

export interface ItemInfo extends MusicInfo {
    type: "item";
    title?: string;
    length?: number;
    isrc?: string;
    track?: number; // 1-based

    bitrate?: number;
    format?: string;
}
