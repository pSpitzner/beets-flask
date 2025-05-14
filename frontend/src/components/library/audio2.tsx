import { ChevronDownIcon, PlayIcon, SquareIcon } from "lucide-react";
import { useState } from "react";
import { createPortal } from "react-dom";
import { Box, BoxProps, IconButton, Slide, Typography, useTheme } from "@mui/material";

/** The typical audio player
 *
 * is mounted to the bottom of the screen
 * and expands to the fullscreen
 * on small devices.
 */
export function MobilePlayer() {
    const [fullscreen, setFullScreen] = useState(false);
    const theme = useTheme();

    return (
        <>
            <Box
                sx={(theme) => ({
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",

                    overflow: "hidden",
                    height: 60,
                    padding: 1,
                    borderRadius: 2,
                    gap: 1,
                    m: 1,
                    position: "relative",

                    backgroundColor: "background.paper",
                })}
                onClick={() => {
                    setFullScreen((prev) => !prev);
                }}
            >
                {/* Cover art*/}
                <Box
                    component="img"
                    src="/assets/cover.jpg"
                    alt="Cover"
                    sx={{
                        borderRadius: 1,
                        border: "1px solid blue",
                        aspectRatio: "1 / 1",
                        height: "100%",
                    }}
                />

                {/* Track info*/}
                <Box sx={{ display: "flex", flexDirection: "column" }}>
                    <Typography variant="body1">Title</Typography>
                    <Typography
                        variant="caption"
                        sx={{
                            color: "text.secondary",
                        }}
                    >
                        Artist
                    </Typography>
                </Box>

                {/* Progress bar*/}
                <Box
                    sx={(theme) => ({
                        position: "absolute",
                        bottom: 0,
                        left: theme.spacing(1),
                        width: `calc(100% - ${theme.spacing(2)})`,
                        height: 2,
                        backgroundColor: theme.palette.primary.muted,
                        ":after": {
                            content: '""',
                            position: "absolute",
                            left: 0,
                            top: 0,
                            width: "50%", // Adjust this to set the progress
                            height: "100%",
                            backgroundColor: theme.palette.primary.main,
                            transition: "transform 0.3s ease-in-out",
                        },
                        ":before": {
                            // glow
                            content: '""',
                            position: "absolute",
                            left: "-2px",
                            bottom: 0,
                            width: "calc(50% + 4px)", // Adjust this to set the progress
                            height: "4px",
                            backgroundColor: theme.palette.primary.main,
                            opacity: 0.6,
                            filter: "blur(5px)",
                            transition: "transform 0.3s ease-in-out",
                        },
                    })}
                />

                {/* actions*/}
                <Box sx={{ ml: "auto", display: "flex", gap: 1 }}>
                    <IconButton
                        onClick={(e) => {
                            e.stopPropagation();
                        }}
                    >
                        <SquareIcon size={22} fill="white" />
                    </IconButton>
                    <IconButton
                        onClick={(e) => {
                            e.stopPropagation();
                        }}
                    >
                        <PlayIcon size={theme.iconSize.xl} />
                    </IconButton>
                </Box>
            </Box>
            {/* Slide up to fullscreen player */}
            <Slide direction="up" in={fullscreen} mountOnEnter unmountOnExit>
                <FullScreenPlayer onClose={() => setFullScreen(false)} />
            </Slide>
        </>
    );
}

/** Layout for fullscreen audio player
 * This component is design to
 * be used by mobile devices
 * as the normal player is too small
 * otherwise.
 *
 * Heavily inspired by spotify :)
 */
export function FullScreenPlayer({
    onClose,
    ref,
}: {
    onClose: () => void;
    ref?: React.Ref<HTMLDivElement>;
}) {
    const theme = useTheme();

    return (
        <FullScreenOntop
            ref={ref}
            sx={{
                display: "flex",
                flexDirection: "column",
            }}
        >
            {/*Top bar*/}
            <Box sx={{ width: "100%", border: "1px solid blue" }}>
                <IconButton size="large" onClick={onClose}>
                    <ChevronDownIcon size={theme.iconSize.xl} />
                </IconButton>
                More actions here?
            </Box>
            {/*Art/current track*/}
            <Box
                sx={{
                    width: "100%",
                    border: "1px solid red",
                    flex: "1 1 auto",
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "flex-end",
                }}
            >
                Art
            </Box>
            {/*Player controls*/}
            <Box sx={{ width: "100%", border: "1px solid green", minHeight: "15%" }}>
                Player with waveforms and controls
            </Box>
        </FullScreenOntop>
    );
}

/** Component that mounts to the top of the
 * dom tree and is shown ontop of everything else.
 */
export function FullScreenOntop({ sx, ...props }: BoxProps) {
    return createPortal(
        <Box
            sx={[
                {
                    zIndex: 999,
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: "100%",
                    bgcolor: "background.paper",
                },
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                ...(Array.isArray(sx) ? sx : [sx]),
            ]}
            {...props}
        />,
        document.body
    );
}
