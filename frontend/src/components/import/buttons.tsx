import { CopyMinus, CopyPlus, Merge, Trash2 } from "lucide-react";
import { ReactNode, useEffect, useState } from "react";
import {
    styled,
    SxProps,
    Theme,
    ToggleButton,
    ToggleButtonGroup,
    Tooltip,
    Typography,
} from "@mui/material";
import Box from "@mui/material/Box";
import FormControl from "@mui/material/FormControl";

import { useConfig } from "../common/hooks/useConfig";
import { CandidateSearch } from "./candidates/search";
import { useImportContext } from "./context";
import { SelectionState } from "./types";

import "@/main.css";

export function ButtonBar({
    selection,
    extraButtons,
}: {
    selection: SelectionState;
    extraButtons?: ReactNode[];
}) {
    const { selectionsInvalidCause } = useImportContext();
    const [statusText, setStatusText] = useState<string | null>(null);

    useEffect(() => {
        if (selectionsInvalidCause === null) {
            setStatusText("Great choice!");
        } else if (selectionsInvalidCause === "no current candidate") {
            setStatusText("Pick a candidate!");
        } else if (selectionsInvalidCause === "no duplicate action") {
            setStatusText("⤺ Choose what to do with duplicates!");
        } else {
            setStatusText(selectionsInvalidCause);
        }
    }, [selectionsInvalidCause]);

    return (
        <>
            {/* for now we hardcode the blur bar until we moved the terminal */}
            <Box
                sx={{
                    position: "fixed",
                    height: "120px",
                    bottom: 0,
                    left: 0,
                    right: 0,
                    borderTop: "1px solid",
                    borderColor: "divider",
                }}
                className={"DefaultBlurBg"}
            />
            <Box
                sx={{
                    display: "flex",
                    flexDirection: "row",
                    alignItems: "flex-end",
                    justifyContent: "flex-end",
                    gap: "1rem",
                    position: "sticky",
                    // terminal bar is some 40px
                    height: "75px",
                    bottom: 0,
                    paddingTop: "0.5rem",
                    paddingBottom: "0.5rem",
                    flexWrap: "wrap",
                }}
            >
                <StatusLabel
                    text={statusText ? statusText : ""}
                    sx={{ position: "absolute", right: "0.2rem", top: "0.5rem" }}
                    color="textSecondary"
                />
                <CandidateSearch selection={selection} />
                <Box sx={{ flexGrow: 1 }} />
                <DuplicateActions selection={selection} />
                {extraButtons}
            </Box>
        </>
    );
}

// override default styling so that the selected button in the buttongroup
// does not look highlighted when the whole group is disabled.
const DuplicateActionButtonGroup = styled(ToggleButtonGroup)(({ theme }) => ({
    "& .MuiToggleButtonGroup-grouped": {
        "&.Mui-selected": {
            backgroundColor: theme.palette.action.selected,
            "&:hover": {
                backgroundColor: theme.palette.action.selected,
            },
        },
        "&.Mui-disabled": {
            "&.Mui-selected": {
                backgroundColor: "inherit",
                color: theme.palette.text.disabled,
                "&:hover": {
                    backgroundColor: "inherit",
                },
            },
        },
    },
}));

export function DuplicateActions({ selection }: { selection: SelectionState }) {
    const config = useConfig();
    const { chooseCandidate } = useImportContext();

    const [enableDuplicateButton, setEnableDuplicateButton] = useState(false);
    const [duplicateAction, setDuplicateAction] = useState(
        config.import.duplicate_action
    );

    function handleDuplicateActionChange(event: React.MouseEvent<HTMLElement>) {
        const value = event.currentTarget.getAttribute("value");
        setDuplicateAction(value!);
        selection.duplicate_action = value as "skip" | "merge" | "keep" | "remove";
        // duplicate action and candidate choice are reported to backend through the
        // same event. TODO: this should be more consistent.
        if (selection.current_candidate_id !== null) {
            chooseCandidate(selection.id, selection.current_candidate_id);
        }
        console.log("duplicate action", value);
    }

    useEffect(() => {
        if (selection.current_candidate_id == null) return;
        const candidate = selection.candidate_states.find(
            (c) => c.id === selection.current_candidate_id
        );
        if (candidate) {
            setEnableDuplicateButton(candidate.duplicate_in_library);
        }
    }, [selection, selection.current_candidate_id, setEnableDuplicateButton]);

    function _toggleButtonWithTooltip(disabled: boolean, action: string) {
        let Icon = CopyMinus;
        let title = "";
        switch (action) {
            case "skip":
                Icon = CopyMinus;
                title = "Skip new (don't import)";
                break;
            case "merge":
                Icon = Merge;
                title = "Merge new and old into one album";
                break;
            case "keep":
                Icon = CopyPlus;
                title = "Keep both, old and new";
                break;
            case "remove":
                Icon = Trash2;
                title = "Remove old items";
                break;
            default:
                break;
        }

        if (disabled) {
            return (
                // mui complains about tooltips on disabled buttons
                <ToggleButton
                    sx={{ height: "36px" }}
                    value={action}
                    aria-label={action}
                >
                    <Icon size={14} />
                </ToggleButton>
            );
        } else {
            return (
                <Tooltip title={title} placement="top">
                    <ToggleButton
                        sx={{ height: "36px" }}
                        value={action}
                        aria-label={action}
                    >
                        <Icon size={14} />
                    </ToggleButton>
                </Tooltip>
            );
        }
    }

    if (!enableDuplicateButton) {
        return null;
        // instead of not rendering, we could also set opacity of the formcontrol
        // to zero and will keep the whitespace allocated.
        // sxToHide = {
        //     opacity: "0",
        // };
    }
    return (
        <FormControl>
            {/* not need if we place this left of abort with our status field. */}
            {/* <FormHelperText
                sx={{
                    marginInline: "auto",
                    marginBottom: "0.2rem",
                }}
            >
                {"Duplicate action"}
            </FormHelperText> */}
            <DuplicateActionButtonGroup
                value={duplicateAction}
                exclusive
                onChange={handleDuplicateActionChange}
                aria-label="duplicate action"
                // size="small"
                disabled={!enableDuplicateButton}
            >
                {_toggleButtonWithTooltip(!enableDuplicateButton, "skip")}
                {_toggleButtonWithTooltip(!enableDuplicateButton, "merge")}
                {_toggleButtonWithTooltip(!enableDuplicateButton, "keep")}
                {_toggleButtonWithTooltip(!enableDuplicateButton, "remove")}
            </DuplicateActionButtonGroup>
        </FormControl>
    );
}

export function StatusLabel({
    text,
    sx,
    color = "textDisabled",
    // textSecondary is also a MUI standard.
}: {
    text: string;
    sx?: SxProps<Theme>;
    color?: string;
}) {
    return (
        <Typography sx={sx} variant="caption" color={color}>
            {text}
        </Typography>
    );
}
