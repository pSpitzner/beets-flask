// for now we only display the beets generated text preview.

import {
    ArrowRight,
    AudioLines,
    Check,
    ChevronRight,
    Disc3,
    Link2,
    UserRound,
} from "lucide-react";
import Ansi from "@curvenote/ansi-to-react";
import Box from "@mui/material/Box";

import { useConfig } from "../common/useConfig";
import { CandidateChoice, MinimalItemAndTrackInfo } from "./context";
import { useDiff } from "./diff";

import styles from "./import.module.scss";
import { useEffect } from "react";

export function BeetsDump({ candidate }: { candidate: CandidateChoice }) {
    const content = candidate.diff_preview ?? "No preview available";
    return (
        <div className={styles.beetsDump}>
            <Ansi useClasses>{content}</Ansi>
        </div>
    );
}

export function CandidatePreview({ candidate }: { candidate: CandidateChoice }) {
    const config = useConfig();
    const match = candidate.album_match ?? candidate.track_match;
    const info = match.info;
    const fields = candidate.album_match
        ? config?.match.album_disambig_fields || []
        : config?.match.singleton_disambig_fields || [];

    console.log("info", info);

    const disambigs = fields
        .map((field) => {
            if (
                Object.prototype.hasOwnProperty.call(info, field) &&
                (info as Record<string, unknown>)[field]
            ) {
                return (info as Record<string, unknown>)[field];
            }
            return undefined;
        })
        .filter((x) => x !== undefined);

    return (
        <Box className={styles.candidatePreview}>
            {disambigs && <Box className={styles.disambig}>{disambigs.join(", ")}</Box>}
            {info.data_url ? (
                <Box className={styles.dataUrl}>
                    <Link2 size={14} />
                    <span>{info.data_url}</span>
                </Box>
            ) : null}
            <ArtistChange prev={candidate.cur_artist!} next={info.artist!} />
            <AlbumChange prev={candidate.cur_album!} next={info.album!} />
            <TrackChanges candidate={candidate} />
        </Box>
    );
}

function ArtistChange({ prev, next }: { prev: string; next: string }) {
    const { left, right, didRemove, didAdd } = useDiff(prev, next);
    const didChange = didRemove || didAdd;

    let inner: React.ReactNode;
    if (prev === next) {
        inner = <span>{prev}</span>;
    } else {
        inner = (
            <Box className={styles.inner}>
                {didRemove && <span>{left}</span>}
                {didRemove && <ArrowRight className={styles.changed} size={14} />}
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

function AlbumChange({ prev, next }: { prev: string; next: string }) {
    const { left, right, didRemove, didAdd } = useDiff(prev, next);
    const didChange = didRemove || didAdd;

    let inner: React.ReactNode;
    if (prev === next) {
        inner = <span>{prev}</span>;
    } else {
        inner = (
            <Box className={styles.inner}>
                {didRemove && <span>{left}</span>}
                {didRemove && <ArrowRight className={styles.changed} size={14} />}
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

function TrackChanges({ candidate }: { candidate: CandidateChoice }) {
    if (candidate.track_match) {
        return null;
    }
    const tracks = candidate.album_match.info.tracks as MinimalItemAndTrackInfo[];
    const items = candidate.items!;
    const mapping = candidate.album_match.mapping;

    console.log("tracks", tracks);
    console.log("items", items);
    console.log("mapping", mapping);

    return (
        <Box className={styles.trackChanges}>
            {Object.entries(mapping).map(([idx, tdx]) => {
                return (
                    <TrackDiff
                        key={idx}
                        prev={items[parseInt(idx)]}
                        next={tracks[tdx]}
                        pdx={parseInt(idx)}
                        ndx={tdx}
                    />
                );
            })}
        </Box>
    );
}

function TrackDiff({
    prev,
    next,
    pdx,
    ndx,
}: {
    prev: MinimalItemAndTrackInfo;
    next: MinimalItemAndTrackInfo;
    pdx?: number; // previous index
    ndx?: number; // next index
}) {
    const { left: lTitleD, right: rTitleD } = useDiff(prev.title, next.title);

    const leftTime = prev.length;
    const rightTime = next.length;

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

function TrackLength({ length, className }: { length: number; className?: string }) {
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

function TrackLengthChange({
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

function _fmtLength(l: number) {
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

function TrackIndexChange({
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
    // indices are 0-based
    num += 1;
    return num < 10 ? ` [${num}]` : `[${num}]`;
}
