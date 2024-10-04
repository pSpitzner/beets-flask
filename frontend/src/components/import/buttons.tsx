import { CheckIcon, CopyMinus, CopyPlus, Merge, Trash2, X } from "lucide-react";
import { ReactNode, useEffect, useRef, useState } from "react";
import {
    Button,
    styled,
    SxProps,
    Theme,
    ToggleButton,
    ToggleButtonGroup,
    ToggleButtonGroupProps,
    Tooltip,
    Typography,
} from "@mui/material";
import Box from "@mui/material/Box";
import FormControl from "@mui/material/FormControl";

import { CandidateSearch } from "./candidates/search";
import { useImportContext } from "./context";
import { SelectionState } from "./types";

import styles from "./import.module.scss";
import { useConfig } from "../common/hooks/useConfig";
import { PageWrapper } from "../common/page";

export function ButtonBar({
    selection,
    extraButtons,
}: {
    selection: SelectionState;
    extraButtons?: ReactNode[];
}) {
    const { selectionsInvalidCause, currentCandidates } = useImportContext();
    const [statusText, setStatusText] = useState<string | null>(null);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (selectionsInvalidCause === null) {
            // Get the lowest distance candidate
            let distance = 0;
            let includesAsis = false;
            if (currentCandidates && currentCandidates.length > 0) {
                currentCandidates.forEach((candidate) => {
                    if (candidate && candidate.distance > distance) {
                        distance = candidate.distance;
                    }
                    if (candidate && candidate.id === "asis") {
                        includesAsis = true;
                    }
                });
            }

            // Special case asis
            if (includesAsis) {
                setStatusText("Fear of the unknown?");
                return;
            }

            const match = 1 - distance;
            if (match > 0.95) {
                setStatusText("This is a perfect match!");
            } else if (match > 0.9) {
                setStatusText("Great choice!");
            } else if (match > 0.8) {
                setStatusText("Not bad, this could work.");
            } else if (match > 0.7) {
                setStatusText("It's fine, I guess...");
            } else if (match > 0.6) {
                setStatusText("Sure, if you're okay with 'average'.");
            } else if (match > 0.5) {
                setStatusText("I mean, you could do better, but okay.");
            } else if (match > 0.3) {
                setStatusText("Really? This is what you're going with?");
            } else if (match > 0.2) {
                setStatusText("I don't even know why you're considering this.");
            } else if (match > 0.1) {
                setStatusText("You might want to rethink your choices.");
            } else {
                setStatusText("This... is a disaster.");
            }
        } else if (selectionsInvalidCause === "no current candidate") {
            setStatusText("Pick a candidate!");
        } else if (selectionsInvalidCause === "no duplicate action") {
            setStatusText("⤺ Choose what to do with duplicates!");
        } else {
            setStatusText(selectionsInvalidCause);
        }
    }, [selectionsInvalidCause, currentCandidates]);

    useEffect(() => {
        if (!ref.current) return;

        // Callback for when the sticky element intersects
        const observerCallback: IntersectionObserverCallback = (entries) => {
            entries.forEach((entry) => {
                entry.target.classList.toggle("DefaultBlurBg", !entry.isIntersecting);
                //Add topdivider style
                entry.target.classList.toggle(styles.sticky, !entry.isIntersecting);
            });
        };

        const intersectionObserver = new IntersectionObserver(observerCallback, {
            threshold: [1],
            root: null,
        });

        intersectionObserver.observe(ref.current);

        return () => {
            intersectionObserver.disconnect();
        };
    }, [ref]);

    return (
        <>
            <Box
                ref={ref}
                className={styles.buttonBar}
                sx={{
                    position: "sticky",
                    width: "100%",
                    height: "max-content",
                    // -1px needed for intersection observer to trigger at 1 ratio
                    bottom: "-1px",
                }}
            >
                <PageWrapper
                    sx={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "flex-end",
                        justifyContent: "flex-end",
                        gap: "0.2rem",
                    }}
                >
                    <StatusLabel
                        text={statusText ? statusText : ""}
                        sx={{ width: "100%", textAlign: "right" }}
                        color="textSecondary"
                    />
                    <Box
                        sx={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: "1rem",
                            width: "100%",
                            flexWrap: "wrap",
                            flexDirection: { xs: "column", sm: "row" },
                        }}
                    >
                        <Box sx={{ order: { xs: 2, sm: 1 } }}>
                            <CandidateSearch selection={selection} />
                        </Box>
                        <Box
                            sx={{
                                order: { xs: 1, sm: 2 },
                                display: "flex",
                                flexDirection: "row",
                                gap: "1rem",
                                justifyContent: "flex-end",
                            }}
                        >
                            <DuplicateActions selection={selection} />
                            {extraButtons}
                        </Box>
                    </Box>
                </PageWrapper>
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

export function DuplicateActions({
    selection,
    ...props
}: { selection: SelectionState } & ToggleButtonGroupProps) {
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
                {...props}
            >
                {_toggleButtonWithTooltip(!enableDuplicateButton, "skip")}
                {_toggleButtonWithTooltip(!enableDuplicateButton, "merge")}
                {_toggleButtonWithTooltip(!enableDuplicateButton, "keep")}
                {_toggleButtonWithTooltip(!enableDuplicateButton, "remove")}
            </DuplicateActionButtonGroup>
        </FormControl>
    );
}

export function ApplyAbort() {
    const { completeAllSelections, selectionsInvalidCause, abortSession } =
        useImportContext();

    return (
        // Wrap into a Box to enable Tooltips on disabled buttons
        <>
            <Box
                sx={{
                    display: "flex",
                    gap: "0.5rem",
                    justifyContent: "flex-end",
                    height: "36px",
                }}
            >
                <Button
                    variant="outlined"
                    color="warning"
                    startIcon={<X size={14} />}
                    onClick={() => {
                        abortSession().catch(console.error);
                    }}
                >
                    Abort
                </Button>
                <Button
                    variant="outlined"
                    color="primary"
                    onClick={completeAllSelections}
                    disabled={selectionsInvalidCause !== null}
                    startIcon={<CheckIcon size={14} />}
                >
                    Apply
                </Button>
            </Box>
        </>
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
