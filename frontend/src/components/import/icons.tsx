import {
    AudioLines,
    Brain,
    Calendar,
    CassetteTape,
    Disc3,
    Flag,
    GitPullRequestArrow,
    SearchX,
    UserRound,
    Variable,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Tooltip from "@mui/material/Tooltip";

import mb from "@/assets/musicbrainz.webp";
import spotify from "@/assets/spotify.png";
import spotifyBw from "@/assets/spotifyBw.svg";

import { CandidateChoice } from "./context";

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

const penaltyOrder = [
    "missing_tracks",
    "tracks",
    "unmatched_tracks",
    "artist",
    "album",
    "media",
    "year",
    "country",
];

export function PenaltyIconRow({
    candidate,
    showSource = true,
}: {
    candidate: CandidateChoice;
    showSource?: boolean;
}) {
    const penalties = useMemo(() => {
        return (candidate.penalties ?? [])
            .map((penalty) => {
                switch (penalty) {
                    // somewhat preferential. source is still punished by weight,
                    // but we display the source as an icon...
                    case "mediums":
                        return "media";
                    case "source":
                        return null;
                    default:
                        return penalty;
                }
            })
            .filter(Boolean) as string[];
    }, [candidate]);

    const [others, setOthers] = useState<string[]>([]);
    const match = candidate.track_match ?? candidate.album_match;
    const source = match.info.data_source!;

    useEffect(() => {
        const otherPenalties = penalties.filter((p) => !penaltyOrder.includes(p));
        setOthers(otherPenalties);
    }, [penalties]);

    return (
        <Box className={styles.penaltyIconRow}>
            {showSource && (
                <Box sx={{ marginRight: "0.75rem" }} className={styles.sourceIcon}>
                    <SourceIcon source={source} />
                </Box>
            )}
            {penaltyOrder.map((p) => (
                <PenaltyIcon
                    key={p}
                    kind={p}
                    className={
                        penalties.indexOf(p) === -1 ? styles.inactive : styles.penalty
                    }
                />
            ))}
            {
                <PenaltyIcon
                    kind={others.join(" ")}
                    className={others.length === 0 ? styles.inactive : styles.penalty}
                />
            }
        </Box>
    );
}

export function PenaltyIcon({ kind, className }: { kind: string; className?: string }) {
    const render = (IconComponent: React.ComponentType) => {
        const res = kind
            .replace("album_", "")
            .replace("track_", "")
            .replaceAll(" ", ", ")
            .replaceAll("_", " ")
            // rename for more verbose hover
            .replace(/^tracks\b/, "changed tracks");

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
