import { FileMusicIcon, FolderUpIcon, Upload } from "lucide-react";
import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import {
    Box,
    Button,
    Chip,
    DialogContent,
    FormControl,
    FormHelperText,
    InputLabel,
    MenuItem,
    Select,
    TextField,
    Typography,
    useTheme,
} from "@mui/material";

import { MinimalConfig, useConfig } from "@/api/config";

import { Dialog } from "../common/dialogs";

interface DropzoneProps {
    children: React.ReactNode;
}

export default function InboxDropzone({ children }: DropzoneProps) {
    const [open, setOpen] = useState(false);

    useEffect(() => {
        const handleDragEnter = (e: DragEvent) => {
            if (e.dataTransfer && e.dataTransfer.files) setOpen(true);
        };
        window.addEventListener("dragenter", handleDragEnter);
        return () => {
            window.removeEventListener("dragenter", handleDragEnter);
        };
    }, []);

    return (
        <>
            {children}
            {
                <Dialog
                    title="Drop files to upload"
                    title_icon={<FolderUpIcon />}
                    open={open}
                    onClose={() => setOpen(false)}
                >
                    <FileUploadContextProvider>
                        <DialogContent>
                            <FileUploadForm />
                        </DialogContent>
                    </FileUploadContextProvider>
                </Dialog>
            }
        </>
    );
}

/* --------------------------------- Dialog --------------------------------- */

function FileUploadForm() {
    const { selectedFiles } = useFileUploadContext();

    return (
        <Box
            sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 4,
            }}
        >
            <Box
                sx={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 2,
                }}
            >
                <Typography variant="body1" textAlign="center">
                    Select files to upload to an inbox folder.
                </Typography>
                <FileUpload />
            </Box>

            {selectedFiles.length > 0 && (
                <>
                    <SelectedFilesList />
                    <Box
                        sx={{
                            width: "100%",
                            display: "flex",
                            flexDirection: "column",
                            gap: 2,
                        }}
                    >
                        <InboxSelector />
                        <FolderSelector />
                    </Box>

                    <UploadButton />
                </>
            )}
        </Box>
    );
}

/* --------------------------------- Context -------------------------------- */

interface FileUploadContextProps {
    selectedFiles: File[];
    setSelectedFiles: React.Dispatch<React.SetStateAction<File[]>>;

    // Select inbox folder for upload (by idx)
    inboxFolders: MinimalConfig["gui"]["inbox"]["folders"][string][];
    selectedInbox: MinimalConfig["gui"]["inbox"]["folders"][string] | undefined;
    selectedInboxIdx: number;
    setSelectedInboxIdx: React.Dispatch<React.SetStateAction<number>>;

    uploadPath: string; // Relative to inbox folder
    setUploadPath: React.Dispatch<React.SetStateAction<string>>;
}

const FileUploadContext = createContext<FileUploadContextProps | null>(null);

function FileUploadContextProvider({ children }: { children: React.ReactNode }) {
    const config = useConfig();

    // Selected inbox for upload
    const [selectedInboxIdx, setSelectedInboxIdx] = useState(0);
    const inboxFolders = useMemo(() => {
        return Object.entries(config.gui.inbox.folders).map(([_key, value]) => value);
    }, [config.gui.inbox.folders]);
    const selectedInbox = useMemo(() => {
        return inboxFolders.at(selectedInboxIdx);
    }, [inboxFolders, selectedInboxIdx]);

    // Selected path for upload (relative to inbox folder)
    const [uploadPath, setUploadPath] = useState<string>("");

    // Files selected for upload
    const [selectedFiles, _setSelectedFiles] = useState<File[]>([]);
    const setSelectedFiles = useCallback(
        (files: File[] | ((prevFiles: File[]) => File[])) => {
            _setSelectedFiles((prevFiles) => {
                const newFiles = typeof files === "function" ? files(prevFiles) : files;
                // Set upload path to the first file name if not set
                if (newFiles.length > 0 && !uploadPath) {
                    let newUploadPath = newFiles[0].name;
                    newUploadPath = newUploadPath.split(".").slice(0, -1).join(".");

                    if (!newFiles[0].name.startsWith("/")) {
                        newUploadPath = `/${newUploadPath}`;
                    }
                    if (!newUploadPath.endsWith("/")) {
                        newUploadPath += "/";
                    }
                    setUploadPath(newUploadPath);
                }
                return newFiles.filter((file) => file instanceof File);
            });
        },
        [uploadPath, setUploadPath]
    );

    // TODO: Logic to upload files to the server
    // TODO: File validation (e.g., allowed file types, size limits)
    // TODO: Backend logic, endpoint and api to handle file uploads

    return (
        <FileUploadContext.Provider
            value={{
                selectedFiles,
                setSelectedFiles,

                inboxFolders,
                selectedInbox,
                selectedInboxIdx,
                setSelectedInboxIdx,

                uploadPath,
                setUploadPath,
            }}
        >
            {children}
        </FileUploadContext.Provider>
    );
}

