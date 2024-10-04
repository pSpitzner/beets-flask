import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from "react";

import { CandidateState, ImportState, SelectionState } from "./types";

import useQueryParamsState from "../common/hooks/useQueryParamsState";
import { useSocket } from "../common/hooks/useSocket";

export interface ImportStatus {
    message:
        | "initializing"
        | "reading files"
        | "grouping albums"
        | "looking up candidates"
        | "identifying duplicates"
        | "waiting for user selection"
        | "manipulating files"
        | "completed"
        | "aborted"
        | "plugin";

    plugin_stage?: string;
    plugin_name?: string;
}

export function importStatusMessage(status: ImportStatus) {
    let ret = status.message;
    if (status.plugin_stage ?? status.plugin_name) {
        ret += " (";
        if (status.plugin_stage) ret += `${status.plugin_stage}`;
        if (status.plugin_stage && status.plugin_name) ret += " ";
        if (status.plugin_name) ret += `${status.plugin_name}`;
        ret += ")";
    }
    return ret;
}

interface ImportContextI {
    // All selections for the current import
    // might be undefined if the data is not yet loaded
    selStates?: SelectionState[];
    currentCandidates?: (CandidateState | undefined)[];
    status?: ImportStatus;
    pending: boolean;
    sessionPath: string | null;
    selectionsInvalidCause: string | null;
    setSessionPath: (path: string | null) => void;
    startSession: () => Promise<void>;
    abortSession: () => Promise<void>;
    chooseCandidate: (selectionId: string, candidateId: string) => void;
    searchForCandidates: (
        selectionId: string,
        searchId: string | null,
        artist: string | null,
        album: string | null
    ) => Promise<void>;
    completeAllSelections: () => void;
}

const ImportContext = createContext<ImportContextI | null>(null);

/** Handle communication for interactive imports with the
 * backend via a socket connection.
 *
 * Basically we sync the state of the import with the backend
 * and allow the user to make choices via the frontend.
 */
