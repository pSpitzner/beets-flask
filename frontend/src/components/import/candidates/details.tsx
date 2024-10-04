import { ArrowRight, Link2 } from "lucide-react";
import { ReactNode } from "react";
import { BoxProps, styled } from "@mui/material";
import Box from "@mui/material/Box";

import { useDiff } from "./diff";

import styles from "./candidates.module.scss";
import { useConfig } from "../../common/hooks/useConfig";
import { PenaltyIcon } from "../icons";
import { CandidateState, ItemInfo, TrackInfo } from "../types";

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
            <Col>
                <span>{left}</span>
                <ChangeArrow />
                <span>{right}</span>
            </Col>
        );
    }

    return (
        <DetailBox>
            <Col>
                <PenaltyIcon
                    kind={"artist"}
                    className={didChange ? styles.changed : ""}
                />
                {inner}
            </Col>
        </DetailBox>
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
            <Col>
                <span>{left}</span>
                <ChangeArrow />
                <span>{right}</span>
            </Col>
        );
    }

    return (
        <DetailBox>
            <Col>
                <PenaltyIcon
                    kind={"album"}
                    className={didChange ? styles.changed : ""}
                />
                {inner}
            </Col>
        </DetailBox>
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

    return (
        <DetailBox className={styles.disambig}>
            <Col>{disambigs.join(", ")}</Col>
        </DetailBox>
    );
}

export function DataUrl({ candidate }: { candidate: CandidateState }) {
    const info = candidate.info;
    if (!info.data_url) {
        return null;
    }
    return (
        <DetailBox className={styles.dataUrl}>
            <Col>
                <a href={info.data_url} target="_blank" rel="noreferrer">
                    <Link2 size={14} />
                </a>
                <span>{info.data_url}</span>
            </Col>
        </DetailBox>
    );
}

/* ---------------------------------------------------------------------------------- */
/*                                    Track Changes                                   */
/* ---------------------------------------------------------------------------------- */

export function TrackChanges({ candidate }: { candidate: CandidateState }) {
    const config = useConfig();

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
        <DetailBox>
            <Col>
                {tracksChanged ? (
                    <>
                        <PenaltyIcon kind={"tracks"} className={styles.changed} />
                        <span className={""}>Track changes</span>
                    </>
                ) : (
                    <>
                        <PenaltyIcon kind={"tracks"} />
                        <span className={""}>No severe track changes</span>
                    </>
                )}
            </Col>
            <Box
                className={styles.trackChanges}
                data-show-unchanged-tracks={config?.gui.tags.show_unchanged_tracks}
            >
                {Object.entries(mapping).map(([idx, tdx]) => (
                    // each row has 5 columns: index-old title-old arrow index-new title-new
                    // the need to be provided as `grid-area` css property (or sx prop)
                    <TrackDiffRow
                        key={idx}
                        fromItem={items[parseInt(idx)]}
                        toItem={tracks[tdx]}
                        // mapping uses 0-based indexing, but track display 1-based
                        // probably the most robus way to do the mapping would be
                        // from data-path to match-url
                        // (that is, iff every trackinfo has match url, and not just on the album-level)
                        fromIdx={parseInt(idx) + 1}
                        toIdx={tdx + 1}
                    />
                ))}
            </Box>
        </DetailBox>
    );
}

function TrackDiffRow({
    fromItem,
    toItem,
    fromIdx,
    toIdx,
}: {
    fromItem: ItemInfo | TrackInfo;
    toItem: ItemInfo | TrackInfo;
    fromIdx?: number; // from index, 1-based
    toIdx?: number; // next index, 1-based
}) {
    const { left: fromNode, right: toNode } = useDiff(fromItem.title, toItem.title);

    const from = {
        time: fromItem.length ?? 0,
        idx: fromIdx,
        data: fromNode,
        changedClassName: styles.removed,
        type: "from",
    };
    const to = {
        time: toItem.length ?? 0,
        idx: toIdx,
        data: toNode,
        changedClassName: styles.added,
        type: "to",
    };
    const changed = {
        title: fromItem.title !== toItem.title,
        time: Math.abs(to.time - from.time) > 1,
        index: fromIdx !== toIdx,
    };
    const numChanges = [changed.title, changed.time, changed.index].filter(
        (x) => x
    ).length;

    function _change_side_helper({
        data,
        time,
        idx,
        changedClassName,
        type,
    }: {
        data: ReactNode | ReactNode[];
        time: number;
        changedClassName: string;
        idx?: number;
        type: string;
    }) {
        return (
            <>
                <TrackIndex
                    idx={idx}
                    className={changed.index ? changedClassName : styles.fade}
                    sx={{ gridColumn: `index-${type}` }}
                />
                <Box
                    sx={{
                        display: "inline-block",
                        gridColumn: `title-${type}`,
                    }}
                >
                    <span>{data}</span>{" "}
                    <TrackLength
                        length={time}
                        className={changed.time ? changedClassName : styles.fade}
                    />
                </Box>
            </>
        );
    }

    if (changed.title || numChanges > 1) {
        // 'big' change
        return (
            <>
                <Box className={styles.from}>{_change_side_helper(from)}</Box>
                <Box className={styles.to}>
                    <ChangeArrow />
                    {_change_side_helper(to)}
                </Box>
            </>
        );
    }

    // small change / no change
    return (
        <>
            <Box className={styles.noChange}>
                {changed.index ? (
                    <TrackIndexChange
                        sx={{ gridColumn: "index-from" }}
                        fromIdx={from.idx}
                        toIdx={to.idx}
                    />
                ) : (
                    <TrackIndex
                        sx={{ gridColumn: "index-from" }}
                        idx={from.idx}
                        className={styles.fade}
                    />
                )}
                <Col sx={{ gridColumn: "title-from" }}>
                    <span className={styles.fade}>{fromItem.title} </span>
                    {changed.time ? (
                        <TrackLengthChange fromTime={from.time} toTime={to.time} />
                    ) : (
                        <TrackLength length={from.time} className={styles.fade} />
                    )}
                </Col>
            </Box>
        </>
    );
}

