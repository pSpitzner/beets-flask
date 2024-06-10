import { Outlet, createFileRoute, useNavigate } from "@tanstack/react-router";

import Dialog from "@mui/material/Dialog";
import { forwardRef, useState } from "react";
import { TransitionProps } from "@mui/material/transitions";
import Slide from "@mui/material/Slide";
import { Button, DialogActions, DialogContent } from "@mui/material";

export const Route = createFileRoute("/_frontpage/_modal")({
    component: DialogWrapper,
});

const Transition = forwardRef(function Transition(
    props: TransitionProps & {
        children: React.ReactElement<any, any>;
    },
    ref: React.Ref<unknown>
) {
    return <Slide direction="left" ref={ref} {...props} />;
});

function DialogWrapper() {
    const [open, setOpen] = useState(true);
    const navigate = useNavigate();

    const handleClose = () => {
        setOpen(false);
    };

    return (
        <Dialog
            open={open}
            onClose={handleClose}
            onTransitionExited={() => {
                if (!open) {
                    navigate({ to: ".." });
                }
            }}
            TransitionComponent={Transition}
        >
            <DialogContent>
                <Outlet />
            </DialogContent>
            <DialogActions>
                <Button onClick={handleClose}>Close</Button>
            </DialogActions>
        </Dialog>
    );
}
