import { createContext, useCallback, useContext, useEffect, useState } from "react";

import { useImportSocket } from "../common/useSocket";
import { ImportState, SelectionState } from "./types";

interface ImportContextI {
    // All selections for the current import
    // might be undefined if the data is not yet loaded
    selections?: SelectionState[];
    status: string;
    startSession: (path: string) => void;
    chooseCandidate: (selectionId: string, choiceIdx: number) => void;
    completeAllSelections: () => void;
}

const ImportContext = createContext<ImportContextI | null>(null);

export const ImportContextProvider = ({ children }: { children: React.ReactNode }) => {
    const { socket, isConnected } = useImportSocket("import");
    // we want to allow partial updates to parts of the import state, so deconstruct here
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

        function handleImportState({ data: state }: { data: ImportState }) {
            console.log("Import state", state);
            setSelections(state.selection_states);
            setStatus(state.status);
        }

        function handleSelectionState({ data: state }: { data: SelectionState }) {
            console.log("Selection state", state);
            setSelections((prev) => {
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
    }, [socket, isConnected, setStatus, setSelections]);

    function startSession(path: string) {
        socket?.emit("start_import_session", { path });
    }

    /**
     * Updates the selected candidate for a specific selection.
     * @param {number} selectionIdx - The index of the selection.
     * @param {number} candidateId - The id of the candidate to select.
     */
    const chooseCandidate = useCallback(
        (selectionId: string, candidateId: number) => {
            console.log("chooseCandidate", selectionId, candidateId);
            setSelections((prev) => {
                if (!prev) return prev;
                const selection = prev.find((s) => s.id === selectionId);
                if (!selection) return prev;

                const idx = selection.candidate_states.findIndex(
                    (c) => c.id === candidateId
                );
                if (idx === -1) return prev;

                selection.current_candidate_idx = idx;

                // for typing in python, we group all user actions and specify via `events` key
                socket?.emit("user_action", {
                    event: "candidate_choice",
                    selection_id: selectionId,
                    candidate_idx: selection.current_candidate_idx,
                    duplicate_action: selection.duplicate_action,
                });
                return [...prev];
            });
        },
        [socket]
    );

    /**
     * Marks all selections as completed and emits a user action event to the server.
     *
     * This function iterates through all the selections, marks them as completed,
     * and then emits an event to the server with the IDs of the completed selections.
     *
     * @returns {void}
     */
    const completeAllSelections = useCallback(() => {
        setSelections((prev) => {
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
        selections,
        status,
        startSession,
        chooseCandidate,
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
