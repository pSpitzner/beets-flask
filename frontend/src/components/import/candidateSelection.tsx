import { ChevronDown, ChevronRight, ChevronUp } from "lucide-react";
import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import FormControl from "@mui/material/FormControl";
import FormControlLabel from "@mui/material/FormControlLabel";
import Paper from "@mui/material/Paper";
import Radio from "@mui/material/Radio";
import RadioGroup from "@mui/material/RadioGroup";
import * as HoverCard from "@radix-ui/react-hover-card";
import { ReactNode } from "@tanstack/react-router";

import {
    SimilarityBadge,
    SimilarityBadgeWithText,
} from "@/components/tags/similarityBadge";

import { ButtonBar } from "./buttons";
import { StatusLabel } from "./buttons";
import { CandidatePreview } from "./candidates/preview";
import { useImportContext } from "./context";
import { PenaltyIconRow } from "./icons";
import { CandidateState, SelectionState } from "./types";

import "@/main.css";
import styles from "./import.module.scss";

/** Wrapper for all selection to align them in a grid based on the view size
 * with automatically wrapping or resizing the items.
 */
export function AvailableSelections({ extraButtons }: { extraButtons?: ReactNode[] }) {
    const { selStates } = useImportContext();

    const components: ReactNode[] = [];

    for (const selection of selStates ?? []) {
        const candidate = selection.candidate_states.find(
            (c) => c.id === selection.current_candidate_id
        );

        components.push(
            <SelectionCandidateList
                key={selection.id + "selec"}
                selection={selection}
            />
        );

        if (candidate) {
            components.push(
                <Box>
                    <SectionHeader text={"Selected candidate"} />
                    <Paper key={selection.id + "cand"}>
                        <CandidatePreview
                            candidate={candidate}
                            sx={{
                                paddingInline: "1rem",
                                paddingBottom: "0.75rem",
                                paddingTop: "0.5rem",
                            }}
                        />
                    </Paper>
                </Box>
            );
        }

        components.push(
            <ButtonBar
                key={selection.id + "act"}
                selection={selection}
                extraButtons={extraButtons}
            />
        );
    }

    return (
        <Box
            sx={{
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
            }}
        >
            {components.length > 0 && components}
        </Box>
    );
}

function SelectionCandidateList({ selection }: { selection: SelectionState }) {
    const { chooseCandidate } = useImportContext();
    // for readability, only display 5 candidates by default
    const numCandidatesToShow = 5;
    const [showAll, setShowAll] = useState(false);
    let displayedCandidates = showAll
        ? selection.candidate_states
        : selection.candidate_states.slice(0, numCandidatesToShow);
    // handle the asis dummy candidate. we always want to show that one on top?
    const asisCandidate = selection.candidate_states.find((c) => c.id === "asis");
    if (asisCandidate) {
        displayedCandidates = displayedCandidates.filter((c) => c.id !== "asis");
        displayedCandidates.unshift(asisCandidate);
    }

    function toggleShowAll() {
        setShowAll(!showAll);
    }

    function handleCandidateChange(event: React.ChangeEvent<HTMLInputElement>) {
        const candidateId = event.target.value;
        chooseCandidate(selection.id, candidateId);
    }

    return (
        <Box>
            <SectionHeader text={"Available Candidates"} />
            <Paper
                sx={{ display: "flex", flexDirection: "column", paddingTop: ".25rem" }}
            >
                <FormControl sx={{ width: "100%", marginRight: 0 }}>
                    <RadioGroup
                        value={selection.current_candidate_id}
                        className={styles.choices}
                        onChange={handleCandidateChange}
                        sx={{
                            "& .MuiRadio-root": {
                                padding: "0.35rem",
                                marginLeft: "0.35rem",
                            },
                        }}
                    >
                        {displayedCandidates.map((choice) => {
                            return (
                                <FormControlLabel
                                    sx={{ marginRight: 0 }}
                                    disableTypography={true}
                                    value={choice.id}
                                    key={choice.id}
                                    control={<Radio size="small" />}
                                    label={<CandidateHoverPreview candidate={choice} />}
                                />
                            );
                        })}
                    </RadioGroup>
                </FormControl>
                {selection.candidate_states.length > numCandidatesToShow && (
                    <Button
                        className={styles.expandBtn}
                        variant="text"
                        onClick={toggleShowAll}
                    >
                        {showAll ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </Button>
                )}
            </Paper>
        </Box>
    );
}

function CandidateHoverPreview({ candidate }: { candidate: CandidateState }) {
    // const artistIsSame = candidate.cur_artist === match.info.artist;
    // const albumIsSame = candidate.cur_album === match.info.album;
    const artistIsSame = true;
    const albumIsSame = true;

    return (
        <Box className={styles.candidateHeader} key={candidate.id}>
            <HoverCard.Root openDelay={50} closeDelay={50}>
                <HoverCard.Trigger className={styles.headerGroup}>
                    <Box className={styles.headerGroup}>
                        {candidate.id == "asis" ? (
                            <SimilarityBadgeWithText
                                text={"asis"}
                                color={"custom"}
                                charWidth={4}
                            />
                        ) : (
                            <SimilarityBadge dist={candidate.distance} charWidth={4} />
                        )}
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

function SectionHeader ({ text }: { text: string }) {
    return (
        <StatusLabel
            sx={{
                display: "block",
                marginLeft: "1rem",
                paddingBottom: "0.1rem",
            }}
        text={text} />
    );
}
