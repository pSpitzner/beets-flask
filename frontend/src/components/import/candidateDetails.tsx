import {
    ArrowRight,
    AudioLines,
    Disc3,
    GitPullRequestArrow,
    Link2,
    SearchX,
    UserRound,
} from "lucide-react";
import Box from "@mui/material/Box";

import { useConfig } from "../common/useConfig";
import { useDiff } from "./diff";
import { CandidateState, ItemInfo, TrackInfo } from "./types";

import styles from "./import.module.scss";

/* ---------------------------------------------------------------------------------- */
/*                                       Basics                                       */
/* ---------------------------------------------------------------------------------- */

export function ArtistChange({ prev, next }: { prev: string; next: string }) {
    const { left, right, didRemove, didAdd } = useDiff(prev, next);
    const didChange = didRemove || didAdd;

    let inner: React.ReactNode;
    if (prev === next) {
        inner = <span>{prev}</span>;
    } else {
        inner = (
            <Box className={styles.inner}>
                {<span>{left}</span>}
                {<ArrowRight className={styles.changed} size={14} />}
                {<span>{right}</span>}
            </Box>
        );
    }

    return (
        <Box className={styles.artistChange}>
            <UserRound size={14} className={didChange ? styles.changed : ""} />
            {inner}
        </Box>
    );
}

export function AlbumChange({ prev, next }: { prev: string; next: string }) {
    const { left, right, didRemove, didAdd } = useDiff(prev, next);
    const didChange = didRemove || didAdd;

    let inner: React.ReactNode;
    if (prev === next) {
        inner = <span>{prev}</span>;
    } else {
        inner = (
            <Box className={styles.inner}>
                {<span>{left}</span>}
                {<ArrowRight className={styles.changed} size={14} />}
                {<span>{right}</span>}
            </Box>
        );
    }

    return (
        <Box className={styles.albumChange}>
            <Disc3 size={14} className={didChange ? styles.changed : ""} />
            {inner}
        </Box>
    );
}

export function Disambiguation({
    candidate,
    fields,
    excludeFields = [],
}: {
    candidate: CandidateState;
    fields?: string[];
    excludeFields?: string[];
}) {
    const config = useConfig();
    if (!fields) {
        fields =
            candidate.type === "album"
                ? config?.match.album_disambig_fields || []
                : config?.match.singleton_disambig_fields || [];
    }

    const info = candidate.info;
    const disambigs = fields
        .map((field) => {
            if (field in info && !excludeFields.includes(field)) {
                return info[field as keyof typeof info];
            }
            return undefined;
        })
        .filter((x) => !!x) as string[];

    if (disambigs.length === 0) {
        return null;
    }

    return <Box className={styles.disambig}>{disambigs.join(", ")}</Box>;
}

export function DataUrl({ candidate }: { candidate: CandidateState }) {
    const info = candidate.info;
    if (!info.data_url) {
        return null;
    }
    return (
        <Box className={styles.dataUrl}>
            <Link2 size={14} />
            <span>{info.data_url}</span>
        </Box>
    );
}

/* ---------------------------------------------------------------------------------- */
/*                                    Track Changes                                   */
/* ---------------------------------------------------------------------------------- */

export function TrackChanges({ candidate }: { candidate: CandidateState }) {
    if (candidate.type !== "album") {
        return null;
    }
    const tracks = candidate.tracks;
    const items = candidate.items;
    const mapping = candidate.mapping;
    // curious: when only capitalization changes in tracks, we do not get the
    // track change penalty. this leads to a bit of communication issue:
    // reading 'no changes' in the heading but having a bunch of them marked is confusing.
    const tracksChanged = candidate.penalties?.includes("tracks");

    return (
        <Box sx={{ display: "flex", flexDirection: "column" }}>
            <Box className={styles.previewHeading}>
                {tracksChanged ? (
                    <>
                        <AudioLines size={14} className={styles.changed} />
                        <span className={""}>Track changes</span>
                    </>
                ) : (
                    <>
                        <AudioLines size={14} />
                        <span className={""}>No severe track changes</span>
                    </>
                )}
            </Box>
            <Box className={styles.trackChanges}>
                {Object.entries(mapping).map(([idx, tdx]) => {
                    return (
                        <TrackDiff
                            key={idx}
                            prev={items[parseInt(idx)]}
                            next={tracks[tdx]}
                            // mapping uses 0-based indexing, but track display 1-based
                            // probably the most robus way to do the mapping would be
                            // from data-path to match-url
                            // (that is, iff every trackinfo has match url, and not just on the album-level)
                            pdx={parseInt(idx) + 1}
                            ndx={tdx + 1}
                        />
                    );
                })}
            </Box>
        </Box>
    );
}