export const ImportContextProvider = ({ children }: { children: React.ReactNode }) => {
    const { socket, isConnected } = useSocket("import");

    // Currently selected import session, also saved as a query parameter
    // is null if no session is selected
    const [sessionPath, setSessionPath] = useQueryParamsState<string | null>(
        "sessionPath",
        null
    );

    // Current selection states for the import
    // none if the data is not yet loaded
    const [selStates, setSelStates] = useState<SelectionState[]>();

    // Whether a valid user choice has been made for every selection
    const [selectionsInvalidCause, setSelectionsInvalidCause] = useState<string | null>(
        null
    );

    // The status of the import in the backend, only backend status!
    const [status, setStatus] = useState<ImportStatus>();

    // If we submit a request via the socket, we want to show a loading spinner
    // this allows us to show the user that something is happening
    const [pending, setPending] = useState<boolean>(false);

    /** Helper functions to update the state
     *
     * in the backend we have more fine grained state updates
     * thus we condense them here to update the state in the frontend
     */
    const updateImportState = useCallback((state: ImportState | undefined) => {
        if (!state) setSelStates(undefined);
        else setSelStates(state.selection_states);
    }, []);

    const updateSelectionState = useCallback((state: SelectionState | undefined) => {
        if (!state) return;
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
    }, []);

    // On connect set status and get initial state
    // i.e. sync state if another client is currently working on the import
    useEffect(() => {
        if (!socket || !isConnected) return;

        setPending(true);
        socket.emit(
            "get_state",
            (data: (ImportState & { status: ImportStatus }) | undefined) => {
                console.log("Got initial state", data);
                if (data) {
                    updateImportState(data);
                    setStatus(data.status);
                }
                setPending(false);
            }
        );
    }, [socket, isConnected, updateImportState]);

    /** Derived state */
    // to enable the apply button, check that all selections have a valid candidate
    useEffect(() => {
        let allValid = true;
        if (!selStates || selStates?.length == 0) {
            // this happens when we initialize
            // and causes the apply button to be hidden
            setSelectionsInvalidCause("no selections");
            allValid = false;
        } else if (pending || status?.message !== "waiting for user selection") {
            setSelectionsInvalidCause("operation pending");
            allValid = false;
        }
        for (const selection of selStates ?? []) {
            if (selection.current_candidate_id === null) {
                setSelectionsInvalidCause("no current candidate");
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
                setSelectionsInvalidCause("no duplicate action");
                allValid = false;
                break;
            }
        }
        if (allValid) {
            setSelectionsInvalidCause(null);
        }
    }, [selStates, pending, status]);

    /** Register event handler
     *
     * to update the state of the import from the backend
     * and to allow the user to make choices via the frontend
     */
    useEffect(() => {
        if (!socket) return;

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

        function handleStatus(data: { data: ImportStatus }) {
            console.log("Got status", data);
            setStatus(data.data);
        }

        function handleImportState(data: { data: ImportState }) {
            console.log("Got import state", data);
            updateImportState(data.data);
        }

        function handleSelectionState(data: { data: SelectionState }) {
            console.log("Got selection state", data);
            updateSelectionState(data.data);
        }

        function handleAbort() {
            updateImportState(undefined);
            setStatus(undefined);
        }

        socket.on("import_state", handleImportState);
        socket.on("selection_state", handleSelectionState);
        socket.on("candidate_state", remoteCandidateChoice);
        socket.on("abort", handleAbort);
        socket.on("status", handleStatus);

        return () => {
            socket.off("import_state", handleImportState);
            socket.off("selection_state", handleSelectionState);
            socket.off("candidate_choice", remoteCandidateChoice);
            socket.off("abort", handleAbort);
            socket.off("status", handleStatus);
        };
    }, [socket, updateImportState, updateSelectionState]);

    async function startSession() {
        try {
            setPending(true);
            // Start the session
            await applyTimeout(
                new Promise<true>((resolve, reject) => {
                    if (!sessionPath) {
                        reject(
                            new Error(
                                "SessionPath needs to be set before starting a session"
                            )
                        );
                    }

                    socket?.emit(
                        "start_import_session",
                        { path: sessionPath },
                        (started: true) => {
                            resolve(started);
                        }
                    );
                })
            );
        } finally {
            setPending(false);
        }
    }

    async function abortSession() {
        try {
            setPending(true);
            // Abort the session
            await applyTimeout(
                new Promise<true>((resolve, reject) => {
                    if (!sessionPath) {
                        reject(
                            new Error(
                                "SessionPath needs to be set before starting a session"
                            )
                        );
                    }

                    socket?.emit("abort_import_session", (aborted: true) => {
                        resolve(aborted);
                    });
                })
            );

            updateImportState(undefined);
            setStatus(undefined);
        } finally {
            setPending(false);
        }
    }

    // Updates the selected candidate for a specific selection.
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

    // Marks all selections as completed and emits a user action event to the server.
    const completeAllSelections = useCallback(() => {
        setPending(true);
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

    /** Search for candidates for a specific selection
     * and update the state accordingly.
     *
     * May throw an error if the search fails!
     */
    const searchForCandidates = useCallback(
        async (
            selectionId: string,
            searchId: string | null,
            artist: string | null,
            album: string | null
        ) => {
            if (!socket) throw new Error("Socket not connected");

            // Get state from the server
            try {
                setPending(true);
                const state = await applyTimeout(
                    new Promise<SelectionState>((resolve, reject) => {
                        socket.emit(
                            "user_action",
                            {
                                event: "candidate_search",
                                selection_id: selectionId,
                                search_id: searchId,
                                artist: artist,
                                album: album,
                            },
                            ({
                                data,
                            }: {
                                data: {
                                    success: boolean;
                                    message: string;
                                    state: SelectionState;
                                };
                            }) => {
                                if (data.success) {
                                    resolve(data.state);
                                } else {
                                    reject(data.message);
                                }
                            }
                        );
                    }),
                    20000
                );

                // Update local state
                updateSelectionState(state);
                chooseCandidate(selectionId, state.candidate_states[0].id);
            } finally {
                setPending(false);
            }
        },
        [socket, updateSelectionState, chooseCandidate]
    );

    /** Helper to get the current candidates */
    const currentCandidates = useMemo(() => {
        if (!selStates) return undefined;
        const current = [];
        for (const sel of selStates) {
            if (sel.current_candidate_id) {
                const candidate = sel.candidate_states.find(
                    (c) => c.id === sel.current_candidate_id
                );
                if (candidate) current.push(candidate);
            } else {
                current.push(undefined);
            }
        }
        return current;
    }, [selStates]);

    const ret: ImportContextI = {
        selStates,
        currentCandidates,
        status,
        sessionPath,
        selectionsInvalidCause,
        pending,
        completeAllSelections,
        setSessionPath,
        startSession,
        abortSession,
        chooseCandidate,
        searchForCandidates,
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

function applyTimeout<T>(promise: Promise<T>, timeout = 20000): Promise<T> {
    return Promise.race([
        promise,
        new Promise<T>((_, reject) =>
            setTimeout(() => reject(new Error("timeout")), timeout)
        ),
    ]);
}
