import { createContext, useCallback, useContext, useEffect, useState } from "react";

// in beets language, items are tracks in the database.
// the info types are _very_ similar to what we get from our library queries
// just that we have added a custom `name` field to albums and items.
// annoying: albuminfo of candidates has a .artist, but albums from library dont.
import { Album as AlbumInfo, Item as TrackInfo } from "@/components/common/_query";

import { useImportSocket } from "../common/useSocket";

interface ImportContextI {
    // All selections for the current import
    // might be undefined if the data is not yet loaded
    selections?: SelectionState[];
    status: string;
    generateDummySelections: () => void;
    startSession: (path: string) => void;
    chooseCanidate: (selectionId: string, choiceIdx: number) => void;
    completeAllSelections: () => void;
}

export interface ImportState {
    selection_states: SelectionState[];
    status: string;
}

export interface SelectionState {
    id: string;
    current_candidate_idx: number | null;
    candidates: CandidateState[];
    completed: boolean;
    toppath?: string; // folder supplied to import by user
    paths: string[]; // lowest level (album folders) of music
}

interface BaseCandidateState {
    id: number;
    cur_artist: string;
    cur_album: string;
    penalties: string[];
    items?: MinimalItemAndTrackInfo[];
    diff_preview?: string;
}

interface AlbumCandidateState extends BaseCandidateState {
    info: AlbumInfo;
    type: "album";
    tracks: MinimalItemAndTrackInfo[];
    extra_tracks: MinimalItemAndTrackInfo[];
    extra_items: MinimalItemAndTrackInfo[];
}

interface TrackCandidateState extends BaseCandidateState {
    info: MinimalItemAndTrackInfo;
    type: "track";
}

export type CanditateState = AlbumCandidateState | TrackCandidateState;

interface AlbumMatch {
    distance: number; // TODO: backend uses an object
    info: AlbumInfo; // Complete album info
    extra_items: MinimalItemAndTrackInfo[]; // Items found on disk but not matched online
    extra_tracks: MinimalItemAndTrackInfo[]; // Tracks found online but not on disk
    mapping: Record<number, number>; // indices of candidatechoice.items to match.info.tracks
}

interface TrackMatch {
    distance: number; // TODO: backend uses an object
    info: MinimalItemAndTrackInfo;
}

export interface MinimalItemAndTrackInfo {
    name: string;
    title: string;
    artist: string;
    album: string;
    length: number;
    // track info only
    data_source?: string;
    data_url?: string;
    index?: number; // 1-based
    // item only (before import is done)
    bitrate?: number;
    format?: string;
    track?: number; // 1-based
}

const ImportContext = createContext<ImportContextI | null>(null);