function TrackDiff({
    prev,
    next,
    pdx,
    ndx,
}: {
    prev: ItemInfo | TrackInfo;
    next: ItemInfo | TrackInfo;
    pdx?: number; // previous index, 1-based
    ndx?: number; // next index, 1-based
}) {
    const { left: lTitleD, right: rTitleD } = useDiff(prev.title, next.title);

    const leftTime = prev.length ?? 0;
    const rightTime = next.length ?? 0;

    const leftIdx = pdx;
    const rightIdx = ndx;

    const hasTitleChanged = prev.title !== next.title;
    const hasTimeChanged = Math.abs(rightTime - leftTime) > 1;
    const hasIndexChanged = pdx !== ndx;
    const numChanges = [hasTitleChanged, hasTimeChanged, hasIndexChanged].filter(
        (x) => x
    ).length;

    let inner: React.ReactNode;
    if (hasTitleChanged || numChanges > 1) {
        // 'big change'
        inner = (
            <Box className={styles.diff}>
                <Box className={styles.lhs}>
                    {
                        <span className={styles.trackChangeSide}>
                            <TrackIndex
                                idx={leftIdx}
                                className={
                                    hasIndexChanged ? styles.removed : styles.fade
                                }
                            />
                            <span>{lTitleD}</span>
                            <TrackLength
                                length={leftTime}
                                className={
                                    hasTimeChanged ? styles.removed : styles.fade
                                }
                            />
                        </span>
                    }
                </Box>
                <Box className={styles.rhs}>
                    <ArrowRight className={styles.changed} size={14} />
                    {
                        <span className={styles.trackChangeSide}>
                            <TrackIndex
                                idx={rightIdx}
                                className={hasIndexChanged ? styles.added : styles.fade}
                            />
                            <span>{rTitleD}</span>
                            <TrackLength
                                length={rightTime}
                                className={hasTimeChanged ? styles.added : styles.fade}
                            />
                        </span>
                    }
                </Box>
            </Box>
        );
    } else {
        // title unchanged, 'small' change
        inner = (
            <span className={styles.trackChangeSide}>
                {hasIndexChanged ? (
                    <TrackIndexChange leftIdx={leftIdx} rightIdx={rightIdx} />
                ) : (
                    <TrackIndex idx={leftIdx} className={styles.fade} />
                )}
                <span className={styles.fade}>{prev.title}</span>
                {hasTimeChanged ? (
                    <TrackLengthChange left={leftTime} right={rightTime} />
                ) : (
                    <TrackLength length={leftTime} className={styles.fade} />
                )}
            </span>
        );
    }

    return <Box className={styles.trackChange}>{inner}</Box>;
}

function TrackLength({ length, className }: { length?: number; className?: string }) {
    return (
        <span
            className={
                className ? `${styles.trackLength} ${className}` : styles.trackLength
            }
        >
            {_fmtLength(length)}
        </span>
    );
}

export function TrackLengthChange({
    left,
    right,
    className,
}: {
    left: number;
    right: number;
    className?: string;
}) {
    return (
        <Box
            className={
                className
                    ? `${styles.trackLengthChange} ${className}`
                    : styles.trackLengthChange
            }
        >
            <TrackLength length={left} className={styles.removed} />
            <ArrowRight className={styles.changed} size={14} />
            <TrackLength length={right} className={styles.added} />
        </Box>
    );
}

