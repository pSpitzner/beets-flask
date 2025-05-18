import {
    createContext,
    useCallback,
    useContext,
    useEffect,
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
    hasNext: boolean;
    hasPrev: boolean;
    nextItem: () => ItemResponse | null;
    prevItem: () => ItemResponse | null;
    clearItems: () => void;
    addToQueue: (item: ItemResponse) => void;

    // Audio data + waveforms
    currentAudio: HTMLAudioElement | null;
    buffered: TimeRanges | null;

    // Volume
    volume: number;
    setVolume: (value: number) => void;
    toggleMuted: () => void;
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

    function addToQueue(item: ItemResponse) {
        // Prefetch the audio data for the item
        // FIXME: this can be quite some data if there are many items
        // maybe a smarter way to do this?
        if (currentItem) {
            console.log("Prefetching audio for item", item.id);
            prefetchItemAudioData(item.id).catch(console.error);
            prefetchWaveform(item.id).catch(console.error);
        }
        add(item);
    }

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

    const [volume, setVolume] = useState(1);
    const beforeMuted = useRef<number | null>(null); // needed to store pre-muted volume
    const [currentTime, setCurrentTime] = useState(0);

    const { data: currentAudio } = useQuery(itemAudioDataQueryOptions(item?.id));
    useEffect(() => {
        if (!currentAudio) return;

        // Forward audio events to react
        const updatePlaying = () => _setPlaying(!currentAudio.paused);
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

        // reapply the current play state i.e. playing
        // this continues the playback if the audio was playing
        // before the component was unmounted
        _setPlaying((prev) => {
            if (prev) {
                currentAudio.play().catch(console.error);
            } else {
                currentAudio.pause();
            }
            return prev;
        });

        updateCurrentTime();
        updateVolume();
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
    }, [currentAudio]);

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
            _setPlaying(playing);
        },
        [currentAudio]
    );

    // Sync volume to audio element
    useEffect(() => {
        if (!currentAudio) return;
        currentAudio.volume = volume;
    }, [volume, currentAudio]);

    // Forward time updates to media session
    useEffect(() => {
        if (!currentAudio || !item) return;
        if (!("mediaSession" in navigator)) return;
        navigator.mediaSession.setPositionState({
            duration: item.length || currentAudio.duration,
            playbackRate: currentAudio.playbackRate,
            position: currentTime,
        });
    }, [currentTime, currentAudio, item]);

    // MediaSession handles
    useMediaSession({
        title: item?.name,
        artist: item?.artist,
        album: item?.album,
        artwork: item
            ? [
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
              ]
            : undefined,

        onPlay: () => setPlaying(true),
        onPause: () => setPlaying(false),
        onSeekBackward: (evt) => {
            if (!currentAudio) return;
            // Time to skip in seconds
            const skipTime = evt.seekOffset || 10;
            seek(currentTime - skipTime);
        },
        onSeekForward: (evt) => {
            if (!currentAudio) return;
            const skipTime = evt.seekOffset || 10;
            seek(currentTime + skipTime);
        },
        onSeekTo: (evt) => {
            if (!currentAudio) return;
            if (evt.fastSeek && "fastSeek" in currentAudio) {
                currentAudio.fastSeek(evt.seekTime!);
            }
            seek(evt.seekTime!);
        },
    });

    return {
        currentAudio,
        playing,
        setPlaying,
        volume,
        currentTime,
        buffered,
        canPlay: canPlay,
        setVolume: (value: number) => {
            if (!currentAudio) return;
            const v = Math.max(0, Math.min(1, value));
            currentAudio.volume = v;
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
