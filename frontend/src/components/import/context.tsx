import { createContext, useCallback, useContext, useEffect, useState } from "react";

import { useImportSocket } from "../common/useSocket";
import { ImportState, SelectionState } from "./types";

interface ImportContextI {
    // All selections for the current import
    // might be undefined if the data is not yet loaded
    selStates?: SelectionState[];
    status: string;
    startSession: (path: string) => void;
    chooseCandidate: (selectionId: string, candidateId: string) => void;
    addCandidate: (
        selectionId: string,
        searchId: string | null,
        artist: string | null,
        album: string | null
    ) => void;
    completeAllSelections: () => void;
    allSelectionsValid: boolean;
}

const ImportContext = createContext<ImportContextI | null>(null);

export const ImportContextProvider = ({ children }: { children: React.ReactNode }) => {
    const { socket, isConnected } = useImportSocket("import");
    // we want to allow partial updates to parts of the import state, so deconstruct here
    const [selStates, setSelStates] = useState<SelectionState[]>();
    const [status, setStatus] = useState<string>("waiting for socket");
    const [allSelectionsValid, setAllSelectionsValid] = useState<boolean>(false);

    useEffect(() => {
        if (status !== "waiting for socket") return;
        if (!socket) return;
        if (isConnected) {
            setStatus("Socket connected");
        }
    }, [socket, isConnected, status, setStatus]);

    useEffect(() => {
        if (!socket) return;

        function handleImportState({ data: state }: { data: ImportState }) {
            console.log("Import state", state);
            setSelStates(state.selection_states);
            setStatus(state.status);
        }

        function handleSelectionState({ data: state }: { data: SelectionState }) {
            console.log("Selection state", state);
            setSelStates((prev) => {
                if (!prev) {
                    prev = [];
                }

                const idx = prev.findIndex((s) => s.id === state.id);
                if (idx === -1) {
                    return [...prev, state];
                } else {
                    prev[idx] = state;
                    return [...prev];
                }
            });
        }

        function handleStatusUpdate({ data: status }: { data: string }) {
            console.log("Status update", status);
            setStatus(status);
        }

        // another client may make a choice, and the server informs us
        function remoteCandidateChoice(data: {
            selection_id: string;
            candidate_id: string;
        }) {
            setSelStates((prev) => {
                if (!prev) return prev;
                const selectionIdx = prev.findIndex((s) => s.id === data.selection_id);
                if (selectionIdx === -1) return prev;

                prev[selectionIdx].current_candidate_id = data.candidate_id;
                return prev;
            });
        }

        socket.on("import_state", handleImportState);
        socket.on("selection_state", handleSelectionState);
        socket.on("candidate_state", remoteCandidateChoice);

        socket.on("import_state_status", handleStatusUpdate);

        return () => {
            socket.off("import_state", handleImportState);
            socket.off("selection_state", handleSelectionState);
            socket.off("candidate_choice", remoteCandidateChoice);

            socket.off("import_state_status", handleStatusUpdate);
        };
    }, [socket, isConnected, setStatus, setSelStates]);

    function startSession(path: string) {
        socket?.emit("start_import_session", { path });
    }

    //Updates the selected candidate for a specific selection.
    const chooseCandidate = useCallback(
        (selectionId: string, candidateId: string) => {
            console.log("chooseCandidate", selectionId, candidateId);
            setSelStates((prev) => {
                if (!prev) return prev;
                const selection = prev.find((s) => s.id === selectionId);
                if (!selection) return prev;

                if (!selection.candidate_states.some((c) => c.id === candidateId))
                    return prev;

                selection.current_candidate_id = candidateId;

                // for typing in python, we group all user actions and specify via `events` key
                socket?.emit("user_action", {
                    event: "candidate_choice",
                    selection_id: selectionId,
                    candidate_id: selection.current_candidate_id,
                    duplicate_action: selection.duplicate_action,
                });
                return [...prev];
            });
        },
        [socket]
    );

    // We want the user to be able to add candidates via search
    const addCandidate = useCallback(
        (
            selectionId: string,
            searchId: string | null,
            artist: string | null,
            album: string | null
        ) => {
            socket?.emit("user_action", {
                event: "candidate_search",
                selection_id: selectionId,
                search_id: searchId,
                artist: artist,
                album: album,
            });
        },
        [socket]
    );

    // to enable the apply button, check that all selections have a valid candidate
    useEffect(() => {
        let allValid = true;
        for (const selection of selStates ?? []) {
            if (selection.current_candidate_id === null) {
                allValid = false;
                break;
            }
            const candidate = selection.candidate_states.find(
                (c) => c.id === selection.current_candidate_id
            );
            if (
                candidate &&
                candidate.duplicate_in_library &&
                !selection.duplicate_action
            ) {
                allValid = false;
                break;
            }
        }
        setAllSelectionsValid(allValid);
    }, [selStates]);

    // Marks all selections as completed and emits a user action event to the server.
    const completeAllSelections = useCallback(() => {
        setSelStates((prev) => {
            if (!prev) return prev;

            const selectionIds = [];
            for (const selection of prev) {
                selection.completed = true;
                selectionIds.push(selection.id);
            }

            socket?.emit("user_action", {
                event: "selection_complete",
                selection_ids: selectionIds,
                are_completed: Array(selectionIds.length).fill(true),
            });

            return [...prev];
        });
    }, [socket]);

    const ret: ImportContextI = {
        completeAllSelections,
        selStates,
        status,
        startSession,
        chooseCandidate,
        addCandidate,
        allSelectionsValid,
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
