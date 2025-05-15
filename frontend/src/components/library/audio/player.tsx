import {
    ChevronDownIcon,
    ClockIcon,
    PauseIcon,
    PlayIcon,
    SkipBackIcon,
    SkipForwardIcon,
    SquareIcon,
    XIcon,
} from "lucide-react";
import { useState } from "react";
import { createPortal } from "react-dom";
import {
    Box,
    BoxProps,
    IconButton,
    Slide,
    Typography,
    TypographyProps,
    useTheme,
} from "@mui/material";

import { useAudioContext } from "./context";

import CoverArt, { CoverArtProps } from "../coverArt";

/** Desktop audio player
 *
 * fixed to the bottom of the screen
 * shows all the controls
 * and the current waveform.
 */
export function DesktopPlayer() {
    const theme = useTheme();

    return (
        <Box
            sx={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: 100,
                padding: 1,
                borderRadius: 2,
                gap: 1,
                position: "relative",
                backgroundColor: "background.paper",
                borderBottomLeftRadius: 0,
                borderBottomRightRadius: 0,
            }}
        >
            {/* Cover art*/}
            <Cover
                sx={{
                    borderRadius: 1,
                    aspectRatio: "1 / 1",
                    height: "100%",
                    width: "unset",
                    m: 0,
                    flex: "0 0 auto", // prevent shrink
                }}
            />
            <Box
                sx={{
                    display: "grid",
                    gridTemplateColumns: "1fr auto",
                    gridTemplateRows: "auto 1fr",
                    flexDirection: "column",
                    width: "100%",
                    height: "100%",
                }}
            >
                {/* Track info*/}
                <Box
                    sx={{
                        gridColumn: "1 / 2",
                        // Stacked grid layout
                        // for alligning the elements
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 1,
                        gridTemplateColumns: "1fr",
                        gridTemplateRows: "1fr",
                        display: "grid",
                        width: "100%",
                    }}
                >
                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 0.5,
                            justifyContent: "center",
                            color: "text.secondary",
                            gridColumn: "1",
                            gridRow: "1",
                            justifySelf: "flex-start",
                        }}
                    >
                        <ClockIcon size={theme.iconSize.sm} />
                        <Typography variant="body2" lineHeight={1}>
                            00:00
                        </Typography>
                    </Box>

                    <Box
                        display="flex"
                        alignItems="flex-end"
                        gap={1}
                        sx={{
                            gridColumn: "1",
                            gridRow: "1",
                            justifySelf: "center",
                        }}
                    >
                        <CurrentTitle variant="body1" />
                        <CurrentArtist variant="body2" color="text.secondary" />
                    </Box>

                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 0.5,
                            justifyContent: "center",
                            color: "text.secondary",
                            gridColumn: "1",
                            gridRow: "1",
                            justifySelf: "flex-end",
                        }}
                    >
                        <Typography variant="body2" lineHeight={1}>
                            Track 1 of 10
                        </Typography>
                    </Box>
                </Box>

                {/* Progress bar*/}
                <Box
                    sx={{
                        border: "1px solid",
                        borderColor: "primary.muted",
                        height: "100%",
                        gridColumn: "1 / 2",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                >
                    Waveform
                </Box>

                {/* actions*/}
                <Box
                    sx={{
                        gridColumn: "2 / 3",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                >
                    <PrevNextButtons
                        sx={{
                            paddingInline: 0.5,
                        }}
                    />
                    <PlayPauseButton />
                </Box>

                <Box
                    sx={{
                        gridColumn: "2",
                        gridRow: "1",
                        display: "flex",
                        alignItems: "flex-start",
                        justifyContent: "flex-end",
                        marginTop: -0.5,
                        marginRight: -0.5,
                    }}
                >
                    <IconButton size="small">
                        <XIcon size={theme.iconSize.sm} />
                    </IconButton>
                </Box>
            </Box>
        </Box>
    );
}

/** Mobile audio player
 *
 * should be fixed to the bottom of the screen
 * and expands to the fullscreen
 * on click on non action areas.
 *
 * Fullscreen shows extra controls
 * and the current waveform.
 */
export function MobilePlayer() {
    const [fullscreen, setFullScreen] = useState(false);
    const theme = useTheme();

    return (
        <>
            <Box
                sx={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",

                    overflow: "hidden",
                    height: 60,
                    padding: 1,
                    borderRadius: 2,
                    gap: 1,
                    position: "relative",

                    backgroundColor: "background.paper",
                }}
                onClick={() => {
                    setFullScreen((prev) => !prev);
                }}
            >
                {/* Cover art*/}
                <Cover
                    sx={{
                        borderRadius: 1,
                        aspectRatio: "1 / 1",
                        height: "100%",
                        width: "auto",
                        m: 0,
                    }}
                />

                {/* Track info*/}
                <Box sx={{ display: "flex", flexDirection: "column" }}>
                    <CurrentTitle variant="body1" />
                    <CurrentArtist variant="caption" color="text.secondary" />
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
                    <PlayPauseButton />
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

/* ---------------------------------- utils --------------------------------- */

// Toggle play/pause
function PlayPauseButton() {
    const theme = useTheme();
    const { isPlaying, togglePlay } = useAudioContext();

    return (
        <IconButton
            onClick={(e) => {
                e.stopPropagation();
                togglePlay();
            }}
            sx={{
                backgroundColor: "primary.muted",
            }}
            size="large"
        >
            {isPlaying ? (
                <PauseIcon size={theme.iconSize.xl} />
            ) : (
                <PlayIcon size={theme.iconSize.xl} />
            )}
        </IconButton>
    );
}

function PrevNextButtons(props: BoxProps) {
    const theme = useTheme();
    const { hasNext, hasPrev, nextItem, prevItem } = useAudioContext();

    return (
        <Box {...props}>
            <IconButton
                disabled={!hasPrev}
                onClick={(e) => {
                    e.stopPropagation();
                    prevItem();
                }}
                sx={{
                    backgroundColor: "primary.muted",
                }}
            >
                <SkipBackIcon size={theme.iconSize.md} />
            </IconButton>
            <IconButton
                disabled={!hasNext}
                onClick={(e) => {
                    e.stopPropagation();
                    nextItem();
                }}
            >
                <SkipForwardIcon size={theme.iconSize.md} />
            </IconButton>
        </Box>
    );
}

function Cover(props: Omit<CoverArtProps, "type">) {
    const { currentItem } = useAudioContext();

    return <CoverArt type="item" id={currentItem?.id.toFixed()} {...props} />;
}

function CurrentArtist(props: TypographyProps) {
    const { currentItem } = useAudioContext();
    return <Typography {...props}>{currentItem?.artist || "Unknown"}</Typography>;
}

function CurrentTitle(props: TypographyProps) {
    const { currentItem } = useAudioContext();
    return <Typography {...props}>{currentItem?.name || "Unknown"}</Typography>;
}