function TrackLength({
    length,
    ...props
}: { length?: number } & React.HTMLAttributes<HTMLSpanElement>) {
    return <span {...props}>{_fmtLength(length)}</span>;
}

function TrackIndex({ idx, ...props }: { idx?: number } & BoxProps) {
    return (
        <Box {...props} className={styles.trackIndex + " " + props.className}>
            {_leftPad(idx, 2, "")}
        </Box>
    );
}

function TrackLengthChange({ fromTime, toTime }: { fromTime: number; toTime: number }) {
    return (
        <Col>
            <TrackLength length={fromTime} className={styles.removed} />
            <ChangeArrow />
            <TrackLength length={toTime} className={styles.added} />
        </Col>
    );
}

function TrackIndexChange({
    fromIdx,
    toIdx,
    ...props
}: { fromIdx?: number; toIdx?: number } & BoxProps) {
    return (
        <Col
            {...props}
            style={{
                // This is a bit hacky but aligns the to track index
                // with the normal track index
                display: "grid",
                tableLayout: "fixed",
                gridTemplateColumns: "2.5rem auto 2.5rem",
                width: "6.4rem",
            }}
        >
            <TrackIndex idx={fromIdx} className={styles.removed} />
            <ChangeArrow />
            <TrackIndex idx={toIdx} className={styles.added} />
        </Col>
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

function _leftPad(num?: number, maxDigits = 2, padChar = "  ") {
    // for now, we only pad to 2 digits, should be fine for most albums
    if (num === undefined || isNaN(num)) {
        return ` ${padChar.repeat(maxDigits)} `;
    }
    const lPadNum = num.toString().padStart(maxDigits, padChar);
    return `[${lPadNum}]`;
}

/* ---------------------------------------------------------------------------------- */
/*                            Missing and Unmatched Tracks                            */
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
        <DetailBox>
            <Col>
                <PenaltyIcon
                    kind={"missing_tracks"}
                    size={14}
                    className={styles.changed}
                />
                <span className={""}>Missing tracks: {missingTracks.length}</span>
            </Col>
            <Box className={styles.trackChanges}>
                {missingTracks.map((track, idx) => (
                    <PlainTrackRow key={idx} track={track} idx={track.index} />
                ))}
            </Box>
        </DetailBox>
    );
}

function PlainTrackRow({ track, idx }: { track: TrackInfo | ItemInfo; idx?: number }) {
    return (
        <Box className={styles.noChange}>
            <TrackIndex idx={idx} />
            <span>{track.title}</span>
            <TrackLength length={track.length} />
            {/*Placeholder*/}
            <div />
            <div />
        </Box>
    );
}

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
        <DetailBox>
            <Col>
                <PenaltyIcon
                    kind={"unmatched_tracks"}
                    size={14}
                    className={styles.changed}
                />
                <span className={""}>Unmatched tracks: {unmatchedTracks.length}</span>
            </Col>
            <Box className={styles.trackChanges}>
                {unmatchedTracks.map((track, idx) => (
                    <PlainTrackRow key={idx} track={track} idx={track.track} />
                ))}
            </Box>
        </DetailBox>
    );
}

/* ---------------------------------------------------------------------------------- */

/** A generic row or multirow
 * in the candidate details, inherit
 * for shared styling.
 *
 * Basically a wrapper around MUI Box
 * with some default styling.
 */
const DetailBox = styled(Box)({
    display: "flex",
    columnGap: "0.1rem",
    flexDirection: "column",
    justifyContent: "flex-start",
});

/**
 * A styled component representing a column layout.
 */
const Col = styled(Box)({
    display: "flex",
    rowGap: "0.5rem",
    columnGap: "0.25rem",
    justifyContent: "flex-start",
    alignItems: "center",
    flexDirection: "row",
});

function ChangeArrow() {
    return (
        <Box sx={{ gridColumn: "change-arrow", display: "inline-block" }}>
            <ArrowRight size={14} className={styles.changed} />
        </Box>
    );
}
