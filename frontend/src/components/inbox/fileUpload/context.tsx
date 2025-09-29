import { createContext, useContext, useState } from "react";
import React from "react";
import { createPortal } from "react-dom";
import { Box } from "@mui/material";

import { BatchFileUploadProgress, useFileUpload } from "@/api/fileUpload";
import { useDragAndDrop } from "@/components/common/hooks/useDrag";

import { UploadDialog } from "./dialog";

export type UploadState = Omit<
    ReturnType<typeof useFileUpload>,
    "mutate" | "mutateAsync" | "uploadProgress"
>;

// Context to track global drag state
interface DragContextType {
    isOverWindow: boolean;
    uploadState: UploadState;
    uploadProgress: BatchFileUploadProgress;
    fileList: Array<File>;
    setFileList: React.Dispatch<React.SetStateAction<Array<File>>>;
    uploadFiles: () => Promise<{ status: string }>;
    uploadTargetDir: string | null;
    setUploadTargetDir: React.Dispatch<React.SetStateAction<string | null>>;
    backdropRef?: React.RefObject<HTMLElement | null>;
}

const FileUploadContext = createContext<DragContextType | null>(null);

// Provider component to wrap multiple DropZones
export function FileUploadProvider({ children }: { children: React.ReactNode }) {
    const [fileList, setFileList] = useState<Array<File>>([]);
    const [uploadTargetDir, setUploadTargetDir] = useState<string | null>(null);

    const isOverWindow = useDragAndDrop(null, {
        preventDefault: true,
    });
    const { mutateAsync, uploadProgress, ...uploadState } = useFileUpload();

    return (
        <FileUploadContext.Provider
            value={{
                isOverWindow,
                uploadState,
                uploadProgress,
                uploadFiles: async () => {
                    if (!uploadTargetDir) {
                        throw new Error("No target directory set for upload");
                    }
                    return await mutateAsync(fileList, uploadTargetDir);
                },
                fileList,
                setFileList,
                uploadTargetDir,
                setUploadTargetDir,
            }}
        >
            {children}
            <UploadDialog />
            {createPortal(
                <Box
                    // blur the whole background, including navbars
                    sx={{
                        position: "fixed",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: "rgba(0, 0, 0, 0.3)",
                        backdropFilter: "blur(4px)",
                        pointerEvents: "none",
                        display: isOverWindow ? "flex" : "none",
                    }}
                ></Box>,
                document.body
            )}
        </FileUploadContext.Provider>
    );
}

export function useFileUploadContext() {
    const context = useContext(FileUploadContext);
    if (!context) {
        throw new Error(
            "useFileUploadContext must be used within a FileUploadProvider"
        );
    }
    return context;
}
