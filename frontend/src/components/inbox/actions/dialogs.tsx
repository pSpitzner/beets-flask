import { Trash2Icon } from 'lucide-react';
import {
    Box,
    Button,
    DialogContent,
    Divider,
    Typography,
    useTheme,
} from '@mui/material';

import { Action, ActionButtonConfig } from '@/api/config';
import { FolderStatusChip } from '@/components/common/chips';
import { Dialog } from '@/components/common/dialogs';
import { FolderTypeIcon } from '@/components/common/icons';

import { useActionMutation } from './mutations';

import { useInboxCardContext } from '../cards/inboxCard';

export function ActionDialog({
    action,
    open,
    setOpen,
}: {
    action: ActionButtonConfig['actions'][0];
    open: boolean;
    setOpen: (open: boolean) => void;
}) {
    const name = action.name;
    switch (name) {
        case 'delete_imported_folders':
            return (
                <DeleteImportedFoldersDialog
                    action={action}
                    open={open}
                    setOpen={setOpen}
                />
            );
        default:
            return null;
    }
}

const DeleteImportedFoldersDialog = ({
    action,
    open,
    setOpen,
}: {
    action: Action;
    open: boolean;
    setOpen: (open: boolean) => void;
}) => {
    const theme = useTheme();
    const { importedFolders } = useInboxCardContext();
    const { mutateAsync: deleteFolders, isPending } = useActionMutation(action);

    return (
        <Dialog
            open={open}
            onClose={() => setOpen(false)}
            title="Delete all imported folders? "
            title_icon={<Trash2Icon size={theme.iconSize.lg} />}
            color="secondary"
        >
            <DialogContent>
                <Typography variant="body2" color="text.secondary">
                    Are you sure you want to delete all imported folders? This
                    will delete the following folders:
                </Typography>
                <Box
                    sx={{
                        overflowY: 'auto',
                        marginTop: 2,
                        marginBottom: 2,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 1,
                    }}
                >
                    {importedFolders.map((f, i) => (
                        <Box
                            key={i}
                            sx={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                pl: 1,
                                gap: 1,
                            }}
                        >
                            <Box
                                sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 1,
                                }}
                            >
                                <FolderTypeIcon
                                    isAlbum={f.is_album}
                                    isArchive={f.type === 'archive'}
                                    isOpen={false}
                                    size={theme.iconSize.md}
                                />
                                <Typography variant="body1" fontWeight={'bold'}>
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
                    This action cannot be undone! All files inside the folders
                    will be permanently deleted.
                </Typography>
                <Divider sx={{ marginY: 2 }} />
                <Box
                    sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
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
                            deleteFolders().catch((err) => {
                                console.error('Failed to delete folders:', err);
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
    );
};
