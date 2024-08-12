import {
    Brain,
    Calendar,
    CassetteTape,
    Disc3,
    FileQuestion,
    Flag,
    List,
    ListX,
    TextSearch,
    UserRound,
} from "lucide-react";
import Box from "@mui/material/Box";
import Tooltip from "@mui/material/Tooltip";

import mb from "@/assets/musicbrainz.webp";
import spotify from "@/assets/spotify.png";
import spotifyBw from "@/assets/spotifyBw.svg";

import styles from "./import.module.scss";

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

export const penaltyOrder = [
    "artist",
    "album",
    "tracks",
    "unmatched tracks",
    "missing tracks",
    "media",
    "year",
    "country",
];

export function PenaltyIcon({ kind, className }: { kind: string; className?: string }) {
    const render = (IconComponent: React.ComponentType) => (
        <Tooltip title={kind}>
            <Box className={`${styles.penaltyIcon} ${className}`}>
                <IconComponent />
            </Box>
        </Tooltip>
    );

    switch (kind) {
        case "artist":
            return render(UserRound);
        case "album":
            return render(Disc3);
        case "tracks":
            return render(List);
        case "unmatched tracks":
            return render(TextSearch);
        case "missing tracks":
            return render(ListX);
        case "media":
            return render(CassetteTape);
        case "mediums":
            return render(CassetteTape);
        case "country":
            return render(Flag);
        case "year":
            return render(Calendar);
        default:
            return render(FileQuestion);
    }
}
