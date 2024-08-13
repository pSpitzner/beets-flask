import {
    AudioLines,
    Brain,
    Calendar,
    CassetteTape,
    Disc3,
    Flag,
    GitPullRequestArrow,
    List,
    ListX,
    SearchX,
    TextSearch,
    UserRound,
    Variable,
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
    const render = (children: React.ReactNode, alt?: string) => (
        <Tooltip title={alt}>
            <Box className={styles.sourceIcon}>{children}</Box>
        </Tooltip>
    );

    switch (source.toLowerCase()) {
        case "spotify":
            if (color) return render(<img src={spotify} />, source);
            return render(<img src={spotifyBw} />, source);
        case "musicbrainz":
            if (color) return render(<img src={mb} />, source);
            return render(<Brain />, source);

        default:
            return null;
    }
};

export const penaltyOrder = [
    "artist",
    "album",
    "tracks",
    "unmatched_tracks",
    "missing_tracks",
    "media",
    "year",
    "country",
];

export function PenaltyIcon({ kind, className }: { kind: string; className?: string }) {
    const render = (IconComponent: React.ComponentType) => {
        const res = kind
            .replace("album_", "")
            .replace("track_", "")
            .replaceAll(" ", ", ")
            .replaceAll("_", " ");
        return (
            <Tooltip title={res}>
                <Box className={`${styles.penaltyIcon} ${className}`}>
                    <IconComponent />
                </Box>
            </Tooltip>
        );
    };

    switch (kind) {
        case "artist":
            return render(UserRound);
        case "album":
            return render(Disc3);
        case "tracks":
            return render(AudioLines);
        case "unmatched_tracks":
            return render(GitPullRequestArrow);
        case "missing_tracks":
            return render(SearchX);
        case "media":
            return render(CassetteTape);
        case "mediums":
            return render(CassetteTape);
        case "country":
            return render(Flag);
        case "year":
            return render(Calendar);
        default:
            return render(Variable);
    }
}
