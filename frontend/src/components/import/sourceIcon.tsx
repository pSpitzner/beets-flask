import mb from "@/assets/musicbrainz.webp";
import spotify from "@/assets/spotify.png";
import spotifyBw from "@/assets/spotifyBw.svg";
import { Brain } from "lucide-react";

export const SourceIcon = ({
    source,
    color = false,
}: {
    source: string;
    color?: boolean;
}) => {
    switch (source.toLowerCase()) {
        case "spotify":
            if (color) return <img src={spotify} alt="Spotify" />;
            return <img src={spotifyBw} alt="Spotify" />;
        case "musicbrainz":
            if (color) return <img src={mb} alt="MusicBrainz" />;
            return <Brain />;

        default:
            return null;
    }
};
