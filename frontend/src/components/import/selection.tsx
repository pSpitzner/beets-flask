import { ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { Input } from "@mui/material";
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
import { CandidateState, SelectionState, useImportContext } from "./context";
import { PenaltyIconRow } from "./icons";

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
                            // startSession("/music/inbox.nosync/Bad Company UK/");
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
    return <>Fix ME!</>;
    const match = candidate.track_match ?? candidate.album_match;
    // const artistIsSame = candidate.cur_artist === match.info.artist;
    // const albumIsSame = candidate.cur_album === match.info.album;
    const artistIsSame = true;
    const albumIsSame = true;

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
                        <Box data-changed={!artistIsSame}>{match.info.artist}</Box>
                        <ChevronRight className={styles.fade} size={14} />
                        <Box data-changed={!albumIsSame}>{match.info.album}</Box>
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
