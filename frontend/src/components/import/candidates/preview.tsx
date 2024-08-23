import Ansi from "@curvenote/ansi-to-react";
import Box from "@mui/material/Box";

import { CandidateState } from "../types";
import {
    AlbumChange,
    ArtistChange,
    DataUrl,
    Disambiguation,
    MissingTracks,
    TrackChanges,
    UnmatchedTracks,
} from "./details";

import styles from "./candidates.module.scss";

export function BeetsDump({ candidate }: { candidate: CandidateState }) {
    const content = candidate.diff_preview ?? "No preview available";
    return (
        <div className={styles.beetsDump}>
            <Ansi useClasses>{content}</Ansi>
        </div>
    );
}

export function CandidatePreview({ candidate }: { candidate: CandidateState }) {
    return (
        <Box className={styles.preview}>
            <Disambiguation candidate={candidate} />
            <DataUrl candidate={candidate} />
            <ArtistChange prev={candidate.cur_artist} next={candidate.info.artist!} />
            <AlbumChange prev={candidate.cur_album} next={candidate.info.album!} />
            {/* Allow track changes to wrap */}
            <div className="flex flex-wrap gap-4 justify-between">
                <TrackChanges candidate={candidate} />
                <MissingTracks candidate={candidate} />
                <UnmatchedTracks candidate={candidate} />
            </div>
        </Box>
    );
}
