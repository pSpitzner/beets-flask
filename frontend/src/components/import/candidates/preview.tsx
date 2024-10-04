import Ansi from "@curvenote/ansi-to-react";
import { SxProps, Theme } from "@mui/material";
import Box from "@mui/material/Box";

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
import { CandidateState } from "../types";

export function BeetsDump({ candidate }: { candidate: CandidateState }) {
    const content = candidate.diff_preview ?? "No preview available";
    return (
        <div className={styles.beetsDump}>
            <Ansi useClasses>{content}</Ansi>
        </div>
    );
}

export function CandidatePreview({
    candidate,
    className,
    sx,
}: {
    candidate: CandidateState;
    className?: string;
    sx?: SxProps<Theme>;
}) {
    return (
        <Box
            sx={{ display: "flex", flexDirection: "column", ...sx }}
            className={className}
        >
            <Disambiguation candidate={candidate} />
            <DataUrl candidate={candidate} />
            <ArtistChange prev={candidate.cur_artist} next={candidate.info.artist!} />
            <AlbumChange prev={candidate.cur_album} next={candidate.info.album!} />
            {/* Allow track changes to wrap */}
            <Box
                sx={{
                    display: "flex",
                    flexWrap: "wrap",
                    columnGap: "3rem",
                    rowGap: "0.1rem",
                }}
            >
                <TrackChanges candidate={candidate} />
                <MissingTracks candidate={candidate} />
                <UnmatchedTracks candidate={candidate} />
            </Box>
        </Box>
    );
}
