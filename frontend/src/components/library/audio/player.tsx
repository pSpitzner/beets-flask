import {
    ChevronDownIcon,
    ClockIcon,
    PauseIcon,
    PlayIcon,
    SkipBackIcon,
    SkipForwardIcon,
    SquareIcon,
    Volume1Icon,
    Volume2Icon,
    VolumeIcon,
    VolumeOffIcon,
    XIcon,
} from "lucide-react";
import { useState } from "react";
import { createPortal } from "react-dom";
import {
    Box,
    BoxProps,
    IconButton,
    Paper,
    Slide,
    Slider,
    Typography,
    TypographyProps,
    useMediaQuery,
    useTheme,
} from "@mui/material";

import { trackLengthRep } from "@/components/common/units/time";

import { useAudioContext } from "./context";
import { ProgressBar, Waveform } from "./waveform";

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
                justifyContent: "flex-start",
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
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 1,
                        width: "100%",
                        minWidth: 0, // prevent overflow
                        overflow: "hidden",
                        ">*": {
                            alignItems: "flex-end",
                        },
                    }}
                >
                    <Box
                        sx={{
                            display: "flex",
                            gap: 0.5,
                            justifyContent: "center",
                            color: "text.secondary",
                            justifySelf: "flex-start",
                            flexWrap: "nowrap",
                            width: "min-content",
                        }}
                    >
                        <ClockIcon size={theme.iconSize.sm} />
                        <CurrentDuration variant="body2" lineHeight={1} noWrap />
                    </Box>

                    <Box
                        gap={1}
                        sx={{
                            display: "flex",
                            textOverflow: "ellipsis",
                            overflow: "hidden",
                        }}
                    >
                        <CurrentTitle variant="body1" lineHeight={1} noWrap />
                        <CurrentArtist
                            variant="body2"
                            color="text.secondary"
                            lineHeight={1}
                            noWrap
                        />
                    </Box>

                    <Box
                        sx={{
                            display: "flex",
                            gap: 0.5,
                            justifyContent: "center",
                            color: "text.secondary",
                            gridColumn: "1",
                            gridRow: "1",
                            justifySelf: "flex-end",
                            flexWrap: "nowrap",
                        }}
                    >
                        <Typography variant="body2" lineHeight={1} noWrap>
                            Track 1 of 10
                        </Typography>
                    </Box>
                </Box>

                {/* Progress bar*/}
                <Box
                    sx={{
                        gridColumn: "1 / 2",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        marginBlock: 1,
                        height: "48px", // size of large iconbutton
                    }}
                >
                    <Waveform />
                </Box>

                {/* actions*/}
                <Box
                    sx={{
                        gridColumn: "2 / 3",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 1,
                        paddingLeft: 1,
                    }}
                >
                    <VolumeControls />
                    <PrevNextButtons />
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
    const theme = useTheme();
    const [fullscreen, setFullScreen] = useState(false);

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
                <Box
                    sx={{
                        display: "flex",
                        flexDirection: "column",
                        overflow: "hidden",
                        flex: 1,
                    }}
                >
                    <CurrentTitle variant="body1" noWrap />
                    <CurrentArtist variant="caption" color="text.secondary" noWrap />
                </Box>

                {/* Progress bar*/}
                <ProgressBar
                    sx={{
                        position: "absolute",
                        bottom: 0,
                        left: theme.spacing(1),
                        height: "3px",
                    }}
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
    const { playing, togglePlaying, canPlay } = useAudioContext();

    return (
        <IconButton
            onClick={(e) => {
                e.stopPropagation();
                togglePlaying();
            }}
            sx={{
                backgroundColor: "primary.muted",
            }}
            size="medium"
            loading={!canPlay}
        >
            {playing ? (
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

import Popper from "@mui/material/Popper";

import { useDebounce } from "@/components/common/hooks/useDebounce";

/** Volume controls
 */
function VolumeControls(props: BoxProps) {
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const theme = useTheme();
    const {
        audioRef: currentAudio,
        volume,
        setVolume,
        toggleMuted,
    } = useAudioContext();
    const open = useDebounce(Boolean(anchorEl), 250);

    // Ios devices cant control volume, thanks apple...
    const isIos = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    const isMobile = useMediaQuery(theme.breakpoints.down("tablet"));

    return (
        <Box {...props}>
            <Popper
                open={open}
                anchorEl={anchorEl}
                placement={"top"}
                modifiers={[
                    {
                        name: "offset",
                        options: {
                            offset: [0, theme.spacing(0.5).slice(0, -2)],
                        },
                    },
                ]}
            >
                <Paper sx={{ height: 100, paddingInline: 0.5, paddingBlock: 2 }}>
                    <Slider
                        orientation="vertical"
                        value={volume * 100}
                        onChange={(e, newValue) => {
                            setVolume(newValue / 100);
                        }}
                        min={0}
                        max={100}
                        size="small"
                        valueLabelDisplay="auto"
                        valueLabelFormat={(value) => `${Math.round(value)}%`}
                        sx={{
                            ".MuiSlider-valueLabel": {
                                backgroundColor: "background.paper",
                                color: "text.primary",
                            },
                        }}
                    />
                </Paper>
            </Popper>

            <IconButton
                onDoubleClick={() => {
                    toggleMuted();
                }}
                onContextMenu={(e) => {
                    e.preventDefault();
                    toggleMuted();
                }}
                onClick={(e) => {
                    if (isIos || isMobile) {
                        e.stopPropagation();
                        toggleMuted();
                        return;
                    }
                    // on desktop show the volume slider
                    setAnchorEl((prev) => (prev ? null : e.currentTarget));
                }}
                disabled={!currentAudio}
            >
                {/* Icon depends on current volume */}
                {between(volume, 2 / 3, 1) && <Volume2Icon size={theme.iconSize.md} />}
                {between(volume, 1 / 3, 2 / 3) && (
                    <Volume1Icon size={theme.iconSize.md} />
                )}
                {between(volume, 0, 1 / 3) && <VolumeIcon size={theme.iconSize.md} />}
                {volume === 0 && <VolumeOffIcon size={theme.iconSize.md} />}
            </IconButton>
        </Box>
    );
}

function Cover(props: Omit<CoverArtProps, "type">) {
    const { currentItem } = useAudioContext();
    return <CoverArt type="item" beetsId={currentItem?.id} {...props} />;
}

function CurrentArtist(props: TypographyProps) {
    const { currentItem } = useAudioContext();
    return <Typography {...props}>{currentItem?.artist || "Unknown"}</Typography>;
}

function CurrentTitle(props: TypographyProps) {
    const { currentItem } = useAudioContext();
    return <Typography {...props}>{currentItem?.name || "Unknown"}</Typography>;
}

function CurrentDuration(props: TypographyProps) {
    const { currentItem, currentTime } = useAudioContext();
    return (
        <Typography {...props}>
            {trackLengthRep(currentTime, false)} /{" "}
            {trackLengthRep(currentItem?.length || 0, false)}
        </Typography>
    );
}

function between(x: number, min: number, max: number) {
    return x > min && x <= max;
}