export const ImportContextProvider = ({ children }: { children: React.ReactNode }) => {
    /** Get data via socket */
    const { socket, isConnected } = useImportSocket("import");
    const [selections, setSelections] = useState<SelectionState[]>();
    const [status, setStatus] = useState<string>("waiting for socket");

    useEffect(() => {
        if (status !== "waiting for socket") return;
        if (!socket) return;
        if (isConnected) {
            setStatus("Socket connected");
        }
    }, [socket, isConnected, status, setStatus]);

    useEffect(() => {
        if (!socket) return;

        function handleFullUpdate(data: ImportState) {
            console.log("Full update", data);
            setSelections(data.selection_states);
            setStatus(data.status);
        }

        function handleSelecionState(data: SelectionState) {
            console.log("Selection state", data);
            setSelections((prev) => {
                if (!prev) {
                    prev = [];
                }

                // first candidate is the best match, and our default choice,
                // and we want to set the default choice in the frontend (here!)
                if (
                    data.current_candidate_idx === null ||
                    data.current_candidate_idx === undefined
                ) {
                    data.current_candidate_idx = data.candidates.length > 0 ? 0 : null;
                }

                const idx = prev.findIndex((s) => s.id === data.id);
                if (idx === -1) {
                    return [...prev, data];
                } else {
                    prev[idx] = data;
                    return [...prev];
                }
            });
        }

        function handleStatusUpdate(data: { status: string }) {
            console.log("Status update", data);
            setStatus(data.status);
        }

        // another client may make a choice, and the server informs us
        function remoteCandidateChoice(data: {
            selection_id: string;
            candidate_idx: number;
        }) {
            setSelections((prev) => {
                if (!prev) return prev;
                const selectionIdx = prev.findIndex((s) => s.id === data.selection_id);
                if (selectionIdx === -1) return prev;

                prev[selectionIdx].current_candidate_idx = data.candidate_idx;
                return prev;
            });
        }

        socket.on("import_state", handleFullUpdate);
        socket.on("selection_state", handleSelecionState);
        socket.on("candidate_state", remoteCandidateChoice);
        socket.on("import_state_status", handleStatusUpdate);

        return () => {
            socket.off("import_state", handleFullUpdate);
            socket.off("selection_state", handleSelecionState);
            socket.off("candidate_choice", remoteCandidateChoice);
            socket.off("import_state_status", handleStatusUpdate);
        };
    }, [socket, isConnected, setStatus, setSelections]);

    function generateDummySelections() {
        const dummyAlbum: AlbumMatch = {
            distance: 0.1,
            extra_tracks: [],
            info: {
                // Add necessary fields for AlbumInfo
                name: "Dummy Album",
                artist: "Dummy Artist",
                id: 0,
                albumartist: "Dummy Album Artist",
                year: 0,
            },
        };

        const dummyTrack: TrackMatch = {
            distance: 0.1,
            info: {
                // Add necessary fields for TrackInfo
                name: "Dummy Track",
                id: 0,
                artist: "Dummy Artist",
                albumartist: "Dummy Album Artist",
                album: "Dummy Album",
                album_id: 0,
                year: 0,
                isrc: "Dummy ISRC",
            },
        };

        const dummyCandidateChoice1: CandidateState = {
            id: 1,
            album_match: dummyAlbum, // or dummyTrack
        };

        const dummyCandidateChoice2: CandidateState = {
            id: 2,
            track_match: dummyTrack, // or dummyTrack
        };

        setSelections((prev) => {
            const dummySelectionState: SelectionState = {
                id: "1" + Math.random() * 10000 + "",
                current_candidate_idx: 1,
                candidates: [dummyCandidateChoice1, dummyCandidateChoice2],
                completed: false,
            };
            if (prev) {
                return [...prev, dummySelectionState];
            } else {
                return [dummySelectionState];
            }
        });
    }

    function startSession(path: string) {
        socket?.emit("start_import_session", { path });
    }

    /**
     * Updates the selected candidate for a specific selection.
     * @param {number} selectionIdx - The index of the selection.
     * @param {number} choosenCanidateIdx - The index of the chosen candidate.
     */
    const chooseCanidate = useCallback(
        (selectionId: string, canidateId: number) => {
            setSelections((prev) => {
                if (!prev) return prev;
                const selection = prev.find((s) => s.id === selectionId);
                if (!selection) return prev;

                const idx = selection.candidates.findIndex((c) => c.id === canidateId);
                if (idx === -1) return prev;

                selection.current_candidate_idx = idx;

                // EMIT
                socket?.emit("choose_candidate", {
                    selection_id: selectionId,
                    candidate_idx: selection.current_candidate_idx,
                });
                return [...prev];
            });
        },
        [socket]
    );

    const completeAllSelections = useCallback(() => {
        setSelections((prev) => {
            if (!prev) return prev;

            const selectionIds = [];
            for (const selection of prev) {
                selection.completed = true;
                selectionIds.push(selection.id);
            }

            socket?.emit("complete_selections", {
                selection_ids: selectionIds,
                are_completed: Array(selectionIds.length).fill(true),
            });

            return [...prev];
        });
    }, [socket]);

    const ret: ImportContextI = {
        completeAllSelections,
        selections,
        status,
        startSession,
        generateDummySelections,
        chooseCanidate,
    };

    return <ImportContext.Provider value={ret}>{children}</ImportContext.Provider>;
};

export const useImportContext = () => {
    const context = useContext(ImportContext);
    if (!context) {
        throw new Error(
            "useImportContext must be used within a ImportSocketContextProvider"
        );
    }
    return context;
};
