import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { useQuery } from "@tanstack/react-query";

import {
    artUrl,
    itemAudioDataQueryOptions,
    prefetchItemAudioData,
    prefetchWaveform,
} from "@/api/library";
import { useLocalStorage } from "@/components/common/hooks/useLocalStorage";
import { useMediaSession } from "@/components/common/hooks/useMediaSession";
import { useNavigableList } from "@/components/common/hooks/useNavigableList";
import { ItemResponse } from "@/pythonTypes";

interface AudioContextI {
    // Play state
    canPlay: boolean;
    playing: boolean;
    setPlaying: (playing: boolean) => void;
    togglePlaying: () => void;
    currentTime: number;

    // Queue
    currentItem: ItemResponse | null;
    items: ItemResponse[];
    nItems: number;
    hasNext: boolean;
    hasPrev: boolean;
    nextItem: () => ItemResponse | null;
    prevItem: () => ItemResponse | null;
    clearItems: () => void;
    addToQueue: (
        item: ItemResponse,
        setAsCurrent?: boolean,
        autoplay?: boolean
    ) => void;

    // Audio data + waveforms
    currentAudio: HTMLAudioElement | null;
    buffered: TimeRanges | null;

    // Volume
    volume: number;
    setVolume: (value: number) => void;
    toggleMuted: () => void;

    // Visuals
    showGlobalPlayer: boolean;
}

const AudioContext = createContext<AudioContextI | null>(null);

export const useAudioContext = () => {
    const context = useContext(AudioContext);
    if (!context) {
        throw new Error("useAudioContext must be used within an AudioProvider");
    }
    return context;
};

export function AudioContextProvider({ children }: { children: React.ReactNode }) {
    const [autoplay, setAutoplay] = useState(false);

    const {
        items,
        navigate,
        currentItem,
        hasNext,
        hasPrev,
        clear: clearItems,
        add,
    } = useNavigableList<ItemResponse>([]);

    const {
        currentAudio,
        buffered,
        currentTime,
        playing,
        setPlaying,
        setVolume,
        toggleMuted,
        volume,
        canPlay,
    } = useAudioData(currentItem);

    function addToQueue(item: ItemResponse, setAsCurrent = false, autoplay = false) {
        // Prefetch the audio data for the item
        // FIXME: this can be quite some data if there are many items
        // maybe a smarter way to do this?
        if (currentItem) {
            console.log("Prefetching audio for item", item.id);
            prefetchItemAudioData(item.id).catch(console.error);
            prefetchWaveform(item.id).catch(console.error);
        }
        add(item, setAsCurrent);
        if (autoplay) setAutoplay(true);
    }

    useEffect(() => {
        if (currentAudio && autoplay) {
            // Prefetch the audio data for the item
            setAutoplay(false);
            setPlaying(true);
        }
    }, [currentAudio, autoplay, setPlaying]);

    const nextItem = () => {
        if (currentAudio) {
            currentAudio.currentTime = 0;
        }
        return navigate(1);
    };
    const prevItem = () => {
        if (currentAudio) {
            currentAudio.currentTime = 0;
        }
        return navigate(-1);
    };

    const nItems = useMemo(() => items.length, [items]);

    return (
        <AudioContext.Provider
            value={{
                // playback related
                canPlay,
                playing,
                setPlaying,
                togglePlaying: () => {
                    if (!currentAudio) return;
                    if (currentAudio.paused) {
                        setPlaying(true);
                    } else {
                        setPlaying(false);
                    }
                },
                currentTime,
                // queue related
                items,
                nItems,
                currentItem,
                hasNext,
                hasPrev,
                nextItem: nextItem,
                prevItem: prevItem,
                clearItems,
                addToQueue,
                // audio data
                buffered,
                currentAudio: currentAudio || null,
                // volume
                volume,
                setVolume,
                toggleMuted,
                showGlobalPlayer: nItems > 0, // Show player if there are items in the queue
            }}
        >
            {children}
        </AudioContext.Provider>
    );
}

/** Custom audio hook
 * that taps into the audio event handler
 * to propagate events to react.
 *
 * Very specified for our id usecase.
 */
