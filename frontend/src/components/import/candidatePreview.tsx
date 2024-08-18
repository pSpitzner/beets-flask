import Ansi from "@curvenote/ansi-to-react";
import Box from "@mui/material/Box";

import {
    AlbumChange,
    ArtistChange,
    DataUrl,
    Disambiguation,
    MissingTracks,
    TrackChanges,
    UnmatchedTracks,
} from "./candidateDetails";
import { CandidateState } from "./context";

import styles from "./import.module.scss";

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
        <Box className={styles.candidatePreview}>
            <Disambiguation candidate={candidate} />
            <DataUrl candidate={candidate} />
            <ArtistChange prev={candidate.cur_artist} next={candidate.info.artist!} />
            <AlbumChange prev={candidate.cur_album} next={candidate.info.album!} />
            <TrackChanges candidate={candidate} />
            <MissingTracks candidate={candidate} />
            <UnmatchedTracks candidate={candidate} />
        </Box>
    );
}
