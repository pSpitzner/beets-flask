import { XIcon } from 'lucide-react';
import {
    Divider,
    IconButton,
    IconButtonOwnProps,
    styled,
    Typography,
    Zoom,
} from '@mui/material';
import MuiDialog, { DialogProps } from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';

/** Styled dialog that auto expands
 * to full screen on mobile devices.
 *
 * Has a small zoom transition animation.
 */
export function Dialog({
    title,
    title_icon,
    children,
    color = 'primary',
    ...props
}: DialogProps & {
    onClose: (
        event: object,
        reason: 'backdropClick' | 'escapeKeyDown' | 'xIconClick'
    ) => void;
    title: React.ReactNode;
    title_icon?: React.ReactNode;
    color?: IconButtonOwnProps['color'];
}) {
    return (
        <MuiDialog
            sx={(theme) => ({
                padding: 0,
                margin: 0,
                '.MuiDialog-paper': {
                    // Auto expand to full screen on mobile devices
                    minWidth: theme.breakpoints.values.tablet + 'px',
                    maxWidth: theme.breakpoints.values.laptop + 'px',
                    [theme.breakpoints.down('tablet')]: {
                        width: '100%',
                        height: '100%',
                        maxHeight: '100%',
                        maxWidth: '100%',
                        minWidth: '100%',
                        margin: 0,
                        borderRadius: 0,
                    },
                },
                '.MuiDialogTitle-root': {
                    paddingInline: theme.spacing(2),
                    paddingBlock: theme.spacing(1),
                },
            })}
            slots={{
                transition: Zoom,
                backdrop: Backdrop,
            }}
            {...props}
        >
            <DialogTitle
                sx={{
                    display: 'flex',
                    width: '100%',
                    gap: 1,
                    alignItems: 'center',
                    justifyContent: 'space-between',
                }}
            >
                <Typography
                    variant="h5"
                    component="div"
                    fontWeight="bold"
                    sx={{
                        display: 'flex',
                        paddingBlock: 0.75,
                        gap: 1,
                        alignItems: 'center',
                    }}
                >
                    {title_icon}
                    {title}
                </Typography>
                <IconButton
                    onClick={() => props.onClose({}, 'xIconClick')}
                    sx={{
                        margin: 0,
                        padding: 0.5,
                    }}
                    aria-label="close"
                    size="small"
                    color={color}
                >
                    <XIcon />
                </IconButton>
            </DialogTitle>
            <Divider variant="middle" />
            {children}
        </MuiDialog>
    );
}

import MuiBackdrop from '@mui/material/Backdrop';

const Backdrop = styled(MuiBackdrop)(() => ({
    position: 'fixed',
    inset: 0,
    backgroundColor: '#00000033',
    backdropFilter: 'blur(5px)',
    zIndex: -1,
    WebkitTapHighlightColor: 'transparent',
}));
