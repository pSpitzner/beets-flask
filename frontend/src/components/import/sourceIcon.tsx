import mb from "@/assets/musicbrainz.webp";
import spotify from "@/assets/spotify.png";

export const SourceIcon = ({ source }: { source: string }) => {
    switch (source.toLowerCase()) {
        case "spotify":
            return <img src={spotify} alt="Spotify" />;
        case "musicbrainz":
            return <img src={mb} alt="MusicBrainz" />;
        default:
            return null;
    }
};