function useAudioData(item: ItemResponse | null) {
    const [canPlay, setCanPlay] = useState(false);
    const [playing, _setPlaying] = useState(false);
    const [buffered, setBuffered] = useState<TimeRanges | null>(null); // In seconds < total duration

    const [volume, setVolume] = useLocalStorage<number>("volume", 1);
    const beforeMuted = useRef<number | null>(null); // needed to store pre-muted volume
    const [currentTime, setCurrentTime] = useState(0);

    const { data: currentAudio } = useQuery(itemAudioDataQueryOptions(item?.id));
    useEffect(() => {
        if (!currentAudio) return;

        // Forward audio events to react
        const updatePlaying = () => _setPlaying(currentAudio.paused ? false : true);
        const updateCurrentTime = () => setCurrentTime(currentAudio.currentTime);
        const updateVolume = () => setVolume(currentAudio.volume);
        const updateCanPlay = () => setCanPlay(currentAudio.readyState >= 2);
        const updateBuffered = () => setBuffered(currentAudio.buffered);

        currentAudio.addEventListener("play", updatePlaying);
        currentAudio.addEventListener("pause", updatePlaying);
        currentAudio.addEventListener("timeupdate", updateCurrentTime);
        currentAudio.addEventListener("seeking", updateCurrentTime);
        currentAudio.addEventListener("progress", updateBuffered);
        currentAudio.addEventListener("volumechange", updateVolume);
        currentAudio.addEventListener("canplay", updateCanPlay);

        // Force load only new audio sources
        if (currentAudio.readyState < 2) {
            currentAudio.load();
        }
        console.log("Loading audio", currentAudio);
        updateCurrentTime();
        updateCanPlay();
        updateBuffered();

        return () => {
            currentAudio.removeEventListener("play", updatePlaying);
            currentAudio.removeEventListener("pause", updatePlaying);
            currentAudio.removeEventListener("timeupdate", updateCurrentTime);
            currentAudio.removeEventListener("seeking", updateCurrentTime);
            currentAudio.removeEventListener("progress", updateBuffered);
            currentAudio.removeEventListener("volumechange", updateVolume);
            currentAudio.removeEventListener("canplay", updateCanPlay);

            currentAudio.pause();
        };
    }, [currentAudio, setVolume]);

    const seek = useCallback(
        (time: number) => {
            if (!currentAudio || !item) return;
            currentAudio.currentTime = time;
        },
        [item, currentAudio]
    );

    // Sync play state, allows to use the setPlaying function
    // to control the audio playback
    const setPlaying = useCallback(
        (playing: boolean) => {
            if (!currentAudio) return;
            if (playing) {
                currentAudio.play().catch(console.error);
            } else {
                currentAudio.pause();
            }
        },
        [currentAudio]
    );

    // Sync volume to audio element
    useEffect(() => {
        if (!currentAudio) return;
        currentAudio.volume = volume;
    }, [volume, currentAudio]);

    // Sync play state to audio element
    useEffect(() => {
        if (!currentAudio) return;
        if (playing) {
            currentAudio.play().catch(console.error);
        } else {
            currentAudio.pause();
        }
    }, [playing, currentAudio]);

    // MediaSession handles
    useMediaSessionHandlers(currentAudio || null, item, setPlaying, seek, currentTime);

    return {
        currentAudio,
        playing,
        setPlaying,
        volume,
        currentTime,
        seek,
        buffered,
        canPlay: canPlay,
        setVolume: (value: number) => {
            if (!currentAudio) return;
            const v = Math.max(0, Math.min(1, value));
            currentAudio.volume = v;
            if (currentAudio.muted && v > 0) {
                currentAudio.muted = false;
            }
        },
        toggleMuted: () => {
            if (!currentAudio) return;
            if (!currentAudio.muted) {
                beforeMuted.current = currentAudio.volume;
                currentAudio.muted = true;
                currentAudio.volume = 0;
            } else {
                currentAudio.muted = false;
                currentAudio.volume = beforeMuted.current || 1;
                beforeMuted.current = null;
            }
        },
    };
}

/** Hook to manage media data */
function useMediaSessionHandlers(
    currentAudio: HTMLAudioElement | null,
    item: ItemResponse | null,
    setPlaying: (playing: boolean) => void,
    seek: (time: number) => void,
    currentTime: number
) {
    const artwork = useMemo(() => {
        if (!item) return undefined;
        return [
            {
                src: "/api_v1" + artUrl("item", item.id, "small"),
                sizes: "256x256",
                type: "image/png",
            },
            {
                src: "/api_v1" + artUrl("item", item.id, "medium"),
                sizes: "512x512",
                type: "image/png",
            },
            {
                src: "/api_v1" + artUrl("item", item.id, "large"),
                sizes: "1024x1024",
                type: "image/png",
            },
        ];
    }, [item]);

    const onSeekBackward = useCallback(
        (evt: MediaSessionActionDetails) => {
            const skipTime = evt.seekOffset || 10;
            seek(currentTime - skipTime);
        },
        [currentTime, seek]
    );

    const onSeekForward = useCallback(
        (evt: MediaSessionActionDetails) => {
            const skipTime = evt.seekOffset || 10;
            seek(currentTime + skipTime);
        },
        [currentTime, seek]
    );

    const onSeekTo = useCallback(
        (evt: MediaSessionActionDetails) => {
            seek(evt.seekTime!);
        },
        [seek]
    );

    // Forward time updates to media session
    useEffect(() => {
        if (!("mediaSession" in navigator)) return;
        if (!currentAudio || !item) return;
        // Might sometimes error if there is an audio desync
        // we prevent propagating the error here
        try {
            navigator.mediaSession.setPositionState({
                duration: item.length || currentAudio.duration,
                playbackRate: currentAudio.playbackRate,
                position: currentTime,
            });
        } catch (error) {
            console.warn("Error setting position state", error);
        }
    }, [currentTime, currentAudio, item]);

    useMediaSession({
        title: item?.name,
        artist: item?.artist,
        album: item?.album,
        artwork,
        onPlay: useCallback(() => setPlaying(true), [setPlaying]),
        onPause: useCallback(() => setPlaying(false), [setPlaying]),
        onSeekBackward,
        onSeekForward,
        onSeekTo,
    });
}
