import { useEffect, useRef } from "react";
import { Box, BoxProps, useTheme } from "@mui/material";
import { useQuery } from "@tanstack/react-query";

import { waveformQueryOptions } from "@/api/library";

import { useAudioContext } from "./context";

import WaveSurfer from "wavesurfer.js";
import RegionsPlugin, { Region } from "wavesurfer.js/dist/plugins/regions.esm.js";

const colorBuffering = "#00000050";

/** Shows waveform for an audio item
 *
 * - uses preloaded waveforms
 * - allows drag seeking
 * - shows buffering region
 */
export function Waveform({ height }: { height?: number }) {
    const theme = useTheme();
    const containerRef = useRef<HTMLDivElement>(null);
    const wavesurferRef = useRef<WaveSurfer | null>(null);
    const loadingRegion = useRef<Region | null>(null);
    const { currentAudio, currentItem, buffered, currentTime } = useAudioContext();

    // Load precomputed waveform
    const { data: peaks, isPending } = useQuery(waveformQueryOptions(currentItem?.id));

    // Initialize wavesurfer we use one global instance
    useEffect(() => {
        if (!containerRef.current || !peaks) return;
        const regions = RegionsPlugin.create();
        const wavesurfer = WaveSurfer.create({
            container: containerRef.current,
            waveColor: theme.palette.primary.muted,
            progressColor: theme.palette.primary.main,
            cursorColor: theme.palette.primary.main,
            cursorWidth: 2,
            height: height,
            duration: currentItem?.length,
            peaks: peaks ? [peaks] : undefined,
            dragToSeek: true,
            plugins: [regions],
            backend: "MediaElement",
        });
        wavesurferRef.current = wavesurfer;
        loadingRegion.current = regions.addRegion({
            start: 0,
            end: currentItem?.length,
            color: colorBuffering,
            drag: false,
            resize: false,
        });

        return () => {
            wavesurfer.destroy();
            wavesurferRef.current = null;
            loadingRegion.current = null;
        };
    }, [currentItem, peaks, currentAudio, theme, height]);

    const dragging = useRef(false);

    // Register events for the wavesurfer instance
    useEffect(() => {
        if (!wavesurferRef.current || !currentAudio) return;
        const wavesurfer = wavesurferRef.current;

        const onClick = (percentage: number) => {
            const time = wavesurfer.getDuration() * percentage;
            currentAudio.currentTime = time;
        };
        const onDragStart = (percentage: number) => {
            dragging.current = true;
            const time = wavesurfer.getDuration() * percentage;
            wavesurfer.setTime(time);
        };
        const onDragEnd = (percentage: number) => {
            const time = wavesurfer.getDuration() * percentage;
            currentAudio.currentTime = time;
            dragging.current = false;
        };

        wavesurfer.on("ready", () => {
            wavesurfer.setTime(currentAudio.currentTime);
        });
        wavesurfer.on("click", onClick);
        wavesurfer.on("dragstart", onDragStart);
        wavesurfer.on("dragend", onDragEnd);

        return () => {
            wavesurfer.un("click", onClick);
            wavesurfer.un("dragstart", onDragStart);
            wavesurfer.un("dragend", onDragEnd);
        };
    }, [currentAudio]);

    // Update current time of audio
    useEffect(() => {
        if (!wavesurferRef.current || !currentAudio || dragging.current) return;
        const wavesurfer = wavesurferRef.current;
        wavesurfer.setTime(currentTime);
    }, [currentAudio, currentTime]);

    // Audio buffering region
    useEffect(() => {
        if (!loadingRegion.current || !wavesurferRef.current) return;
        const dur = currentItem?.length || wavesurferRef.current.getDuration();
        const loaded =
            buffered && buffered.length > 0 ? buffered.end(buffered.length - 1) : 0;
        const complete = loaded >= dur;
        if (complete) {
            loadingRegion.current.setOptions({
                start: dur,
                end: dur,
                color: "transparent",
                drag: false,
                resize: false,
            });
        } else {
            loadingRegion.current.setOptions({
                start: loaded,
                end: dur,
                color: colorBuffering,
                drag: false,
                resize: false,
            });
        }
    }, [buffered, currentItem?.length]);

    if (isPending || !peaks) {
        return (
            <Box
                sx={{
                    width: "100%",
                    height: height ? `${height}px` : "100%",
                    display: "flex",
                    alignItems: "center",
                }}
            >
                <ProgressBar sx={{ width: "100%", height: "5px" }} />
            </Box>
        );
    }

    return (
        <Box
            ref={containerRef}
            sx={{
                width: "100%",
                height: height ? `${height}px` : "100%",

                // styling the loading region
                "*::part(region)": {
                    transition: "left 0.35s linear",
                },
            }}
        />
    );
}

/** Shows progress bar for audio item
 *
 * - shows progress of current audio item
 * - shows buffering region
 * - does not allow drag seeking (todo)
 *
 */
export function ProgressBar({ sx, ...props }: BoxProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const { currentTime, currentItem, buffered } = useAudioContext();

    // Audio buffering
    useEffect(() => {
        if (!containerRef.current) return;
        const duration = currentItem?.length || 1;
        const loaded =
            buffered && buffered.length > 0 ? buffered.end(buffered.length - 1) : 0;
        const bufferedWidth = (1 - loaded / duration) * 100;
        containerRef.current.style.setProperty("--buffered-width", `${bufferedWidth}%`);
    }, [buffered, currentItem?.length]);

    // Audio progress
    useEffect(() => {
        if (!containerRef.current) return;
        const progressWidth = (currentTime / (currentItem?.length || 1)) * 100;
        containerRef.current.style.setProperty("--progress-width", `${progressWidth}%`);
    }, [currentTime, currentItem?.length]);

    // TODO: support drag seeking for progress bar
    return (
        <Box
            ref={containerRef}
            sx={[
                (theme) => ({
                    width: `calc(100% - ${theme.spacing(2)})`,
                    backgroundColor: theme.palette.primary.muted,
                    borderRadius: "4px",
                    ":after": {
                        content: '""',
                        position: "absolute",
                        left: 0,
                        top: 0,
                        width: "var(--progress-width)",
                        height: "100%",
                        backgroundColor: theme.palette.primary.main,
                        transition: "transform 0.1s linear",
                        borderTopLeftRadius: "4px",
                        borderBottomLeftRadius: "4px",
                    },
                    ":before": {
                        // glow
                        content: '""',
                        position: "absolute",
                        left: "-2px",
                        bottom: 0,
                        width: "calc(var(--progress-width) + 4px)", // Adjust this to set the progress
                        height: "4px",
                        backgroundColor: theme.palette.primary.main,
                        opacity: 0.6,
                        filter: "blur(5px)",
                        transition: "width 0.1s linear",
                    },
                    position: "relative",
                }),
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                ...(Array.isArray(sx) ? sx : [sx]),
            ]}
            {...props}
        >
            <Box
                sx={{
                    width: "var(--buffered-width, 100%)",
                    height: "100%",
                    position: "absolute",
                    right: 0,
                    transition: "width 0.3s linear",
                    backgroundColor: colorBuffering,
                }}
            />
        </Box>
    );
}
