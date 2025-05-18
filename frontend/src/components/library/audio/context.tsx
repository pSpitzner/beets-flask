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
    // The current item being played (beets item)
    currentItem: ItemResponse | null;

    // Play state
    canPlay: boolean;
    playing: boolean;
    setPlaying: (playing: boolean) => void;
    togglePlaying: () => void;
    currentTime: number;

    // Queue
    hasNext: boolean;
    hasPrev: boolean;
    nextItem: () => ItemResponse | null;
    prevItem: () => ItemResponse | null;
    clearQueue: () => void;
    addToQueue: (item: ItemResponse) => void;

    // Audio data + waveforms
    audioRef: React.RefObject<HTMLAudioElement>;
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
    const audioRef = useRef<HTMLAudioElement>(null);
    const {
        navigate,
        currentItem,
        hasNext,
        hasPrev,
        clear: clearQueue,
        add,
    } = useNavigableList<ItemResponse>([]);

    const {
        buffered,
        currentTime,
        playing,
        setPlaying,
        setVolume,
        toggleMuted,
        volume,
        canPlay,
    } = useAudioData(currentItem, audioRef);

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
        if (audioRef.current) {
            audioRef.current.currentTime = 0;
        }
        return navigate(1);
    };
    const prevItem = () => {
        if (audioRef.current) {
            audioRef.current.currentTime = 0;
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
                    if (!audioRef.current) return;
                    if (audioRef.current.paused) {
                        setPlaying(true);
                    } else {
                        setPlaying(false);
                    }
                },
                currentTime,
                // queue related
                currentItem,
                hasNext,
                hasPrev,
                nextItem: nextItem,
                prevItem: prevItem,
                clearQueue,
                addToQueue,
                // audio data
                buffered,
                audioRef,
                // volume
                volume,
                setVolume,
                toggleMuted,
            }}
        >
            {children}
            <audio ref={audioRef} style={{ display: "none" }} />
        </AudioContext.Provider>
    );
}

/** Custom audio hook
 * that taps into the audio event handler
 * to propagate events to react.
 *
 * Very specified for our id usecase.
 */
function useAudioData(
    item: ItemResponse | null,
    ref: React.RefObject<HTMLAudioElement>
) {
    const [canPlay, setCanPlay] = useState(false);
    const [playing, _setPlaying] = useState(false);
    const [buffered, setBuffered] = useState<TimeRanges | null>(null); // In seconds < total duration

    const [volume, setVolume] = useState(1);
    const beforeMuted = useRef<number | null>(null); // needed to store pre-muted volume
    const [currentTime, setCurrentTime] = useState(0);

    const { data: audioData } = useQuery(itemAudioDataQueryOptions(item?.id));

    // Set the audio element to the ref
    useEffect(() => {
        if (!ref.current || !audioData) return;
        const audio = ref.current;
        const blobUrl = URL.createObjectURL(audioData);
        audio.src = blobUrl;

        // Forward audio events to react
        const handlePlay = () => _setPlaying(true);
        const handlePause = () => _setPlaying(false);
        const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
        const updateVolume = () => setVolume(audio.volume);
        const updateCanPlay = () => setCanPlay(audio.readyState >= 2);
        const handleSeek = () => setCurrentTime(audio.currentTime);
        const handleProgress = () => setBuffered(audio.buffered);

        audio.addEventListener("play", handlePlay);
        audio.addEventListener("pause", handlePause);
        audio.addEventListener("timeupdate", handleTimeUpdate);
        audio.addEventListener("seeking", handleSeek);
        audio.addEventListener("progress", handleProgress);
        audio.addEventListener("volumechange", updateVolume);
        audio.addEventListener("canplay", updateCanPlay);

        audio.load();
        updateVolume();

        return () => {
            audio.removeEventListener("play", handlePlay);
            audio.removeEventListener("pause", handlePause);
            audio.removeEventListener("timeupdate", handleTimeUpdate);
            audio.removeEventListener("seeking", handleSeek);
            audio.removeEventListener("progress", handleProgress);
            audio.removeEventListener("volumechange", updateVolume);
            audio.removeEventListener("canplay", updateCanPlay);

            URL.revokeObjectURL(blobUrl);
            audio.pause(); // Pause track if it was playing
        };
    }, [audioData, ref]);

    const seek = useCallback(
        (time: number) => {
            if (!ref.current || !item) return;
            ref.current.currentTime = time;
        },
        [item, ref]
    );

    // Sync play state, allows to use the setPlaying function
    // to control the audio playback
    const setPlaying = useCallback(
        (playing: boolean) => {
            if (!ref.current) return;
            console.log(ref.current);
            if (playing) {
                ref.current.play().catch(console.error);
            } else {
                ref.current.pause();
            }
            _setPlaying(playing);
        },
        [ref]
    );

    // Sync volume to audio element
    useEffect(() => {
        if (!ref.current) return;
        ref.current.volume = volume;
    }, [volume, ref]);

    // Forward time updates to media session
    useEffect(() => {
        if (!ref.current || !item) return;
        if (!("mediaSession" in navigator)) return;
        navigator.mediaSession.setPositionState({
            duration: item.length || ref.current.duration,
            playbackRate: ref.current.playbackRate,
            position: currentTime,
        });
    }, [currentTime, ref, item]);

    // MediaSession handles
    useMediaSession({
        title: item?.name,
        artist: item?.artist,
        album: item?.album,
        artwork: item ? artUrl("item", item.id) : undefined,
        onPlay: () => setPlaying(true),
        onPause: () => setPlaying(false),
        onSeekBackward: (evt) => {
            if (!ref.current) return;
            // Time to skip in seconds
            const skipTime = evt.seekOffset || 10;
            seek(currentTime - skipTime);
        },
        onSeekForward: (evt) => {
            if (!ref.current) return;
            const skipTime = evt.seekOffset || 10;
            seek(currentTime + skipTime);
        },
        onSeekTo: (evt) => {
            if (!ref.current) return;
            if (evt.fastSeek && "fastSeek" in ref.current) {
                ref.current.fastSeek(evt.seekTime!);
            }
            seek(evt.seekTime!);
        },
    });

    return {
        playing,
        setPlaying,
        volume,
        currentTime,
        buffered,
        canPlay: canPlay,
        setVolume: (value: number) => {
            if (!ref.current) return;
            const v = Math.max(0, Math.min(1, value));
            ref.current.volume = v;
        },
        toggleMuted: () => {
            if (!ref.current) return;
            if (!ref.current.muted) {
                beforeMuted.current = ref.current.volume;
                ref.current.muted = true;
                ref.current.volume = 0;
            } else {
                ref.current.muted = false;
                ref.current.volume = beforeMuted.current || 1;
                beforeMuted.current = null;
            }
        },
    };
}
