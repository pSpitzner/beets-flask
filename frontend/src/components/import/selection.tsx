import { ChevronRight } from "lucide-react";
import { Fragment, useEffect, useState } from "react";
import { Container, Input } from "@mui/material";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import FormControl from "@mui/material/FormControl";
import FormControlLabel from "@mui/material/FormControlLabel";
import Paper from "@mui/material/Paper";
import Radio from "@mui/material/Radio";
import RadioGroup from "@mui/material/RadioGroup";
import Typography from "@mui/material/Typography";
import * as HoverCard from "@radix-ui/react-hover-card";
import { useTheme } from "@mui/material/styles";

import {
    SimilarityBadge,
    SimilarityBadgeWithHover,
} from "@/components/tags/similarityBadge";

import { BeetsDump, CandidatePreview } from "./candidates/preview";
import { useImportContext } from "./context";
import { PenaltyIconRow } from "./icons";
import { CandidateState, SelectionState } from "./types";

import "@/main.css";
import styles from "./import.module.scss";

export function ImportView() {
    const { completeAllSelections, startSession, status } = useImportContext();

    const [path, setPath] = useState<string>("");

    return (
        <div>
            <Selections />

            <Box
                sx={{
                    display: "flex",
                    gap: "1rem",
                    justifyContent: "flex-start",
                    alignItems: "flex-start",
                    flexDirection: "column",
                }}
            >
                <div className="flex gap-2">
                    <Input
                        type="text"
                        placeholder="Enter path to start session"
                        className="w-96"
                        value={path}
                        onChange={(e) => setPath(e.target.value)}
                    ></Input>
                    <Button
                        variant="outlined"
                        color="primary"
                        onClick={() => {
                            startSession(path);
                        }}
                    >
                        (Re-)Start Session
                    </Button>
                </div>
                <div className="flex gap-2">
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
                </div>
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
            {selections?.map((selection) => {
                // For debugging the hover state get current selected candidate
                const canditate = selection.candidate_states.find(
                    (c) => c.id === selection.current_candidate_idx
                );

                return (
                    <Fragment key={selection.id}>
                        <ImportSelection selection={selection} />
                        {canditate && (
                            <Paper className="p-3">
                                <CandidatePreview candidate={canditate} />
                            </Paper>
                        )}
                    </Fragment>
                );
            })}
        </div>
    );
}

function ImportSelection({ selection }: { selection: SelectionState }) {
    const { chooseCandidate } = useImportContext();
    const folder = selection.paths.join("\n");

    function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
        const candidateIdx = parseInt(event.target.value);
        chooseCandidate(selection.id, candidateIdx);
    }

    useEffect(() => {
        // set the default choice, but only once the user has seen something.
        // first candidate is the best match
        if (
            selection.current_candidate_idx === null ||
            selection.current_candidate_idx === undefined
        ) {
            selection.current_candidate_idx =
                selection.candidate_states.length > 0 ? 0 : null;
        }
        if (selection.current_candidate_idx !== null) {
            chooseCandidate(selection.id, selection.current_candidate_idx);
        }
    }, [selection, chooseCandidate]);

    return (
        <div className={styles.selection}>
            <span className={styles.folderName}>{folder}</span>
            <Paper className={styles.choices}>
                <FormControl sx={{ width: "100%", marginRight: 0 }}>
                    <RadioGroup
                        value={selection.current_candidate_idx}
                        onChange={handleChange}
                    >
                        {selection.candidate_states.map((choice) => {
                            return (
                                <FormControlLabel
                                    sx={{ marginRight: 0 }}
                                    disableTypography={true}
                                    value={choice.id}
                                    key={choice.id}
                                    control={<Radio size="small" />}
                                    label={<CandidateView candidate={choice} />}
                                />
                                // division line
                                // <Box sx={{ marginTop: "1rem", marginBottom: "1rem" }}>
                                //     <hr />
                                //     <CandidatePreview
                                //         candidate={choice}
                                //         key={choice.id}
                                //     />
                                // </Box>
                            );
                        })}
                    </RadioGroup>
                </FormControl>
            </Paper>
        </div>
    );
}

function CandidateView({ candidate }: { candidate: CandidateState }) {
    // const artistIsSame = candidate.cur_artist === match.info.artist;
    // const albumIsSame = candidate.cur_album === match.info.album;
    const artistIsSame = true;
    const albumIsSame = true;

    return (
        <Box className={styles.candidateHeader} key={candidate.id}>
            <HoverCard.Root openDelay={50} closeDelay={50}>
                <HoverCard.Trigger className={styles.headerGroup}>
                    <Box className={styles.headerGroup}>
                        <SimilarityBadge dist={candidate.distance} />
                    </Box>
                    <Box className={styles.headerGroup}>
                        <Box data-changed={!artistIsSame}>{candidate.info.artist}</Box>
                        <ChevronRight className={styles.fade} size={14} />
                        <Box data-changed={!albumIsSame}>{candidate.info.album}</Box>
                    </Box>
                </HoverCard.Trigger>
                <HoverCard.Content
                    side="bottom"
                    sideOffset={5}
                    alignOffset={-40}
                    align="start"
                    className={`HoverContent ${styles.hoverContent}`}
                >
                    <CandidatePreview candidate={candidate} />
                </HoverCard.Content>
            </HoverCard.Root>

            <PenaltyIconRow candidate={candidate} />
        </Box>
    );
}
