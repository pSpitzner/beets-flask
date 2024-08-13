// for now we only display the beets generated text preview.

import { ArrowRight, Disc3, Link2, UserRound } from "lucide-react";
import Ansi from "@curvenote/ansi-to-react";
import Box from "@mui/material/Box";

import { useConfig } from "../common/useConfig";
import { CandidateChoice, MinimalItemAndTrackInfo } from "./context";
import { useDiff } from "./diff";

import styles from "./import.module.scss";

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
            <TracksChange candidate={candidate} />
        </Box>
    );
}

function ArtistChange({ prev, next }: { prev: string; next: string }) {
    const { left, right, didRemove } = useDiff(prev, next);

    let artist: React.ReactNode;
    if (prev === next) {
        artist = <span>{prev}</span>;
    } else {
        artist = (
            <Box className={styles.diff}>
                {didRemove && <span>{left}</span>}
                {didRemove && (
                    <ArrowRight className={styles.fieldSeparator} size={14} />
                )}
                {<span>{right}</span>}
            </Box>
        );
    }

    return (
        <Box className={styles.artistChange}>
            <UserRound size={14} />
            {artist}
        </Box>
    );
}

function AlbumChange({ prev, next }: { prev: string; next: string }) {
    const { left, right, didRemove } = useDiff(prev, next);

    let album: React.ReactNode;
    if (prev === next) {
        album = <span>{prev}</span>;
    } else {
        album = (
            <Box className={styles.diff}>
                {didRemove && <span>{left}</span>}
                {didRemove && (
                    <ArrowRight className={styles.fieldSeparator} size={14} />
                )}
                {<span>{right}</span>}
            </Box>
        );
    }

    return (
        <Box className={styles.albumChange}>
            <Disc3 size={14} />
            {album}
        </Box>
    );
}

function TracksChange({ candidate }: { candidate: CandidateChoice }) {
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
        <Box className={styles.tracksChange}>
            {Object.entries(mapping).map(([idx, tdx]) => (
                <Box className={styles.trackChange} key={parseInt(idx)}>
                    <span>{items[parseInt(idx)].title}</span>
                    <ArrowRight className={styles.fieldSeparator} size={14} />
                    <span>{tracks[parseInt(tdx)].title}</span>
                </Box>
            ))}
        </Box>
    );
}
