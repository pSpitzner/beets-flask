import { createContext, useContext, useState } from "react";

import { useNavigableList } from "@/components/common/hooks/useNavigableList";
import { ItemResponse } from "@/pythonTypes";

interface AudioContextI {
    // The current item being played (beets item)
    currentItem: ItemResponse | null;

    // Play state
    isPlaying: boolean;
    togglePlay: () => void;

    // Queue
    hasNext: boolean;
    hasPrev: boolean;
    nextItem: () => ItemResponse | null;
    prevItem: () => ItemResponse | null;
    clearQueue: () => void;
    addToQueue: (item: ItemResponse) => void;

    // Audio data + waveforms
    // TODO
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
    const [isPlaying, setIsPlaying] = useState(false);

    const {
        navigate,
        currentItem,
        hasNext,
        hasPrev,
        clear: clearQueue,
        add: addToQueue,
    } = useNavigableList<ItemResponse>([]);

    function togglePlay() {
        setIsPlaying((prev) => !prev);
    }

    return (
        <AudioContext.Provider
            value={{
                // playback related
                isPlaying,
                togglePlay,
                // queue related
                currentItem,
                hasNext,
                hasPrev,
                nextItem: navigate.bind(null, 1),
                prevItem: navigate.bind(null, -1),
                clearQueue,
                addToQueue,
            }}
        >
            {children}
        </AudioContext.Provider>
    );
}
