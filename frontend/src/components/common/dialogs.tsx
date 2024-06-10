import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";

export default function ErrorDialog({
    open,
    onClose,
    error,
}: {
    open: boolean;
    onClose: () => void;
    error: Error;
}) {
    return (
        <>
            <Dialog
                open={open}
                onClose={onClose}
                aria-labelledby="error-dialog-title"
                aria-describedby="error-dialog-description"
            >
                <DialogTitle id="error-dialog-title">{error.name}</DialogTitle>
                <DialogContent>
                    <DialogContentText id="error-dialog-description">
                        {error.message}
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={onClose}>Noticed</Button>
                </DialogActions>
            </Dialog>
        </>
    );
}