function _fmtLength(l?: number) {
    if (l === undefined) {
        return "(?:??)";
    }
    const hours = Math.floor(l / 3600);
    const minutes = Math.floor((l % 3600) / 60);
    const seconds = Math.floor(l % 60);
    return `(${hours ? `${hours}h ` : ""}${minutes}:${seconds.toString().padStart(2, "0")})`;
}

function TrackIndex({ idx, className }: { idx?: number; className?: string }) {
    return (
        <span
            className={
                className ? `${styles.trackIndex} ${className}` : styles.trackIndex
            }
        >
            {_fmtTrackIndex(idx)}
        </span>
    );
}

export function TrackIndexChange({
    leftIdx,
    rightIdx,
    className,
}: {
    leftIdx?: number;
    rightIdx?: number;
    className?: string;
}) {
    return (
        <Box
            className={
                className
                    ? `${styles.trackIndexChange} ${className}`
                    : styles.trackIndexChange
            }
        >
            <TrackIndex idx={leftIdx} className={styles.removed} />
            <ArrowRight className={styles.changed} size={14} />
            <TrackIndex idx={rightIdx} className={styles.added} />
        </Box>
    );
}

function _fmtTrackIndex(num?: number) {
    // for now, we only pad to 2 digits, should be fine for most albums
    if (num === undefined) {
        return "";
    }
    return num < 10 ? ` [${num}]` : `[${num}]`;
}

/* ---------------------------------------------------------------------------------- */
/*                                   Missing Tracks                                   */
/* ---------------------------------------------------------------------------------- */

export function MissingTracks({ candidate }: { candidate: CandidateState }) {
    if (candidate.type !== "album") {
        return null;
    }
    const missingTracks = candidate.extra_tracks;
    const tracksMissing = missingTracks.length > 0;

    if (!tracksMissing) {
        return null;
    }

    return (
        <Box sx={{ display: "flex", flexDirection: "column" }}>
            <Box className={styles.previewHeading}>
                <SearchX size={14} className={styles.changed} />
                <span className={""}>Missing tracks: {missingTracks.length}</span>
            </Box>
            <Box className={styles.trackChanges}>
                {missingTracks.map((track, idx) => {
                    return <MissingTrack key={idx} track={track} idx={track.index} />;
                })}
            </Box>
        </Box>
    );
}

function MissingTrack({ track, idx }: { track: TrackInfo | ItemInfo; idx?: number }) {
    return (
        <Box className={styles.trackChange}>
            <TrackIndex idx={idx} />
            <span>{track.title}</span>
            <TrackLength length={track.length} />
        </Box>
    );
}

/* ---------------------------------------------------------------------------------- */
/*                                  Unmatched Tracks                                  */
/* ---------------------------------------------------------------------------------- */

export function UnmatchedTracks({ candidate }: { candidate: CandidateState }) {
    if (candidate.type !== "album") {
        return null;
    }
    const unmatchedTracks = candidate.extra_items;
    const tracksUnmatched = unmatchedTracks.length > 0;

    if (!tracksUnmatched) {
        return null;
    }

    return (
        <Box sx={{ display: "flex", flexDirection: "column" }}>
            <Box className={styles.previewHeading}>
                <GitPullRequestArrow size={14} className={styles.changed} />
                <span className={""}>Unmatched tracks: {unmatchedTracks.length}</span>
            </Box>
            <Box className={styles.trackChanges}>
                {unmatchedTracks.map((track, idx) => {
                    return <UnmatchedTrack key={idx} track={track} idx={track.track} />;
                })}
            </Box>
        </Box>
    );
}

function UnmatchedTrack({ track, idx }: { track: TrackInfo | ItemInfo; idx?: number }) {
    return (
        <Box className={styles.trackChange}>
            <TrackIndex idx={idx} />
            <span>{track.title}</span>
            <TrackLength length={track.length} />
        </Box>
    );
}
