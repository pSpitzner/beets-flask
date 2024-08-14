import { ChevronRight } from "lucide-react";
import { useEffect } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import FormControl from "@mui/material/FormControl";
import FormControlLabel from "@mui/material/FormControlLabel";
import Paper from "@mui/material/Paper";
import Radio from "@mui/material/Radio";
import RadioGroup from "@mui/material/RadioGroup";
import Typography from "@mui/material/Typography";
import * as HoverCard from "@radix-ui/react-hover-card";

import { SimilarityBadgeWithHover } from "@/components/tags/similarityBadge";

import { BeetsDump, CandidatePreview } from "./candidatePreview";
import { CandidateChoice, SelectionState, useImportContext } from "./context";
import { PenaltyIconRow } from "./icons";

import "@/main.css";
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
                        // startSession("/music/inbox.nosync/Bad Company UK/");
                        startSession(
                            "/music/inbox.nosync/John B/Light Speed [ALBUM]/CD1"
                        );
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

    return (
        <div className={styles.wrapper}>
            {/* loading */}
            {/* {!selections && <Skeleton />} */}
            {selections?.map((selection) => (
                <ImportSelection key={selection.id} selection={selection} />
            ))}
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
                                    sx={{ marginRight: 0 }}
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
    const artist_is_same = candidate.cur_artist === match.info.artist;
    const album_is_same = candidate.cur_album === match.info.album;

    useEffect(() => {
        console.log("CandidateView", candidate);
        console.log("artist_is_same", artist_is_same);
        console.log("album_is_same", album_is_same);
    }, [candidate, artist_is_same, album_is_same]);

    return (
        <Box className={styles.candidateHeader} key={candidate.id}>
            <Box className={styles.headerGroup}>
                <SimilarityBadgeWithHover dist={match.distance}>
                    <BeetsDump candidate={candidate} />
                </SimilarityBadgeWithHover>
            </Box>
            <HoverCard.Root openDelay={50} closeDelay={50}>
                <HoverCard.Trigger>
                    <Box className={styles.headerGroup}>
                        <Box className={artist_is_same ? "" : styles.changed}>
                            {match.info.artist}
                        </Box>
                        <ChevronRight className={styles.fade} size={14} />
                        <Box className={album_is_same ? "" : styles.changed}>
                            {match.info.album}
                        </Box>
                    </Box>
                </HoverCard.Trigger>
                <HoverCard.Content
                    side="bottom"
                    sideOffset={0}
                    alignOffset={0}
                    align="start"
                    className={"HoverContent"}
                >
                    {<CandidatePreview candidate={candidate} />}
                </HoverCard.Content>
            </HoverCard.Root>

            <PenaltyIconRow candidate={candidate} />
        </Box>
    );
}
