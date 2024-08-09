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
    generateDummySelections: () => void;
    chooseCanidate: (selectionId: string, choiceIdx: number) => void;
    completeAllSelections: () => void;
}

export interface SelectionState {
    id: string;
    current_candidate_idx: number | null;
    candidates: CandidateChoice[];
    completed: boolean;
}

export type CandidateChoice =
    | { id: number; track_match: TrackMatch; album_match?: never }
    | { id: number; track_match?: never; album_match: AlbumMatch };

interface AlbumMatch {
    distance: number; // TODO: backend uses an object
    info: AlbumInfo; // Complete album info
    extra_tracks: TrackInfo[]; // Tracks found online but not on disk
    // mapping?: // not passed to frontend yet
}

interface TrackMatch {
    distance: number; // TODO: backend uses an object
    info: TrackInfo;
}

const ImportContext = createContext<ImportContextI | null>(null);

export const ImportContextProvider = ({ children }: { children: React.ReactNode }) => {
    /** Get data via socket */
    const { socket, isConnected } = useImportSocket("import");
    const [selections, setSelections] = useState<SelectionState[]>();

    useEffect(() => {
        if (!socket) return;

        function handleSelecionState(data: SelectionState) {
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

        socket.on("selection_state", handleSelecionState);
        socket.on("candidate_choice", remoteCandidateChoice);

        return () => {
            socket.off("selection_state", handleSelecionState);
        };
    }, [socket, isConnected]);

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

        const dummyCandidateChoice1: CandidateChoice = {
            id: 1,
            album_match: dummyAlbum, // or dummyTrack
        };

        const dummyCandidateChoice2: CandidateChoice = {
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
