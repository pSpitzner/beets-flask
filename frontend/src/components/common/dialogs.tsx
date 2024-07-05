import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";

export function ErrorDialog({
    open,
    onClose,
    error,
}: {
    open: boolean;
    onClose: () => void;
    error?: Error | null;
}) {

    if (!error) {
        return
    }

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


export function ConfirmDialog({
    open,
    onConfirm,
    onCancel,
    title,
    children
}: {
    open: boolean,
    onConfirm: () => void,
    onCancel: () => void,
    title: string,
    children?: React.ReactNode
}) {
    return (
        <>
            <Dialog
                open={open}
                onClose={onCancel}
            >
                <DialogTitle>{title}</DialogTitle>
                <DialogContent>
                    <DialogContentText id="error-dialog-description">
                        {children}
                    </DialogContentText>
                </DialogContent>
                <DialogActions >
                    <Button onClick={onCancel} sx={{
                        marginRight: "auto"
                    }}>No</Button>
                    <Button onClick={onConfirm} className="ml-auto">Yes</Button>
                </DialogActions>
            </Dialog>
        </>
    )
}