import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import FormControl from "@mui/material/FormControl";
import FormControlLabel from "@mui/material/FormControlLabel";
import Paper from "@mui/material/Paper";
import Radio from "@mui/material/Radio";
import RadioGroup from "@mui/material/RadioGroup";
import Skeleton from "@mui/material/Skeleton";
import Typography from "@mui/material/Typography";

import { SimilarityBadgeWithHover } from "@/components/tags/similarityBadge";

import { CandidatePreview } from "./candidatePreview";
import { CandidateChoice, SelectionState, useImportContext } from "./context";
import { PenaltyIcon, penaltyOrder, SourceIcon } from "./icons";
import { useDiff } from "./diff";

import { Disc3, UserRound } from "lucide-react";
import { useEffect, useState } from "react";

import styles from "./import.module.scss";

export function ImportView() {
    const { completeAllSelections, startSession, status } = useImportContext();

    return (
        <div>
            <Selections />
            <Box
                sx={{
                    display: "flex",
                    gap: "1rem",
                    justifyContent: "flex-start",
                    alignItems: "center",
                }}
            >
                <Button
                    variant="outlined"
                    color="primary"
                    onClick={() => {
                        startSession("/music/inbox.nosync/Bad Company UK/");
                    }}
                >
                    Re-Start Session
                </Button>
                <Button
                    variant="outlined"
                    color="primary"
                    onClick={completeAllSelections}
                >
                    Apply
                </Button>
                <Button variant="outlined" color="warning">
                    Abort
                </Button>
                <Typography>Status: {status}</Typography>
            </Box>
        </div>
    );
}

/** Wrapper for all selection to align them in a grid based on the view size
 * with automatically wrapping or resizing the items.
 */
function Selections() {
    const { selections } = useImportContext();
    const { left, right } = useDiff("test", "tesd2");

    return (
        <div className={styles.wrapper}>
            {/* loading */}
            {!selections && <Skeleton />}
            {selections?.map((selection) => (
                <ImportSelection key={selection.id} selection={selection} />
            ))}
            <Box className={styles.diff}>
                <Typography>
                    {left}
                    {" -> "}
                    {right}
                </Typography>
            </Box>
        </div>
    );
}

function ImportSelection({ selection }: { selection: SelectionState }) {
    const { chooseCanidate } = useImportContext();
    const folder = selection.paths.join("\n");

    function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
        const canidateIdx = parseInt(event.target.value);
        console.log("Selected", selection.id, canidateIdx);
        chooseCanidate(selection.id, canidateIdx);
    }

    return (
        <div className={styles.selection}>
            <span className={styles.folderName}>{folder}</span>
            <Paper className={styles.choices}>
                <FormControl sx={{ width: "100%", marginRight: 0 }}>
                    <RadioGroup
                        value={selection.current_candidate_idx}
                        onChange={handleChange}
                    >
                        {selection.candidates.map((choice) => {
                            return (
                                <FormControlLabel
                                    disableTypography={true}
                                    value={choice.id}
                                    key={choice.id}
                                    control={<Radio size="small" />}
                                    label={<CandidateView candidate={choice} />}
                                />
                            );
                        })}
                    </RadioGroup>
                </FormControl>
            </Paper>
        </div>
    );
}

function CandidateView({ candidate }: { candidate: CandidateChoice }) {
    const match = candidate.track_match ?? candidate.album_match;
    const source = match.info.data_source as string;
    const artist_is_same = candidate.cur_artist === match.info.artist;
    const album_is_same = candidate.cur_album === match.info.album;

    const artistClass = `${styles.headerGroup} ${artist_is_same ? "" : styles.changed}`;
    const albumClass = `${styles.headerGroup} ${album_is_same ? "" : styles.changed}`;

    useEffect(() => {
        console.log("CandidateView", candidate);
        console.log("artist_is_same", artist_is_same);
        console.log("album_is_same", album_is_same);
    }, [candidate]);

    return (
        <Box className={styles.candidateHeader} key={candidate.id}>
            <Box className={styles.headerGroup}>
                <Box className={styles.sourceIcon}>
                    <SourceIcon source={source} />
                </Box>
                <SimilarityBadgeWithHover dist={match.distance}>
                    <CandidatePreview candidate={candidate} />
                </SimilarityBadgeWithHover>
            </Box>
            <Box className={artistClass}>
                <Box className={styles.sourceIcon}>
                    <UserRound />
                </Box>
                {match.info.artist}
            </Box>
            <Box className={albumClass}>
                <Box className={styles.sourceIcon}>
                    <Disc3 />
                </Box>
                {match.info.album}
            </Box>

            <PenaltyIconRow penalties={candidate.penalties ?? []} />
        </Box>
    );
}

function PenaltyIconRow({ penalties }: { penalties: string[] }) {
    const [others, setOthers] = useState<string[]>([]);

    useEffect(() => {
        const otherPenalties = penalties.filter((p) => !penaltyOrder.includes(p));
        setOthers(otherPenalties);
    }, [penalties]);

    return (
        <Box className={styles.penaltyIconRow}>
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
