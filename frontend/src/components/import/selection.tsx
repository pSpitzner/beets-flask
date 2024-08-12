import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import FormControl from "@mui/material/FormControl";
import FormControlLabel from "@mui/material/FormControlLabel";
import Paper from "@mui/material/Paper";
import Radio from "@mui/material/Radio";
import RadioGroup from "@mui/material/RadioGroup";
import Skeleton from "@mui/material/Skeleton";
import Typography from "@mui/material/Typography";

import { SimilarityBadge } from "@/components/tags/similarityBadge";

import { CandidateChoice, SelectionState, useImportContext } from "./context";

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

    return (
        <div className={styles.wrapper}>
            {/* loading */}
            {!selections && <Skeleton />}
            {selections?.map((selection) => (
                <ImportSelection key={selection.id} selection={selection} />
            ))}
        </div>
    );
}

function ImportSelection({ selection }: { selection: SelectionState }) {
    const { chooseCanidate } = useImportContext();

    function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
        const canidateIdx = parseInt(event.target.value);
        console.log("Selected", selection.id, canidateIdx);
        chooseCanidate(selection.id, canidateIdx);
    }

    return (
        <div className={styles.selection}>
            <span className={styles.folderName}>{selection.id}</span>
            <Paper className={styles.choices}>
                <FormControl>
                    <RadioGroup
                        value={selection.current_candidate_idx}
                        onChange={handleChange}
                    >
                        {selection.candidates.map((choice) => {
                            return (
                                <FormControlLabel
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

    return (
        <Box
            sx={{
                display: "flex",
                gap: "0.5rem",
                alignItems: "center",
            }}
            key={candidate.id}
        >
            <SimilarityBadge dist={match.distance} />
            <Typography variant="body1">
                {match.info.artist} - {match.info.name}
            </Typography>
        </Box>
    );
}
