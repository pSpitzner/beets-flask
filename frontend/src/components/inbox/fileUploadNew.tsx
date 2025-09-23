import { Box, Card, alpha } from "@mui/material";
import {
    useCallback,
    useEffect,
    useRef,
    useState,
    createContext,
    useContext,
} from "react";
import { createPortal } from "react-dom";

import React from "react";
import { useMutation } from "@tanstack/react-query";
import { fileUploadMutationOptions } from "@/api/fileUpload";

// Context to track global drag state
interface DragContextType {
    isOverWindow: boolean;
    hoveredZoneId: string | null;
    setHoveredZoneId: (id: string | null) => void;
    setIsOverWindow: (isOver: boolean) => void;
    resetDragState: () => void;
}

const DragContext = createContext<DragContextType | null>(null);

// Provider component to wrap multiple DropZones
export function DragProvider({ children }: { children: React.ReactNode }) {
    const [isOverWindow, setIsOverWindow] = useState(false);
    const [hoveredZoneId, setHoveredZoneId] = useState<string | null>(null);

    const resetDragState = useCallback(() => {
        setIsOverWindow(false);
        setHoveredZoneId(null);
    }, []);

    useEffect(() => {
        const abortController = new AbortController();

        // Global window events
        window.addEventListener(
            "dragover",
            (e) => {
                e.preventDefault(); // Prevent default to allow drop
                setIsOverWindow(true);
            },
            {
                signal: abortController.signal,
            }
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
            {
                signal: abortController.signal,
            }
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
            {
                signal: abortController.signal,
            }
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
            }}
        >
            {children}
            {isOverWindow &&
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
                        }}
                    />,
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

    const { isOverWindow, hoveredZoneId, setHoveredZoneId, resetDragState } =
        dragContext;
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
            if (files && files.length > 0) {
                console.log("Dropped files:", files);
                // TODO: Upload the first file only
                mutate({ file: files[0], targetDir: targetDir });
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
    }, [ref, setHoveredZoneId, mutate, id, targetDir, resetDragState]);

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
