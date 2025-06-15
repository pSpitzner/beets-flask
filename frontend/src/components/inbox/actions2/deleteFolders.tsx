import { Trash2Icon } from "lucide-react";
import { useMemo, useState } from "react";
import {
    Box,
    Button,
    DialogContent,
    Divider,
    Typography,
    useTheme,
} from "@mui/material";
import { useMutation, useQueries } from "@tanstack/react-query";

import { deleteFoldersMutationOptions, walkFolder } from "@/api/inbox";
import { sessionQueryOptions } from "@/api/session";
import { FolderStatusChip } from "@/components/common/chips";
import { Dialog } from "@/components/common/dialogs";
import { FolderTypeIcon } from "@/components/common/icons";
import { Folder, Progress } from "@/pythonTypes";

/**
 * A button component that allows bulk deletion of imported folders.
 *
 * Features:
 * - Lists all imported folders (with `IMPORT_COMPLETED` status) under the given root folder.
 * - Provides a confirmation dialog before deletion.
 * - Supports shift+click to skip confirmation and delete immediately.
 *
 */
export function DeleteImportedFoldersButton({ folder }: { folder: Folder }) {
    const theme = useTheme();
    const [open, setOpen] = useState(false);

    /** Get all folders that have a session with
     * `status.progress` equal to `Progress.IMPORT_COMPLETED`.
     */
    const folders = useMemo(() => {
        const fs = [];
        for (const f of walkFolder(folder)) {
            if (f.type === "file") continue; // skip files
            if (f.full_path === folder.full_path) continue; // skip the root folder
            fs.push(f);
        }
        return fs;
    }, [folder]);

    const sessions = useQueries({
        queries: folders.map((f) =>
            sessionQueryOptions({ folderHash: f.hash, folderPath: f.full_path })
        ),
    });

    const importedFolders = useMemo(() => {
        return folders.filter((f, i) => {
            const session = sessions[i];
            return session.data?.status.progress === Progress.IMPORT_COMPLETED;
        });
    }, [folders, sessions]);

    /** Delete folder mutation */
    const { mutateAsync: deleteFolders, isPending } = useMutation(
        deleteFoldersMutationOptions
    );

    return (
        <>
            <Button
                onClick={(e) => {
                    // On shift + click, delete all imported folders without confirmation
                    if (e.shiftKey) {
                        deleteFolders({
                            folderPaths: importedFolders.map((f) => f.full_path),
                            folderHashes: importedFolders.map((f) => f.hash),
                        }).catch((err) => {
                            console.error("Failed to delete folders:", err);
                        });
                        return;
                    }

                    setOpen(true);
                }}
                loading={isPending}
                color="secondary"
                startIcon={<Trash2Icon size={theme.iconSize.md} />}
                variant="outlined"
            >
                Delete All Imported Folders
            </Button>

            <Dialog
                open={open}
                onClose={() => setOpen(false)}
                title="Delete all imported folders? "
                title_icon={<Trash2Icon size={theme.iconSize.lg} />}
                color="secondary"
            >
                <DialogContent>
                    <Typography variant="body2" color="text.secondary">
                        Are you sure you want to delete all imported folders? This will
                        delete the following folders:
                    </Typography>
                    <Box
                        sx={{
                            overflowY: "auto",
                            marginTop: 2,
                            marginBottom: 2,
                            display: "flex",
                            flexDirection: "column",
                            gap: 1,
                        }}
                    >
                        {importedFolders.map((f, i) => (
                            <Box
                                key={i}
                                sx={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    pl: 1,
                                }}
                            >
                                <Box
                                    sx={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 1,
                                    }}
                                >
                                    <FolderTypeIcon
                                        isAlbum={f.is_album}
                                        isOpen={false}
                                        size={theme.iconSize.md}
                                    />
                                    <Typography variant="body1" fontWeight={"bold"}>
                                        {f.full_path}
                                    </Typography>
                                </Box>
                                <FolderStatusChip folder={f} />
                            </Box>
                        ))}
                        {importedFolders.length === 0 && (
                            <Typography variant="body1">
                                No imported folders to delete!
                            </Typography>
                        )}
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                        This action cannot be undone! All files inside the folders will
                        be permanently deleted.
                    </Typography>
                    <Divider sx={{ marginY: 2 }} />
                    <Box
                        sx={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: 1,
                        }}
                    >
                        <Button
                            variant="outlined"
                            color="secondary"
                            onClick={() => setOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="contained"
                            color="secondary"
                            onClick={() => {
                                deleteFolders({
                                    folderPaths: importedFolders.map(
                                        (f) => f.full_path
                                    ),
                                    folderHashes: importedFolders.map((f) => f.hash),
                                }).catch((err) => {
                                    console.error("Failed to delete folders:", err);
                                });
                                setOpen(false);
                            }}
                            disabled={isPending || importedFolders.length === 0}
                        >
                            Delete
                        </Button>
                    </Box>
                </DialogContent>
            </Dialog>
        </>
    );
}
