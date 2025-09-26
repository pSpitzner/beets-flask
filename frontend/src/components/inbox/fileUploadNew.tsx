/*
Cases:

Non-dialog:
- single zip file: easy, just upload.
- multiple zip files: upload sequentially,
  show two progress bars: one for current file, one for x/n files (or x/n mb) uploaded.

Dialog:
- single non-zip file: Create folder with same name as file, upload into that folder.
- multiple non-zip files: Use "first filename + x more" and ask user for folder name, upload all into that folder.

*/

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

import { useFileUpload } from "@/api/fileUpload";

type UploadState = Omit<ReturnType<typeof useFileUpload>, "mutate" | "mutateAsync">;

// Context to track global drag state
interface DragContextType {
    isOverWindow: boolean;
    hoveredZoneId: string | null;
    setHoveredZoneId: (id: string | null) => void;
    setIsOverWindow: (isOver: boolean) => void;
    resetDragState: () => void;
    uploadState: UploadState;
    uploadFiles: (
        files: FileList | File[],
        targetDir: string
    ) => Promise<{ status: string }>;
}

const DragContext = createContext<DragContextType | null>(null);

// Provider component to wrap multiple DropZones
export function DragProvider({ children }: { children: React.ReactNode }) {
    const [isOverWindow, setIsOverWindow] = useState(false);
    const [hoveredZoneId, setHoveredZoneId] = useState<string | null>(null);
    const { mutateAsync: uploadFiles, ...uploadState } = useFileUpload();

    const resetDragState = useCallback(() => {
        setIsOverWindow(false);
        setHoveredZoneId(null);
        // Don't reset upload state here - let upload completion handle it
    }, []);

    // Global window drag events
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

    // TODO: Use common dialog
    return (
        <DragContext.Provider
            value={{
                isOverWindow,
                hoveredZoneId,
                setHoveredZoneId,
                setIsOverWindow,
                resetDragState,
                uploadState,
                uploadFiles,
            }}
        >
            {children}
            {(isOverWindow || uploadState.isPending || uploadState.isSuccess) &&
                createPortal(
                    <Box
                        // blur the whole background, including navbars
                        sx={{
                            position: "fixed",
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            backgroundColor: "rgba(0, 0, 0, 0.3)",
                            backdropFilter: "blur(5px)",
                            zIndex: 1,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                        }}
                    >
                        {uploadState.uploadProgress && (
                            <UploadStatusProgressOverlay uploadState={uploadState} />
                        )}
                    </Box>,
                    document.body
                )}
        </DragContext.Provider>
    );
}

function useDragContext() {
    const context = useContext(DragContext);
    if (!context) {
        throw new Error("useDragContext must be used within a DragProvider");
    }
    return context;
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
    const {
        isOverWindow,
        hoveredZoneId,
        setHoveredZoneId,
        resetDragState,
        uploadFiles,
    } = useDragContext();

    const isOverZone = hoveredZoneId === id;
    const isOverWindowButNotThis = isOverWindow && hoveredZoneId !== id;

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

            const files: FileList | File[] = event.dataTransfer?.files || [];
            console.log("Dropped files:", files);

            uploadFiles(files, targetDir).catch((error) => {
                // TODO
                console.error("Upload failed:", error);
            });
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
    }, [ref, setHoveredZoneId, id, targetDir, resetDragState, uploadFiles]);

    return (
        <Box
            ref={ref}
            sx={{
                position: "relative",
                zIndex: isOverWindow ? 2 : "auto",
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
                        pointerEvents: "none",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "2rem",
                        fontWeight: "bold",
                        color: theme.palette.secondary.main,
                        textShadow: `0 0 8px rgba(0,0,0,0.3)`,
                        zIndex: 1,
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

function UploadStatusProgressOverlay({ uploadState }: { uploadState: UploadState }) {
    const uploadProgress = uploadState.uploadProgress;

    let statusColor = "primary.main";
    let statusText: React.ReactNode = "Uploading ...";
    switch (uploadState.status) {
        case "success":
            statusColor = "success.main";
            statusText = `Uploaded ${uploadProgress?.files.nTotal} file${uploadProgress && uploadProgress?.files.nTotal > 1 ? "s" : ""}.`;
            break;
        case "error":
            statusColor = "error.main";
            statusText = (
                <>
                    <div>{`Uploading ${uploadProgress?.name} failed:`}</div>
                    <div>{uploadState?.error?.message || "Unknown error."}</div>
                </>
            );
            break;
        case "pending":
            statusColor = "primary.main";
            if (uploadProgress && uploadProgress.files.nTotal > 1) {
                statusText = `Uploading ${uploadProgress?.name} (${uploadProgress?.currentIndex + 1}/${
                    uploadProgress?.files.nTotal
                }) ...`;
            } else {
                statusText = `Uploading ${uploadProgress?.name} ...`;
            }
            break;
    }

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
                <Box sx={{ color: statusColor }}>{statusText}</Box>
                {uploadState.isPending && uploadProgress && (
                    <>
                        <Box sx={{ mb: 2, mt: 1, color: "text.secondary" }}>
                            {(
                                (uploadProgress.files.loaded /
                                    uploadProgress.files.total) *
                                100
                            ).toFixed(0)}
                            % complete
                        </Box>
                        <LinearProgress
                            variant="determinate"
                            value={
                                (uploadProgress.files.loaded /
                                    uploadProgress.files.total) *
                                100
                            }
                            sx={{
                                height: 8,
                                borderRadius: 4,
                                width: "100%",
                            }}
                        />
                        {/* if multiple files, show secondary bar */}
                        {uploadProgress.files.nTotal > 1 && (
                            <LinearProgress
                                variant="determinate"
                                value={
                                    (uploadProgress.loaded / uploadProgress.total) * 100
                                }
                                sx={{
                                    mt: 1,
                                    height: 8,
                                    borderRadius: 4,
                                    width: "100%",
                                }}
                            />
                        )}
                    </>
                )}
            </Box>
        </Box>
    );
}
