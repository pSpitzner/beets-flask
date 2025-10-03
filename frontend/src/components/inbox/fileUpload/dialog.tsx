/** Upload dialog
 *
 * Is triggered when files are dropped, there are multiple scenarios:
 * ...
 */

import { CheckIcon, FileMusicIcon, Upload, XIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
    alpha,
    Box,
    Button,
    Chip,
    DialogContent,
    FormHelperText,
    IconButton,
    LinearProgress,
    TextField,
    Typography,
    useTheme,
} from "@mui/material";

import { useConfig } from "@/api/config";
import { Dialog } from "@/components/common/dialogs";
import { useDragAndDrop } from "@/components/common/hooks/useDrag";
import { humanizeBytes } from "@/components/common/units/bytes";
import { humanizeDuration } from "@/components/common/units/time";

import { useFileUploadContext } from "./context";

export function UploadDialog() {
    const [open, setOpen] = useState(false);
    const { uploadState, fileList } = useFileUploadContext();
    const [title, setTitle] = useState<string>("Upload files");

    useEffect(() => {
        const inner = `${fileList.length} file${fileList.length !== 1 ? "s" : ""}`;

        if (fileList.length > 0) {
            setOpen(true);
            setTitle(`Upload ${inner}`);
        } else {
            setTitle("Upload files");
        }

        // PS @ SM: I played around with state-dependent titles but it felt like too much.
        // if (uploadState.isIdle) {
        //     setTitle(`Upload ${inner}`);
        // } else if (uploadState.isPending) {
        //     setTitle(`Uploading ${inner}...`);
        // } else if (uploadState.isSuccess) {
        //     setTitle(`Uploaded ${inner}`);
        // } else if (uploadState.isError) {
        //     setTitle(`Error uploading ${inner}`);
        // }
    }, [fileList.length]);

    useEffect(() => {
        // Close dialog 3 seconds after upload is done
        let timeout: NodeJS.Timeout;
        if (uploadState.isSuccess || uploadState.isError) {
            timeout = setTimeout(() => {
                setOpen(false);
                // currently staying below the 3s used in the mutation hook.
            }, 2800);
        }
        return () => clearTimeout(timeout);
    }, [uploadState.isSuccess, uploadState.isError]);

    return (
        <Dialog
            open={open}
            title={title}
            onClose={() => {
                setOpen(false);
            }}
            title_icon={null}
        >
            <DialogContent>
                <Box
                    sx={{
                        width: "100%",
                        display: "flex",
                        flexDirection: "column",
                        gap: 2,
                    }}
                >
                    <FolderSelector />
                    <FileDropZone targetDir="" />
                    <UploadFinished />
                    <SelectedFilesListAndProgress />
                    <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                        <CancelButton setOpen={setOpen} />
                        <UploadButton />
                    </Box>
                </Box>
            </DialogContent>
        </Dialog>
    );
}

function FileProgressBar({
    file,
    removeFile,
}: {
    file: string;
    removeFile: () => void;
}) {
    const theme = useTheme();
    const { uploadProgress, uploadState } = useFileUploadContext();

    const fileProgress = useMemo(() => {
        return uploadProgress.files.find((f) => f.name === file);
    }, [uploadProgress, file]);

    let percent = fileProgress?.total
        ? (fileProgress.loaded / fileProgress.total) * 100
        : 0;

    // Workaround for files with 0 bytes
    if (fileProgress?.total == 0 && fileProgress?.finished) {
        percent = 100;
    }

    return (
        <Box
            sx={{
                position: "relative",
                width: "100%",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
            }}
        >
            <Box
                sx={{
                    position: "absolute",
                    width: "100%",
                    height: "100%",
                    top: 0,
                    left: 0,
                    zIndex: 0,
                }}
            >
                <LinearProgress
                    variant="determinate"
                    value={percent}
                    sx={{
                        height: `100%`,
                        borderRadius: 1,
                        backgroundColor: "rgba(255, 255, 255, 0.05)",

                        "& .MuiLinearProgress-bar": {
                            backgroundColor: "primary.muted",
                        },
                    }}
                />
            </Box>

            <Typography
                variant="body1"
                sx={{ zIndex: 1, paddingLeft: 1, flex: 1, wordBreak: "break-word" }}
            >
                {file}
            </Typography>
            <Box sx={{ flexShrink: 0 }}>
                <IconButton
                    size="small"
                    disabled={!uploadState.isIdle}
                    onClick={removeFile}
                >
                    {fileProgress && uploadState.isPending && (
                        <Typography variant="body2" fontSize="small">
                            {percent.toFixed(0)}%
                        </Typography>
                    )}
                    {fileProgress?.finished && <CheckIcon size={theme.iconSize.sm} />}
                    {uploadState.isIdle && !fileProgress?.finished && (
                        <XIcon size={theme.iconSize.sm} />
                    )}
                </IconButton>
            </Box>
        </Box>
    );
}

