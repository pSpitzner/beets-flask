import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useRef,
    useState,
} from "react";
import React from "react";
import { createPortal } from "react-dom";
import { alpha, Box, LinearProgress } from "@mui/material";
import { useMutation } from "@tanstack/react-query";

import { fileUploadMutationOptions } from "@/api/fileUpload";

// Context to track global drag state
interface DragContextType {
    isOverWindow: boolean;
    hoveredZoneId: string | null;
    setHoveredZoneId: (id: string | null) => void;
    setIsOverWindow: (isOver: boolean) => void;
    resetDragState: () => void;
    uploadState: UploadState | null;
    setUploadState: React.Dispatch<React.SetStateAction<UploadState | null>>;
}

interface UploadState {
    id: string; // dropzone id where upload is happening
    fileName?: string;
    progress: number; // 0-100
    status: "uploading" | "success" | "error";
    error?: string;
}

const DragContext = createContext<DragContextType | null>(null);

// Provider component to wrap multiple DropZones
export function DragProvider({ children }: { children: React.ReactNode }) {
    const [isOverWindow, setIsOverWindow] = useState(false);
    const [hoveredZoneId, setHoveredZoneId] = useState<string | null>(null);
    const [uploadState, setUploadState] = useState<UploadState | null>(null);

    const resetDragState = useCallback(() => {
        setIsOverWindow(false);
        setHoveredZoneId(null);
        // Don't reset upload state here - let upload completion handle it
    }, []);

    useEffect(() => {
        const abortController = new AbortController();

        // Global window events
        window.addEventListener(
            "dragover",
            (e) => {
                e.preventDefault();
                setIsOverWindow(true);
            },
            { signal: abortController.signal }
        );
        window.addEventListener("dragend", resetDragState, {
            signal: abortController.signal,
        });
        window.addEventListener(
            "dragleave",
            (e) => {
                // Only reset if we're leaving the window completely
                if (e.clientX === 0 && e.clientY === 0) {
                    setIsOverWindow(false);
                    setHoveredZoneId(null);
                }
            },
            { signal: abortController.signal }
        );
        window.addEventListener(
            "drop",
            (e) => {
                // Only prevent default and stop propagation if NOT over a valid dropzone
                if (!hoveredZoneId) {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log("Drop prevented - not over a valid dropzone");
                }
                resetDragState();
            },
            { signal: abortController.signal }
        );

        return () => {
            abortController.abort();
        };
    }, [resetDragState, hoveredZoneId, setIsOverWindow, setHoveredZoneId]);

    return (
        <DragContext.Provider
            value={{
                isOverWindow,
                hoveredZoneId,
                setHoveredZoneId,
                setIsOverWindow,
                resetDragState,
                uploadState,
                setUploadState,
            }}
        >
            {children}
            {(isOverWindow || uploadState) &&
                createPortal(
                    <Box
                        sx={{
                            position: "fixed",
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            backgroundColor: "rgba(0, 0, 0, 0.3)",
                            backdropFilter: "blur(5px)",
                            zIndex: 1000,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                        }}
                    >
                        {uploadState && (
                            <UploadStatusProgressOverlay uploadState={uploadState} />
                        )}
                    </Box>,
                    document.body
                )}
        </DragContext.Provider>
    );
}

