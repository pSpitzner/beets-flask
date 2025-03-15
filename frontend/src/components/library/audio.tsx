/** Simple audio playback component
 *
 * Uses wavesurfer.js to display a waveform and play audio.
 */

import { PauseIcon, PlayIcon, SkipBackIcon, SkipForwardIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Box, CircularProgress, IconButton, LinearProgress, useTheme } from "@mui/material";
import { useQuery } from "@tanstack/react-query";

import WaveSurfer from "wavesurfer.js";

export function AudioPlayerItem({
    itemId,
    height = 20,
    navigation,
}: {
    itemId: number;
    navigation?: {
        onPrev: () => void;
        onNext: () => void;
        nextDisabled: boolean;
        prevDisabled: boolean;
    };
    height?: number;
}) {
    const theme = useTheme();
    const [ready, setReady] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const wavesurferRef = useRef<WaveSurfer | null>(null);

    // Fetch audio data
    const { data, isPending, isLoading, refetch } = useQuery({
        enabled: false,
        queryKey: ["audio", "item", itemId],
        queryFn: async () => {
            const response = await fetch(`/library/item/${itemId}/audio`);
            return response.blob();
        },
    });

    useEffect(() => {
        if (data && containerRef.current) {
            const wavesurfer = WaveSurfer.create({
                container: containerRef.current,
                waveColor: theme.palette.primary.main,
                cursorColor: theme.palette.divider,
                height: height,
            });
            wavesurferRef.current = wavesurfer;
            wavesurfer.on("ready", () => {
                // Wait 2 seconds for the waveform to render
                setTimeout(() => {
                    setReady(true);
                }, 2000);
            });
            wavesurfer.on("play", () => {
                setIsPlaying(true);
            });
            wavesurfer.on("pause", () => {
                setIsPlaying(false);
            });
            wavesurfer.loadBlob(data).catch(console.error);
            return () => {
                setReady(false);
                setIsPlaying(false);
                wavesurfer.destroy();
                setReady(false);
            };
        }
    }, [data, height]);

    return (
        <Box
            sx={{
                width: "100%",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 1,
            }}
        >
            <Box
                sx={{
                    display: "flex",
                    alignItems: "center",
                    width: "100%",
                    height: height + "px",
                    flexGrow: 1,
                }}
            >
                <div
                    ref={containerRef}
                    style={{ display: ready ? "block" : "none", width: "100%" }}
                />
                {!ready && (
                    <LinearProgress variant="determinate" sx={{ width: "100%" }} value={0} />
                )}
            </Box>
            <Box sx={{ display: "flex", gap: 2 }}>
                <IconButton
                    onClick={navigation?.onPrev}
                    disabled={navigation?.prevDisabled ?? true}
                >
                    <SkipBackIcon size={20} />
                </IconButton>
                <IconButton
                    onClick={async () => {
                        // Refetch audio data
                        if (!data) {
                            await refetch();
                            await new Promise((resolve) => setTimeout(resolve, 1000));
                        }

                        // Play audio
                        if (wavesurferRef.current) {
                            await wavesurferRef.current.playPause();
                        }
                    }}
                    sx={{ p: 0.5 }}
                >
                    {isLoading || (!ready && isPlaying) ? (
                        <CircularProgress size={20} />
                    ) : (
                        <PlayPauseIcon isPlaying={isPlaying} />
                    )}
                </IconButton>
                <IconButton
                    onClick={navigation?.onNext}
                    disabled={navigation?.nextDisabled ?? true}
                >
                    <SkipForwardIcon size={20} />
                </IconButton>
            </Box>
        </Box>
    );
}

function PlayPauseIcon({ isPlaying }: { isPlaying: boolean }) {
    return isPlaying ? <PauseIcon size={20} /> : <PlayIcon size={20} />;
}