/** Selected files list component
 *
 * This component displays the list of files selected for upload.
 * It allows users to remove files from the list before uploading.
 */
function SelectedFilesListAndProgress() {
    const { fileList, setFileList, uploadTargetDir } = useFileUploadContext();

    const handleRemoveFile = (index: number) => {
        // Remove file from the selected files
        setFileList((prevFiles) => prevFiles.filter((_, i) => i !== index));
    };

    if (fileList.length === 0) {
        return <Typography variant="body2">No files selected for upload.</Typography>;
    }

    return (
        <>
            <Typography variant="caption" fontWeight="bold" color="text.secondary">
                Files:
            </Typography>
            <Box
                sx={{
                    width: "100%",
                    overflowY: "auto",
                    display: "flex",
                    flexDirection: "column",
                    gap: 0.5,
                    pl: 0.5,
                }}
            >
                {fileList.map((file, index) => (
                    <FileProgressBar
                        file={file.name}
                        removeFile={() => handleRemoveFile(index)}
                        key={index}
                    />
                ))}
            </Box>
        </>
    );
}

/** Folder selector component
 * This component allows users to specify a subfolder within the selected inbox folder
 * where the files will be uploaded.
 */
function FolderSelector() {
    const { uploadTargetDir, setUploadTargetDir, uploadState } = useFileUploadContext();
    const config = useConfig();

    let is_valid = false;
    for (const folder of Object.values(config.gui.inbox.folders)) {
        if (uploadTargetDir?.startsWith(folder.path)) is_valid = true;
    }

    return (
        <TextField
            fullWidth
            error={!is_valid}
            label="Target Folder"
            helperText={is_valid ? null : "Folder must be inside an inbox"}
            disabled={!uploadState.isIdle}
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

/** Upload button component
 * This component displays a button to start the upload process.
 * It shows the number of selected files and the target upload path.
 */
function UploadButton() {
    const { uploadTargetDir, fileList, uploadFiles, uploadState } =
        useFileUploadContext();

    if (uploadState.isSuccess || uploadState.isError) return null;

    return (
        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <Button
                variant="contained"
                color="primary"
                startIcon={<Upload />}
                onClick={uploadFiles}
                loading={uploadState?.isPending}
            >
                Start upload
            </Button>
        </Box>
    );
}

function CancelButton({ setOpen }: { setOpen?: (open: boolean) => void }) {
    const { resetProgress, uploadState } = useFileUploadContext();

    if (uploadState.isSuccess || uploadState.isError) return null;

    return (
        <Box sx={{ display: "flex", justifyContent: "center" }}>
            <Button
                variant="outlined"
                color="primary"
                onClick={() => {
                    resetProgress();
                    if (setOpen) setOpen(false);
                }}
                startIcon={<XIcon />}
            >
                Cancel
            </Button>
        </Box>
    );
}

/* -------------------------------- Dropzone -------------------------------- */

function FileDropZone({ targetDir }: { targetDir: string }) {
    const ref = useRef<HTMLDivElement>(null);
    const theme = useTheme();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const { fileList, setFileList, uploadState, uploadTargetDir } =
        useFileUploadContext();

    const isDragOver = useDragAndDrop(ref, {
        onDrop: (event) => {
            if (!event.dataTransfer) return;
            setFileList((prevFiles) => {
                if (!event.dataTransfer) return prevFiles;
                return [...prevFiles, ...Array.from(event.dataTransfer.files)];
            });
        },
    });

    if (uploadState.isSuccess || uploadState.isError) return null;
    // Don't show dropzone when we are done, space is taken by upload finished component

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
                    backgroundColor: alpha(theme.palette.primary.main, 0.05),
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

            {fileList.length == 0 && (
                // big box when no files added yet.
                <>
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
                </>
            )}

            {fileList.length > 0 && (
                // otherwise smaller box
                <>
                    <Typography variant="body2" color="text.secondary">
                        Add more files ...
                    </Typography>
                </>
            )}
        </Box>
    );
}

/* ----------------------------- Upload Progress ---------------------------- */

function UploadFinished() {
    const { uploadState, uploadProgress } = useFileUploadContext();

    if (
        !uploadState ||
        !uploadProgress ||
        !uploadProgress.started ||
        !uploadProgress.finished ||
        uploadState.isPending ||
        uploadState.isIdle
    ) {
        return null;
    }

    return (
        <Box
            sx={(theme) => ({
                border: "2px solid",
                borderColor: theme.palette.secondary.main,
                color: theme.palette.secondary.main,
                paddingInline: 4,
                paddingBlock: 2,
                textAlign: "center",
                borderRadius: 1,
                gap: 2,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
            })}
        >
            <Typography variant="body2">
                Uploaded {uploadProgress.files.length} file
                {uploadProgress.files.length > 1 ? "s" : ""} (
                {humanizeBytes(uploadProgress.total)}) in{" "}
                {humanizeDuration(
                    (uploadProgress.finished - uploadProgress.started) / 1000
                )}
            </Typography>
        </Box>
    );
}
