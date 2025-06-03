import { useEffect } from "react";

interface MediaSessionProps {
    title?: string;
    artist?: string;
    album?: string;
    artwork?: string | MediaImage[];

    onPlay?: () => void;
    onPause?: () => void;
    onStop?: () => void;
    onSeekBackward?: MediaSessionActionHandler;
    onSeekForward?: MediaSessionActionHandler;
    onSeekTo?: MediaSessionActionHandler;
}

/** MediaSession react hook
 *
 * provide custom behaviors for standard media playback
 * e.g. to show media controls on the lock screen and in the notification
 * center.
 *
 * see https://developer.mozilla.org/en-US/docs/Web/API/MediaSession
 */
export function useMediaSession({
    title,
    artist,
    album,
    artwork,
    onPlay,
    onPause,
    onStop,
    onSeekBackward,
    onSeekForward,
    onSeekTo,
}: MediaSessionProps) {
    // Set metadata on changes
    useEffect(() => {
        if (!("mediaSession" in navigator)) return;

        const art = typeof artwork === "string" ? [{ src: artwork }] : artwork;
        navigator.mediaSession.metadata = new MediaMetadata({
            title,
            artist,
            album,
            artwork: art,
        });

        return () => {
            navigator.mediaSession.metadata = null;
        };
    }, [title, artist, album, artwork]);

    // Set action handlers
    useEffect(() => {
        if (!("mediaSession" in navigator)) return;

        if (onPlay) navigator.mediaSession.setActionHandler("play", onPlay);
        if (onPause) navigator.mediaSession.setActionHandler("pause", onPause);
        if (onStop) navigator.mediaSession.setActionHandler("stop", onStop);
        if (onSeekBackward)
            navigator.mediaSession.setActionHandler("seekbackward", onSeekBackward);
        if (onSeekForward)
            navigator.mediaSession.setActionHandler("seekforward", onSeekForward);
        if (onSeekTo) navigator.mediaSession.setActionHandler("seekto", onSeekTo);

        return () => {
            navigator.mediaSession.setActionHandler("play", null);
            navigator.mediaSession.setActionHandler("pause", null);
            navigator.mediaSession.setActionHandler("stop", null);
            navigator.mediaSession.setActionHandler("seekbackward", null);
            navigator.mediaSession.setActionHandler("seekforward", null);
        };
    }, [onPlay, onPause, onStop, onSeekBackward, onSeekForward, onSeekTo]);
}