function useFileUploadContext() {
    const context = useContext(FileUploadContext);
    if (!context) {
        throw new Error(
            "useFileUpload must be used within a FileUploadContextProvider"
        );
    }
    return context;
}

/* ------------------------------- Components ------------------------------- */

/** File upload component
 *
 * This component allows users to select files for upload by clicking on the dropzone
 * or dragging and dropping files into the window.
 */
function FileUpload() {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isDragOver, setIsDragOver] = useState(false);
    const theme = useTheme();
    const { setSelectedFiles } = useFileUploadContext();

    // Attach drag events to window to handle drag and drop
    useEffect(() => {
        const handleDragOver = (e: DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDragOver(true);
        };

        const handleDragLeave = (e: DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDragOver(false);
        };
        const handleDrop = (e: DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDragOver(false);

            // Add files to the context
            const files = Array.from(e.dataTransfer?.files || []);
            if (files.length > 0) {
                setSelectedFiles((prevFiles) => [...prevFiles, ...files]);
            }
        };

        window.addEventListener("dragover", handleDragOver);
        window.addEventListener("dragleave", handleDragLeave);
        window.addEventListener("dragenter", handleDragOver);
        window.addEventListener("dragend", handleDragLeave);
        window.addEventListener("drop", handleDrop);

        return () => {
            window.removeEventListener("dragover", handleDragOver);
            window.removeEventListener("dragleave", handleDragLeave);
            window.removeEventListener("dragenter", handleDragOver);
            window.removeEventListener("dragend", handleDragLeave);
            window.removeEventListener("drop", handleDrop);
        };
    }, [setSelectedFiles]);

    return (
        <Box
            sx={{
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
            }}
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
                        setSelectedFiles((prevFiles) => [...prevFiles, ...files]);
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

/** Selected files list component
 *
 * This component displays the list of files selected for upload.
 * It allows users to remove files from the list before uploading.
 */
function SelectedFilesList() {
    const { selectedFiles, setSelectedFiles } = useFileUploadContext();

    const handleRemoveFile = (index: number) => {
        // Remove file from the selected files
        setSelectedFiles((prevFiles) => prevFiles.filter((_, i) => i !== index));
    };

    if (selectedFiles.length === 0) {
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
                Selected files for upload ({selectedFiles.length}):
            </Typography>
            <Box
                sx={(theme) => ({
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 1,
                    maxWidth: theme.breakpoints.values.tablet,
                })}
            >
                {selectedFiles.map((file, index) => (
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

/** Inbox selector component
 * This component allows users to select an inbox folder for upload.
 * It displays a dropdown with the available inbox folders configured in the application.
 */
function InboxSelector() {
    const { inboxFolders, selectedInboxIdx, setSelectedInboxIdx } =
        useFileUploadContext();

    if (inboxFolders.length === 0) {
        return (
            <Typography variant="body2" color="text.secondary">
                No inbox folders configured!
            </Typography>
        );
    }

    return (
        <FormControl fullWidth>
            <InputLabel id="inbox-select-label">Upload to inbox</InputLabel>
            <Select
                labelId="inbox-select-label"
                value={selectedInboxIdx}
                label="Upload to inbox"
                onChange={(e) => setSelectedInboxIdx(e.target.value)}
                size="small"
            >
                {inboxFolders.map((folder, i) => (
                    <MenuItem key={folder.name} value={i}>
                        <Box
                            sx={{
                                display: "flex",
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 1,
                            }}
                        >
                            <Typography variant="body1" fontFamily="monospace">
                                {folder.path}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                                ({folder.name})
                            </Typography>
                        </Box>
                    </MenuItem>
                ))}
            </Select>
        </FormControl>
    );
}

/** Folder selector component
 * This component allows users to specify a subfolder within the selected inbox folder
 * where the files will be uploaded.
 */
function FolderSelector() {
    const { uploadPath, setUploadPath } = useFileUploadContext();

    return (
        <TextField
            fullWidth
            label="into folder"
            value={uploadPath}
            onChange={(e) => setUploadPath(e.target.value)}
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
    const { uploadPath, selectedInbox, selectedFiles } = useFileUploadContext();

    const parts = useMemo(() => {
        const parts = [];
        parts.push(...(selectedInbox?.path.split("/") || []));
        parts.push(...uploadPath.split("/"));
        return parts.filter(Boolean);
    }, [selectedInbox, uploadPath]);

    uploadPath.split("/").filter(Boolean);

    return (
        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <Button
                variant="contained"
                color="primary"
                startIcon={<Upload />}
                onClick={() => {
                    // Handle upload logic here
                    alert(
                        `Uploading ${selectedFiles.length} file${
                            selectedFiles.length !== 1 ? "s" : ""
                        } to ${parts.join("/")}`
                    );
                }}
            >
                Start upload
            </Button>
            <FormHelperText sx={{ mt: 1, textAlign: "center" }}>
                Uploading {selectedFiles.length} file
                {selectedFiles.length !== 1 ? "s" : ""} into{" "}
                <Typography variant="caption">{parts.join("/")}</Typography>
            </FormHelperText>
        </Box>
    );
}
