import { ChevronDownIcon, ChevronsDownUpIcon, ChevronsUpDownIcon } from "lucide-react";
import React, { useMemo, useState } from "react";
import {
    Button,
    ButtonGroup,
    IconButton,
    Radio,
    styled,
    useTheme,
} from "@mui/material";
import Box from "@mui/material/Box";

import { SerializedCandidateState, SerializedTaskState } from "@/pythonTypes";

import { PenaltyIconRow } from "./icons";

import { MatchChip } from "../common/chips";
import { CandidateDiff } from "./candidates/diff";

export function TaskCandidates({ task }: { task: SerializedTaskState }) {
    const [selected, setSelected] = useState<SerializedCandidateState["id"]>(() => {
        return task.candidates[0].id;
    });

    const [showDetails, setShowDetails] = useState<
        Array<SerializedCandidateState["id"]>
    >(() => {
        return task.candidates.map((candidate) => candidate.id);
    });

    const asisCandidate = useMemo(
        () => task.candidates.find((c) => c.info.data_source === "asis"),
        [task.candidates]
    );

    const sortedCandidates = useMemo(() => {
        return task.candidates.sort((a, b) => {
            if (a.info.data_source === "asis") return -1;
            if (b.info.data_source === "asis") return 1;
            return a.distance - b.distance;
        });
    }, [task.candidates]);

    if (!asisCandidate) {
        // this should not happen :)
        return <Box>No asis candidate found</Box>;
    }

    return (
        <>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                <ButtonGroup
                    size="small"
                    sx={{
                        marginLeft: "auto",
                    }}
                    color="secondary"
                >
                    <Button
                        disabled={showDetails.length === task.candidates.length}
                        onClick={() =>
                            setShowDetails(
                                task.candidates.map((candidate) => candidate.id)
                            )
                        }
                        startIcon={<ChevronsUpDownIcon size={20} />}
                    >
                        Expand all
                    </Button>
                    <Button
                        disabled={showDetails.length === 0}
                        onClick={() => setShowDetails([])}
                        startIcon={<ChevronsDownUpIcon size={20} />}
                    >
                        Collapse all
                    </Button>
                </ButtonGroup>

                <GridWrapper>
                    {sortedCandidates.map((candidate) => (
                        <React.Fragment key={candidate.id}>
                            <CandidateInfo
                                key={candidate.id}
                                candidate={candidate}
                                selected={selected == candidate.id}
                                setSelected={setSelected.bind(null, candidate.id)}
                                expanded={showDetails.includes(candidate.id)}
                                toggleExpanded={() => {
                                    setShowDetails((prev) =>
                                        prev.includes(candidate.id)
                                            ? prev.filter((id) => id !== candidate.id)
                                            : [...prev, candidate.id]
                                    );
                                }}
                            />
                            <CandidateDetails
                                candidate={candidate}
                                items={task.items}
                                metadata={task.current_metadata}
                                expanded={showDetails.includes(candidate.id)}
                            />
                        </React.Fragment>
                    ))}
                </GridWrapper>
            </Box>
        </>
    );
}

/* ------------------------------ Grid utils ------------------------------ */
// Align candidates in a grid, each candidate a row

const GridWrapper = styled(Box)(({ theme }) => ({
    display: "grid",
    gridTemplateColumns:
        "[selector] auto [name] 1fr [match] auto [penalties] auto [toggle] auto",
    columnGap: theme.spacing(1),
    // Fill columns even if content is given in other order
    gridAutoFlow: "dense",
}));

const CandidateInfoRow = styled(Box)(({ theme }) => ({
    // Layout
    display: "grid",
    gridColumn: "1 / -1",
    gridTemplateColumns: "subgrid",
    gridAutoFlow: "dense",
    alignItems: "center",

    // Styling
    backgroundColor: theme.palette.background.paper,
    borderRadius: theme.shape.borderRadius,
    padding: theme.spacing(1),

    // Gap between rows
    marginTop: theme.spacing(1),
    ":nth-of-type(1)": {
        marginTop: theme.spacing(0),
    },

    // Border bottom when details are shown
    '&[data-expanded="true"]': {
        borderBottomLeftRadius: 0,
        borderBottomRightRadius: 0,
        borderBottom: `1px solid ${theme.palette.divider}`,
    },
}));

const CandidateDetailsRow = styled(Box)(({ theme }) => ({
    // Layout
    display: "flex",
    gridColumn: "1 / -1",

    // Styling
    backgroundColor: theme.palette.background.paper,
    borderBottomLeftRadius: theme.shape.borderRadius,
    borderBottomRightRadius: theme.shape.borderRadius,
    padding: theme.spacing(1),

    // Hide when not expanded
    "&[data-expanded='false']": {
        display: "none",
    },
}));

export function CandidateInfo({
    candidate,
    selected,
    setSelected,
    expanded,
    toggleExpanded,
}: {
    candidate: SerializedCandidateState;
    selected: boolean;
    setSelected: () => void;
    expanded: boolean;
    toggleExpanded: () => void;
}) {
    const theme = useTheme();
    return (
        <CandidateInfoRow data-expanded={expanded}>
            <Box gridColumn="selector" display="flex">
                <Radio
                    checked={selected}
                    onChange={setSelected}
                    value={candidate.id}
                    size="small"
                    sx={{
                        padding: 0,
                    }}
                />
            </Box>
            <Box gridColumn="match" display="flex" justifyContent="flex-end">
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
                gap={0.25}
            >
                <PenaltyIconRow candidate={candidate} size={theme.iconSize.md} />
            </Box>
            <Box gridColumn="toggle" display="flex">
                <IconButton
                    onClick={toggleExpanded}
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
        </CandidateInfoRow>
    );
}

export function CandidateDetails({
    candidate,
    items,
    metadata,
    expanded,
}: {
    candidate: SerializedCandidateState;
    items: SerializedTaskState["items"];
    metadata: SerializedTaskState["current_metadata"];
    expanded: boolean;
}) {
    return (
        <CandidateDetailsRow data-expanded={expanded}>
            <CandidateDiff candidate={candidate} items={items} metadata={metadata} />
        </CandidateDetailsRow>
    );
}
