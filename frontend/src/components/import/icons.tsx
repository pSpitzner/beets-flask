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

import { CandidateState } from "./context";

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
    candidate: CandidateState;
    showSource?: boolean;
}) {
    const penalties = useMemo(() => {
        return (candidate.penalties ?? [])
            .map((penalty) => {
                switch (penalty) {
                    // somewhat preferential. source is still punished by weight,
                    // but we display the source as an icon... id like not to think
                    // of the source as a penalty.
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
    /** Determine the icon to use for a penalty kind */
    let Icon: React.ComponentType | null = null;
    switch (kind) {
        case "artist":
            Icon = UserRound;
            break;
        case "album":
            Icon = Disc3;
            break;
        case "tracks":
            Icon = AudioLines;
            break;
        case "unmatched_tracks":
            Icon = GitPullRequestArrow;
            break;
        case "missing_tracks":
            Icon = SearchX;
            break;
        case "media":
        case "mediums":
            Icon = CassetteTape;
            break;
        case "country":
            Icon = Flag;
            break;
        case "year":
            Icon = Calendar;
            break;
        default:
            Icon = Variable;
            console.warn("Unknown penalty kind", kind);
            break;
    }

    const kind_title = kind
        .replace("album_", "")
        .replace("track_", "")
        .replaceAll(" ", ", ")
        .replaceAll("_", " ")
        // rename for more verbose hover
        .replace(/^tracks\b/, "track changes");

    return (
        <Tooltip title={kind_title}>
            <Box className={`${styles.penaltyIcon} ${className}`}>
                <Icon />
            </Box>
        </Tooltip>
    );
}
