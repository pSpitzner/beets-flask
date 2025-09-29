/** Upload dialog
 *
 * Is triggered when files are dropped, there are multiple scenarios:
 * ...
 */

import { FileMusicIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
    Box,
    Chip,
    DialogContent,
    LinearProgress,
    TextField,
    Typography,
    useTheme,
} from "@mui/material";

import { Dialog } from "@/components/common/dialogs";
import { useDragAndDrop } from "@/components/common/hooks/useDrag";
import { humanizeBytes } from "@/components/common/units/bytes";

import { useFileUploadContext } from "./context";

export function UploadDialog() {
    const [open, setOpen] = useState(false);
    const { uploadState, fileList } = useFileUploadContext();

    useEffect(() => {
        if (uploadState?.isPending) {
            setOpen(true);
        }
    }, [uploadState]);

    return (
        <Dialog
            open={fileList !== null || open}
            title="Uploading files"
            onClose={() => {
                setOpen(false);
            }}
            title_icon={null}
        >
            <DialogContent>
                <FileDropZone targetDir="" />
                <SelectedFilesList />
                <Box
                    sx={{
                        width: "100%",
                        display: "flex",
                        flexDirection: "column",
                        gap: 2,
                    }}
                >
                    <FolderSelector />
                </Box>
                <UploadFinished />
                <UploadInProgress />
            </DialogContent>
        </Dialog>
    );
}

/** Selected files list component
 *
 * This component displays the list of files selected for upload.
 * It allows users to remove files from the list before uploading.
 */
function SelectedFilesList() {
    const { fileList, setFileList } = useFileUploadContext();

    const handleRemoveFile = (index: number) => {
        // Remove file from the selected files
        setFileList((prevFiles) => prevFiles.filter((_, i) => i !== index));
    };

    if (fileList.length === 0) {
        return (
            <Typography variant="body2" color="text.secondary">
                No files selected for upload.
            </Typography>
        );
    }

    return (
        <Box
            sx={{
                width: "100%",
                maxHeight: 300,
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
            }}
        >
            <Typography variant="subtitle2" gutterBottom>
                Selected files for upload ({fileList.length}):
            </Typography>
            <Box
                sx={(theme) => ({
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 1,
                    maxWidth: theme.breakpoints.values.tablet,
                })}
            >
                {fileList.map((file, index) => (
                    <Chip
                        key={index}
                        label={file.name}
                        onDelete={() => handleRemoveFile(index)}
                        variant="outlined"
                        size="small"
                    />
                ))}
            </Box>
        </Box>
    );
}

/** Folder selector component
 * This component allows users to specify a subfolder within the selected inbox folder
 * where the files will be uploaded.
 */
function FolderSelector() {
    const { uploadTargetDir, setUploadTargetDir } = useFileUploadContext();

    return (
        <TextField
            fullWidth
            label="into folder"
            value={uploadTargetDir}
            onChange={(e) => setUploadTargetDir(e.target.value)}
            placeholder="Enter folder name"
            size="small"
            sx={{
                input: {
                    fontFamily: "monospace",
                    letterSpacing: "0.00938em",
                },
            }}
        />
    );
}

/* -------------------------------- Dropzone -------------------------------- */

function FileDropZone({ targetDir }: { targetDir: string }) {
    const ref = useRef<HTMLDivElement>(null);
    const theme = useTheme();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const isDragOver = useDragAndDrop(ref);
    const { fileList, setFileList } = useFileUploadContext();

    return (
        <Box
            ref={ref}
            sx={(theme) => ({
                border: "2px dashed",
                paddingInline: 4,
                paddingBlock: 2,
                textAlign: "center",
                borderRadius: 1,
                gap: 2,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                // On drag over animate the border and slight lift the box
                borderColor: isDragOver
                    ? theme.palette.primary.contrastText
                    : theme.palette.primary.muted,
                boxShadow: isDragOver
                    ? `0px 4px 10px ${theme.palette.primary.main}33`
                    : "none",
                backgroundColor: isDragOver
                    ? theme.palette.primary.muted
                    : theme.palette.background.paper,
                transition: "border-color 0.2s, box-shadow 0.2s, background-color 0.2s",

                "&:hover": {
                    cursor: "pointer",
                },
            })}
            onClick={() => fileInputRef.current?.click()}
        >
            <input
                ref={fileInputRef}
                type="file"
                hidden
                multiple
                onChange={(e) => {
                    // Add files to the context
                    const files = Array.from(e.target.files || []);
                    if (files.length > 0) {
                        setFileList((prevFiles) => [...prevFiles, ...files]);
                    }
                }}
            />

            <Box>
                <Typography
                    variant="h6"
                    color={
                        isDragOver
                            ? theme.palette.primary.contrastText
                            : theme.palette.primary.muted
                    }
                    textAlign="center"
                >
                    Drag and drop files here
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    or click to select files
                </Typography>
            </Box>

            <FileMusicIcon
                size={60}
                strokeWidth={1}
                color={
                    isDragOver
                        ? theme.palette.primary.contrastText
                        : theme.palette.primary.muted
                }
            />

            <Typography variant="body2" color="text.secondary">
                Allowed file types: any
            </Typography>
        </Box>
    );
}

/* ----------------------------- Upload Progress ---------------------------- */

function UploadFinished() {
    const { uploadState } = useFileUploadContext();
    const uploadProgress = uploadState.uploadProgress;

    if (!uploadState) return null;

    if (
        !uploadState ||
        !uploadProgress ||
        uploadState.isPending ||
        uploadState.isIdle
    ) {
        return null;
    }

    return (
        <Box>
            <Box>Uploaded {uploadProgress.files.nTotal} files!</Box>
            <Box sx={{ mt: 2, color: "text.secondary" }}>
                <Box>{humanizeBytes(uploadProgress.files.total)}</Box>
                {uploadProgress.files.finished && (
                    <Box>
                        {uploadProgress.files.finished - uploadProgress.files.started}{" "}
                        ms
                    </Box>
                )}
            </Box>
            <Box>
                {uploadProgress.files.names.map((name) => (
                    <Box key={name}>{name}</Box>
                ))}
            </Box>
        </Box>
    );
}

function UploadInProgress() {
    const { uploadState } = useFileUploadContext();
    const uploadProgress = uploadState.uploadProgress;

    if (!uploadState) return null;

    if (!uploadState || !uploadProgress || !uploadState.isPending) {
        return null;
    }

    let statusText = "Uploading files...";
    if (uploadProgress && uploadProgress.files.nTotal > 1) {
        statusText = `Uploading ${uploadProgress?.name} (${uploadProgress?.currentIndex + 1}/${
            uploadProgress?.files.nTotal
        }) ...`;
    } else {
        statusText = `Uploading ${uploadProgress?.name} ...`;
    }

    return (
        <Box sx={{ width: "100%" }}>
            <Box sx={{ color: "primary.main" }}>{statusText}</Box>
            <Box sx={{ mb: 2, mt: 1, color: "text.secondary" }}>
                {(
                    (uploadProgress.files.loaded / uploadProgress.files.total) *
                    100
                ).toFixed(0)}
                % complete
            </Box>
            <LinearProgress
                variant="determinate"
                value={(uploadProgress.files.loaded / uploadProgress.files.total) * 100}
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
                    value={(uploadProgress.loaded / uploadProgress.total) * 100}
                    sx={{
                        mt: 1,
                        height: 8,
                        borderRadius: 4,
                        width: "100%",
                    }}
                />
            )}
        </Box>
    );
}
