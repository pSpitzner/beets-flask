/**
 * Bandcamp Sync Modal
 *
 * A modal dialog for syncing Bandcamp purchases. Allows users to:
 * - Enter their Bandcamp cookies (persisted in localStorage)
 * - Start a sync operation
 * - View real-time progress via WebSocket
 * - Abort a running sync
 */

import { CloudDownloadIcon, XCircleIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
    Alert,
    Box,
    Button,
    CircularProgress,
    DialogActions,
    DialogContent,
    Link,
    TextField,
    Typography,
} from "@mui/material";
import { useQueryClient } from "@tanstack/react-query";

import {
    abortBandcampSync,
    startBandcampSync,
} from "@/api/bandcamp";
import { BandcampSyncUpdate } from "@/api/websocket";
import { Dialog } from "@/components/common/dialogs";
import { useLocalStorage } from "@/components/common/hooks/useLocalStorage";
import { useStatusSocket } from "@/components/common/websocket/status";

interface BandcampSyncModalProps {
    open: boolean;
    onClose: () => void;
}

type SyncState = "idle" | "pending" | "running" | "complete" | "error" | "aborted";
const runningStates: SyncState[] = ["pending", "running"];
const terminalStates: SyncState[] = ["complete", "error", "aborted"];

export function BandcampSyncModal({ open, onClose }: BandcampSyncModalProps) {
    const queryClient = useQueryClient();
    const { socket } = useStatusSocket();

    // Persist cookies in localStorage
    const [cookies, setCookies] = useLocalStorage<string>("bandcamp-cookies", "");

    // Sync state
    const [syncState, setSyncState] = useState<SyncState>("idle");
    const [logs, setLogs] = useState<string[]>([]);

    const logsEndRef = useRef<HTMLDivElement>(null);

    // Auto-scroll logs to bottom
    useEffect(() => {
        logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [logs]);

    // Handle WebSocket updates
    const handleSyncUpdate = useCallback(
        (data: BandcampSyncUpdate) => {
            // Append logs if present
            if (data.logs && data.logs.length > 0) {
                const newLogs = data.logs;
                setLogs((prev) => [...prev, ...newLogs]);
            }

            // Update state based on status
            switch (data.status) {
                case "complete":
                case "error":
                case "aborted":
                    void queryClient.invalidateQueries({ queryKey: ["bandcamp", "status"] });
                    break;
            }

            if (data.status !== syncState) {
                setSyncState(data.status);
            }
        },
        [queryClient, syncState]
    );

    // Subscribe to WebSocket updates
    useEffect(() => {
        if (!socket) return;

        socket.on("bandcamp_sync_update", handleSyncUpdate);

        return () => {
            socket.off("bandcamp_sync_update", handleSyncUpdate);
        };
    }, [socket, handleSyncUpdate]);

    const startSync = async () => {
        // Reset state
        setSyncState("pending");
        setLogs([]);

        try {
            const response = await startBandcampSync(cookies);

            if (!response.started) {
                // Already running
                setLogs(["Sync already in progress..."]);
            }

            void queryClient.invalidateQueries({ queryKey: ["bandcamp", "status"] });
        } catch {
            setSyncState("error");
            setLogs(["Failed to start sync"]);
        }
    };

    const isRunning = runningStates.includes(syncState);
    const isTerminalState = terminalStates.includes(syncState);

    return (
        <Dialog open={open} onClose={onClose} title="Bandcamp Sync">
            <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {/* Cookie input */}
                <Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        This feature uses bandcampsync and requires a valid session cookie from
                        bandcamp.com. Paste your cookie in the field below. It will only be stored
                        in your browser's local storage.{" "}
                        <Link href="https://github.com/meeb/bandcampsync?tab=readme-ov-file#configuration">
                            Read these docs for help getting set up.
                        </Link>
                    </Typography>
                    <TextField
                        fullWidth
                        placeholder="identity=XXX; csrf_token=XXX; cart_client_id=XXX; ..."
                        value={cookies}
                        onChange={(e) => setCookies(e.target.value)}
                        disabled={isRunning}
                        sx={{
                            fontFamily: "monospace",
                            "& .MuiInputBase-input": {
                                fontFamily: "monospace",
                                fontSize: "0.875rem",
                            },
                        }}
                    />
                </Box>

                {/* Progress/Logs area */}
                {(syncState !== "idle" || logs.length > 0) && (
                    <Box
                        sx={{
                            backgroundColor: "grey.900",
                            borderRadius: 1,
                            padding: 2,
                            maxHeight: "300px",
                            overflow: "auto",
                            fontFamily: "monospace",
                            fontSize: "0.75rem",
                        }}
                    >
                        {isRunning && logs.length === 0 && (
                            <Box
                                sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 1,
                                    color: "grey.400",
                                }}
                            >
                                <CircularProgress size={16} />
                                <span>Starting sync...</span>
                            </Box>
                        )}
                        {logs.map((log, i) => (
                            <Typography
                                key={i}
                                variant="body2"
                                sx={{
                                    fontFamily: "monospace",
                                    fontSize: "0.75rem",
                                    color: log.includes("[ERROR]")
                                        ? "error.main"
                                        : log.includes("[WARNING]")
                                          ? "warning.main"
                                          : "grey.300",
                                    whiteSpace: "pre-wrap",
                                    wordBreak: "break-word",
                                }}
                            >
                                {log}
                            </Typography>
                        ))}
                        <div ref={logsEndRef} />
                    </Box>
                )}

                {/* Status message */}
                {isTerminalState && (
                    <Alert
                        severity={
                            syncState === "complete"
                                ? "success"
                                : syncState === "error"
                                  ? "error"
                                  : "warning"
                        }
                    >
                        {syncState === "complete" && "Sync completed successfully!"}
                        {syncState === "error" && "Sync failed. Check the logs above."}
                        {syncState === "aborted" && "Sync was aborted."}
                    </Alert>
                )}
            </DialogContent>

            <DialogActions sx={{ padding: 2, gap: 1 }}>
                {isRunning ? (
                    <Button
                        variant="contained"
                        color="warning"
                        onClick={() => void abortBandcampSync()}
                        startIcon={<XCircleIcon size={18} />}
                    >
                        Abort
                    </Button>
                ) : (
                    <Button
                        variant="contained"
                        color="primary"
                        onClick={() => void startSync()}
                        disabled={!cookies.trim()}
                        startIcon={<CloudDownloadIcon size={18} />}
                    >
                        Start Sync
                    </Button>
                )}
                <Button variant="outlined" onClick={onClose}>
                    Close
                </Button>
            </DialogActions>
        </Dialog>
    );
}
