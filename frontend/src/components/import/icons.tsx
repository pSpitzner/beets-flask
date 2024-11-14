import {
    AudioLines,
    BadgeAlert,
    Brain,
    Calendar,
    CassetteTape,
    Copy,
    Disc3,
    FastForward,
    Flag,
    GitPullRequestArrow,
    LucideProps,
    SearchX,
    Tally5,
    UserRound,
    Variable,
} from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Tooltip from "@mui/material/Tooltip";

import { CandidateState } from "./types";

import styles from "./import.module.scss";
import mb from "@/assets/musicbrainz.webp";
import spotify from "@/assets/spotify.png";
import spotifyBw from "@/assets/spotifyBw.svg";

const penaltyOrder = [
    "missing_tracks",
    "tracks",
    "unmatched_tracks",
    "artist",
    "album",
    "media",
    "mediums",
    "year",
    "country",
];

/**
 * Renders a row of penalty icons for a given candidate, optionally including the source icon.
 *
 * @param {Object} props - The properties passed to the component.
 * @param {CandidateState} props.candidate - The candidate state object containing penalty information.
 * @param {boolean} [props.showSource=true] - Determines whether to display the source icon.
 * @returns {JSX.Element} - The rendered row of penalty icons wrapped in a Box component.
 */
export function PenaltyIconRow({
    candidate,
    showSource = true,
}: {
    candidate: CandidateState;
    showSource?: boolean;
}): JSX.Element {
    const penalties = useMemo(() => {
        return (candidate.penalties ?? [])
            .map((penalty) => {
                switch (penalty) {
                    // somewhat preferential. source is still punished by weight,
                    // but we display the source as an icon... id like not to think
                    // of the source as a penalty.
                    case "source":
                        return null;
                    default:
                        return penalty;
                }
            })
            .filter(Boolean) as string[];
    }, [candidate]);

    const [others, setOthers] = useState<string[]>([]);
    const source = candidate.info.data_source;
    const is_duplicate = candidate.duplicate_in_library;

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
            {is_duplicate ? (
                <PenaltyIcon kind="duplicate" className={styles.penalty} />
            ) : (
                <PenaltyIcon kind="duplicate" className={styles.inactive} />
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
            <PenaltyIcon
                kind={others.join(" ")}
                className={others.length === 0 ? styles.inactive : styles.penalty}
            />
        </Box>
    );
}

type IconType = React.ForwardRefExoticComponent<
    Omit<LucideProps, "ref"> & React.RefAttributes<SVGSVGElement>
>;

/**
 * Renders an icon representing a specific penalty kind.
 *
 * @param {Object} props - The properties passed to the component.
 * @param {string} props.kind - The type of penalty, which determines the icon to be displayed.
 * @param {string} [props.className] - An optional class name to be applied to the icon container.
 * @param {Omit<LucideProps, "ref">} [props] - Additional properties to be passed to the icon component.
 * @returns {JSX.Element} - The rendered icon wrapped in a Tooltip and Box component.
 */
export function PenaltyIcon({
    kind,
    className,
    ...props
}: { kind: string; className?: string } & Omit<LucideProps, "ref">): JSX.Element {
    /** Determine the icon to use for a penalty kind */
    let Icon: IconType | null = null;
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
            Icon = CassetteTape;
            break;
        case "mediums":
            Icon = Tally5;
            break;
        case "country":
            Icon = Flag;
            break;
        case "year":
            Icon = Calendar;
            break;
        case "duplicate":
            Icon = Copy;
            break;
        default:
            Icon = Variable;
            break;
    }

    const kind_title = kind
        .replace("album_", "")
        .replace("track_", "")
        .replaceAll(" ", ", ")
        .replaceAll("_", " ")
        // rename for more verbose hover
        .replace(/^tracks\b/, "track changes")
        .replace(/^mediums\b/, "number of discs");

    return (
        <Tooltip title={kind_title}>
            <Box className={`${styles.penaltyIcon} ${className}`}>
                <Icon {...props} />
            </Box>
        </Tooltip>
    );
}

/**
 * Renders an icon representing the source of the candidate data.
 *
 * @param {Object} props - The properties passed to the component.
 * @param {string} [props.source] - The source of the candidate data, e.g., "Spotify" or "MusicBrainz".
 * @param {boolean} [props.color=false] - Determines whether to display the icon in color or in black and white.
 * @returns {JSX.Element} - The rendered icon wrapped in a Tooltip and Box component.
 */
export function SourceIcon({
    source,
    color = false,
}: {
    source?: string;
    color?: boolean;
}): JSX.Element {
    let Icon: React.ReactNode | null = null;

    switch (source?.toLowerCase()) {
        case "spotify":
            if (color) Icon = <img src={spotify} />;
            else Icon = <img src={spotifyBw} />;
            break;
        case "musicbrainz":
            if (color) Icon = <img src={mb} />;
            else Icon = <Brain />;
            break;
        case "asis":
            Icon = <FastForward />;
            break;
        case undefined:
        case null:
            Icon = <BadgeAlert />;
            break;
        default:
            console.warn("Unknown source", source);
            Icon = <BadgeAlert />;
            break;
    }

    return (
        <Tooltip title={source === "asis" ? "Metadata from files" : source}>
            <Box className={styles.sourceIcon}>{Icon}</Box>
        </Tooltip>
    );
}
