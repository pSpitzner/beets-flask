import { ChevronDownIcon } from "lucide-react";
import { ReactNode, useState } from "react";
import {
    FormControl,
    FormControlLabel,
    FormLabel,
    IconButton,
    Radio,
    RadioGroup,
    styled,
} from "@mui/material";
import Box from "@mui/material/Box";

import { SerializedCandidateState } from "@/pythonTypes";

import { PenaltyIconRow } from "./icons";

import { MatchChip } from "../common/chips";
import { CandidatePreview } from "./candidates/preview";

export function Candidates({ candidates }: { candidates: SerializedCandidateState[] }) {
    const [selected, setSelected] = useState<SerializedCandidateState["id"]>(() => {
        return candidates[0].id;
    });

    return (
        <GridWrapper>
            {candidates.map((candidate) => (
                <CandidateItem
                    key={candidate.id}
                    candidate={candidate}
                    selected={selected == candidate.id}
                    setSelected={setSelected}
                />
            ))}
        </GridWrapper>
    );
}

/* ------------------------------ Grid wrapper ------------------------------ */

const GridWrapper = styled(Box)(({ theme }) => ({
    display: "grid",
    gridTemplateColumns:
        "[selector] auto [name] 1fr [match] auto [penalties] auto [toggle] auto",
    rowGap: theme.spacing(0.5),
    columnGap: theme.spacing(1),
    // Fill columns even if content is given in other order
    gridAutoFlow: "dense",
}));

export function CandidateItem({
    candidate,
    selected,
    setSelected,
}: {
    candidate: SerializedCandidateState;
    selected: boolean;
    setSelected: (id: SerializedCandidateState["id"]) => void;
}) {
    const [expanded, setExpanded] = useState(true);
    return (
        <>
            <Box display="contents">
                <Box gridColumn="selector" display="flex">
                    <Radio
                        checked={selected}
                        onChange={() => setSelected(candidate.id)}
                        value={candidate.id}
                        size="small"
                        sx={{
                            padding: 0,
                        }}
                    />
                </Box>
                <Box gridColumn="match" display="flex">
                    <MatchChip
                        source={candidate.info.data_source!}
                        distance={candidate.distance}
                    />
                </Box>
                <Box gridColumn="name" display="flex">
                    {candidate.info.artist} - {candidate.info.album}
                </Box>
                <Box
                    gridColumn="penalties"
                    display="flex"
                    alignItems="center"
                    height="100%"
                >
                    <PenaltyIconRow candidate={candidate} size={20} />
                </Box>
                <Box gridColumn="toggle" display="flex">
                    <IconButton
                        onClick={() => setExpanded(!expanded)}
                        sx={{
                            padding: 0,
                            "& svg": {
                                // TODO: an small animation would be nice
                                transform: expanded ? "rotate(180deg)" : undefined,
                            },
                        }}
                    >
                        <ChevronDownIcon size={20} />
                    </IconButton>
                </Box>
            </Box>
            <Box
                sx={{
                    maxHeight: expanded ? "100%" : 0,
                    overflow: "hidden",
                    transition: "max-height 0.15s ease-out",
                    // force use all space
                    gridColumn: "1/-1",
                }}
            >
                <CandidatePreview candidate={candidate} />
            </Box>
        </>
    );
}