export function DropZone({
    children,
    id,
    targetDir,
}: {
    children?: React.ReactNode;
    id: string;
    targetDir: string;
}) {
    const ref = useRef<HTMLDivElement>(null);
    const dragContext = useContext(DragContext);

    if (!dragContext) {
        throw new Error("DropZone must be used within a DragProvider");
    }

    const {
        isOverWindow,
        hoveredZoneId,
        setHoveredZoneId,
        resetDragState,
        setUploadState,
    } = dragContext;
    const isOverZone = hoveredZoneId === id;
    const isOverWindowButNotThis = isOverWindow && hoveredZoneId !== id;

    const { mutate } = useMutation(fileUploadMutationOptions);

    useEffect(() => {
        if (!ref.current) return;

        const dropzoneEl = ref.current;
        const abortController = new AbortController();

        const handleDragOver = (event: DragEvent) => {
            setHoveredZoneId(id);
            event.preventDefault();
            console.log("File(s) in drop zone");
        };

        const handleDrop = (event: DragEvent) => {
            event.preventDefault();
            event.stopPropagation();

            const files = event.dataTransfer?.files;
            console.log("Dropped files:", files);

            let fileName = undefined;
            if (files && files.length == 1) fileName = files[0].name;
            else if (files && files.length > 1)
                fileName = `'${files[0].name}' and ${files.length - 1} more`;

            if (areValidFiles(files)) {
                // Set upload state
                setUploadState({
                    id,
                    fileName: fileName,
                    progress: 0,
                    status: "uploading",
                });

                mutate(
                    {
                        file: files[0],
                        targetDir: targetDir,
                        onProgress: (percent) => {
                            console.log(`Upload progress: ${percent.toFixed(2)}%`);
                            setUploadState((prev) =>
                                prev ? { ...prev, progress: percent } : null
                            );
                        },
                    },
                    {
                        onSuccess: () => {
                            setUploadState((prev) =>
                                prev
                                    ? { ...prev, status: "success", progress: 100 }
                                    : null
                            );
                            // give some time to read after success
                            setTimeout(() => setUploadState(null), 2000);
                        },
                        onError: (error) => {
                            setUploadState((prev) =>
                                prev
                                    ? {
                                          ...prev,
                                          status: "error",
                                          error: error.message || "Upload failed",
                                      }
                                    : null
                            );
                            setTimeout(() => setUploadState(null), 3000);
                        },
                    }
                );
            } else {
                console.log("Invalid file(s) dropped:", files);
                setUploadState({
                    id,
                    fileName: fileName,
                    progress: 0,
                    status: "error",
                    error: "We only support uploading a single archive file (zip).",
                });
                setTimeout(() => setUploadState(null), 3000);
            }
            resetDragState();
        };

        // Dropzone related drag events
        dropzoneEl.addEventListener("dragover", handleDragOver, {
            signal: abortController.signal,
        });
        dropzoneEl.addEventListener("drop", handleDrop, {
            signal: abortController.signal,
        });
        dropzoneEl.addEventListener("dragleave", () => setHoveredZoneId(null), {
            signal: abortController.signal,
        });

        return () => {
            abortController.abort();
        };
    }, [ref, setHoveredZoneId, mutate, id, targetDir, resetDragState, setUploadState]);

    return (
        <Box
            ref={ref}
            sx={{
                position: "relative",
                zIndex: isOverWindow ? 1001 : "auto",
            }}
        >
            {children}
            {isOverZone && (
                <Box
                    // Style for the currently hovered inbox
                    sx={(theme) => ({
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        borderRadius: 2,
                        border: `2px dashed ${theme.palette.secondary.main}`,
                        backgroundColor: alpha(theme.palette.secondary.main, 0.1),
                        backdropFilter: "blur(2px)",
                        zIndex: 1,
                        pointerEvents: "none",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "2rem",
                        fontWeight: "bold",
                        color: theme.palette.secondary.main,
                        textShadow: `0 0 8px rgba(0,0,0,0.3)`,
                    })}
                >
                    Drop to upload
                </Box>
            )}
            {isOverWindowButNotThis && (
                <Box
                    // Style for non-hovered inboxes when another is being hovered
                    sx={(theme) => ({
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        borderRadius: 2,
                        border: `2px dashed ${theme.palette.primary.main}`,
                        backgroundColor: alpha(theme.palette.primary.main, 0.05),
                        backdropFilter: "blur(4px)",
                        margin: -0.5,
                        zIndex: 1,
                    })}
                ></Box>
            )}
        </Box>
    );
}

function areValidFiles(files: FileList | undefined | null): files is FileList {
    if (!files || files.length !== 1) {
        return false;
    }

    // only allow archive files for now
    const allowedTypes = [
        "application/zip",
        "application/gzip",
        "application/vnd.rar",
        "application/x-tar",
        "application/x-7z-compressed",
        "application/x-zip-compressed",
    ];

    return allowedTypes.includes(files[0].type);
}

function UploadStatusProgressOverlay({ uploadState }: { uploadState: UploadState }) {
    const getStatusColor = () => {
        switch (uploadState.status) {
            case "uploading":
                return "primary.main";
            case "success":
                return "success.main";
            case "error":
                return "error.main";
            default:
                return "primary.main";
        }
    };

    const getStatusText = () => {
        switch (uploadState.status) {
            case "uploading":
                return `Uploading ${uploadState.fileName}...`;
            case "success":
                return `${uploadState.fileName} uploaded successfully`;
            case "error":
                return (
                    <>
                        <div>{`Uploading ${uploadState.fileName} failed:`}</div>
                        <div>{uploadState.error || "Unknown error."}</div>
                    </>
                );
            default:
                return "";
        }
    };

    return (
        <Box
            sx={(theme) => ({
                backgroundColor: theme.palette.background.paper,
                backdropFilter: "blur(10px)",
                borderRadius: 2,
                padding: 3,
                minWidth: 400,
                maxWidth: 600,
                // border: `${theme.spacing(0.125)} solid ${theme.palette.divider}`,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                textAlign: "center",
                boxShadow: theme.shadows[12], // out of 25 levels of elevation
            })}
        >
            <Box sx={{ width: "100%" }}>
                <Box sx={{ color: getStatusColor() }}>{getStatusText()}</Box>
                {uploadState.status === "uploading" && (
                    <>
                        <Box sx={{ mb: 2, mt: 1, color: "text.secondary" }}>
                            {uploadState.progress.toFixed(1)}% complete
                        </Box>
                        <LinearProgress
                            variant="determinate"
                            value={uploadState.progress}
                            sx={{
                                height: 8,
                                borderRadius: 4,
                                width: "100%",
                            }}
                        />
                    </>
                )}
            </Box>
        </Box>
    );
}
