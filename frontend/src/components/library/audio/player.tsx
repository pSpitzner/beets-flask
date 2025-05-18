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
import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
    Box,
    BoxProps,
    Button,
    ButtonProps,
    Divider,
    IconButton,
    Paper,
    Slide,
    Slider,
    Typography,
    TypographyProps,
    useMediaQuery,
    useTheme,
} from "@mui/material";
import Popper from "@mui/material/Popper";
import { useQuery } from "@tanstack/react-query";

import { numArtQueryOptions } from "@/api/library";
import { useDebounce } from "@/components/common/hooks/useDebounce";
import { trackLengthRep } from "@/components/common/units/time";

import { useAudioContext } from "./context";
import { ProgressBar, Waveform } from "./waveform";

import CoverArt, { CoverArtProps } from "../coverArt";

export function Player() {
    const { items } = useAudioContext();
    const isMobile = useMediaQuery((theme) => theme.breakpoints.down("tablet"));

    const nItems = useMemo(() => items.length, [items]);

    if (nItems === 0) {
        return null;
    }

    if (isMobile) {
        return <MobilePlayer />;
    }
    return <DesktopPlayer />;
}

/** Desktop audio player
 *
 * fixed to the bottom of the screen
 * shows all the controls
 * and the current waveform.
 */
function DesktopPlayer() {
    const theme = useTheme();
    const { clearItems } = useAudioContext();

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
                        <TrackNum variant="body2" lineHeight={1} noWrap />
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
                    <Waveform height={48} />
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
                    <IconButton
                        size="small"
                        onClick={(e) => {
                            e.stopPropagation();
                            clearItems();
                        }}
                    >
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
function MobilePlayer() {
    const theme = useTheme();
    const [fullscreen, setFullScreen] = useState(false);
    const { clearItems } = useAudioContext();

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
                            clearItems();
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
function FullScreenPlayer({
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
            <Box sx={{ width: "100%" }}>
                <IconButton size="large" onClick={onClose}>
                    <ChevronDownIcon size={theme.iconSize.xl} />
                </IconButton>
            </Box>
            <Divider />
            {/*Art/current track*/}
            <Box
                sx={{
                    width: "100%",
                    flex: "1 1 auto",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    alignItems: "flex-end",
                    padding: 2,
                    borderRadius: 2,
                    gap: 2,
                }}
            >
                <MultiCover
                    sx={{
                        maxWidth: "100%",
                        height: "auto",
                        width: "100%",
                        objectFit: "contain",
                    }}
                    size="large"
                />

                <Box
                    sx={{
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "center",
                        alignItems: "center",
                        width: "100%",
                    }}
                >
                    <CurrentTitle variant="h2" fontWeight="bold" />
                    <CurrentArtist variant="body1" color="text.secondary" />
                </Box>
            </Box>
            {/*Player controls*/}
            <Divider />

            <Box
                sx={{
                    width: "100%",
                    minHeight: "20%",
                    padding: 2,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    alignItems: "center",
                    gap: 2,
                }}
            >
                <Box
                    sx={{
                        padding: 2,
                        width: "100%",
                    }}
                >
                    <Waveform height={80} />
                </Box>
                <Box
                    sx={{
                        display: "grid",
                        gridTemplateColumns: "1fr",
                        gridTemplateRows: "1fr",
                        alignItems: "center",
                        justifyContent: "center",
                        width: "100%",
                    }}
                >
                    <Box
                        sx={{
                            display: "flex",
                            justifyContent: "center",
                            alignItems: "center",
                            width: "100%",
                            gap: 3,
                            gridColumn: "1",
                            gridRow: "1",
                        }}
                    >
                        <PrevButton />
                        <PlayPauseButton size="large" />
                        <NextButton />
                    </Box>
                    <VolumeControls
                        sx={{
                            ml: "auto",
                            gridColumn: "1",
                            gridRow: "1",
                        }}
                    />
                </Box>
            </Box>
        </FullScreenOntop>
    );
}

/** Component that mounts to the top of the
 * dom tree and is shown ontop of everything else.
 */
function FullScreenOntop({ sx, ...props }: BoxProps) {
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
function PlayPauseButton(props: ButtonProps) {
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
            {...props}
        >
            {playing ? (
                <PauseIcon size={theme.iconSize.xl} />
            ) : (
                <PlayIcon size={theme.iconSize.xl} />
            )}
        </IconButton>
    );
}

function PrevButton(props: ButtonProps) {
    const theme = useTheme();
    const { hasPrev, prevItem } = useAudioContext();

    return (
        <IconButton
            disabled={!hasPrev}
            onClick={(e) => {
                e.stopPropagation();
                prevItem();
            }}
            {...props}
        >
            <SkipBackIcon size={theme.iconSize.md} />
        </IconButton>
    );
}

function NextButton(props: ButtonProps) {
    const theme = useTheme();
    const { hasNext, nextItem } = useAudioContext();

    return (
        <IconButton
            disabled={!hasNext}
            onClick={(e) => {
                e.stopPropagation();
                nextItem();
            }}
            {...props}
        >
            <SkipForwardIcon size={theme.iconSize.md} />
        </IconButton>
    );
}

function PrevNextButtons(props: BoxProps) {
    return (
        <Box {...props}>
            <PrevButton />
            <NextButton />
        </Box>
    );
}

/** Volume controls
 */
function VolumeControls(props: BoxProps) {
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const theme = useTheme();
    const { currentAudio, volume, setVolume, toggleMuted } = useAudioContext();
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

function MultiCover({ size, ...props }: { size: "medium" | "large" } & BoxProps) {
    const { currentItem } = useAudioContext();
    const [currentIdx, setCurrentIdx] = useState(0);

    const { data: numArtworks } = useQuery(numArtQueryOptions(currentItem?.id));

    return (
        <Box position="relative" {...props}>
            {numArtworks && numArtworks.count > 1 && (
                <Button
                    variant="text"
                    sx={{
                        position: "absolute",
                        top: 0,
                        right: 0,
                        m: 0,
                        p: 1,
                        minWidth: 0,
                    }}
                    onClick={() => {
                        setCurrentIdx((prev) => (prev + 1) % numArtworks.count);
                    }}
                >
                    {
                        //Dot for each artwork
                        Array.from({ length: numArtworks.count }).map((_, idx) => (
                            <Box
                                key={idx}
                                sx={{
                                    width: 8,
                                    height: 8,
                                    borderRadius: "50%",
                                    backgroundColor:
                                        currentIdx === idx
                                            ? "primary.main"
                                            : "text.secondary",
                                    marginLeft: 0.5,
                                }}
                            />
                        ))
                    }
                </Button>
            )}
            <CoverArt
                type="item"
                beetsId={currentItem?.id}
                size={size}
                index={currentIdx}
                sx={{
                    maxWidth: "100%",
                    maxHeight: "100%",
                    height: "auto",
                    width: "100%",
                    objectFit: "contain",
                }}
            />
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

function TrackNum(props: TypographyProps) {
    const { currentItem, items } = useAudioContext();

    const currentIdx = items.findIndex((item) => item.id === currentItem?.id);

    if (!currentItem || currentIdx === -1) {
        return <Box></Box>;
    }

    return (
        <Typography {...props}>
            Track {currentIdx + 1} of {items.length}
        </Typography>
    );
}

function between(x: number, min: number, max: number) {
    return x > min && x <= max;
}
