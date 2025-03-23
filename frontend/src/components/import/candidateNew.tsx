import { ChevronDownIcon } from "lucide-react";
import { ReactNode, useState } from "react";
import { IconButton } from "@mui/material";
import Box from "@mui/material/Box";

import { SerializedCandidateState } from "@/pythonTypes";

import { PenaltyIconRow } from "./icons";

import { MatchChip } from "../common/chips";

export function CandidateList({ children }: { children: ReactNode }) {
    return (
        <Box
            sx={{
                display: "grid",
                gridTemplateColumns: "[match] auto [name] 1fr [penalties] auto [toggle] auto",
                rowGap: 0.5,
                columnGap: 1,
            }}
        >
            {children}
        </Box>
    );
}

export function CandidateItem({ candidate }: { candidate: SerializedCandidateState }) {
    const [expanded, setExpanded] = useState(false);
    return (
        <>
            <Box display="contents">
                <Box gridColumn="match" display="flex">
                    <MatchChip source={candidate.info.data_source!} distance={candidate.distance} />
                </Box>
                <Box gridColumn="name" display="flex">
                    {candidate.info.artist} - {candidate.info.album}
                </Box>
                <Box gridColumn="penalties" display="flex" alignItems="center" height="100%">
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
                gridColumn="1/-1"
                sx={{
                    maxHeight: expanded ? "100%" : 0,
                    overflow: "hidden",
                    transition: "max-height 0.15s ease-out",
                }}
            >
                Test
            </Box>
        </>
    );
}
