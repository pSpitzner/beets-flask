import { ChevronRight, CopyMinus, CopyPlus, Merge, Plus, Trash2 } from "lucide-react";
import { forwardRef, Fragment, useEffect, useState } from "react";
import {
    CircularProgress,
    Container,
    DialogProps,
    FormHelperText,
    IconButton,
    Modal,
    styled,
    TextField,
    ToggleButton,
    ToggleButtonGroup,
    Tooltip,
} from "@mui/material";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import FormControl from "@mui/material/FormControl";
import FormControlLabel from "@mui/material/FormControlLabel";
import Paper from "@mui/material/Paper";
import Radio from "@mui/material/Radio";
import RadioGroup from "@mui/material/RadioGroup";
import Typography from "@mui/material/Typography";
import * as HoverCard from "@radix-ui/react-hover-card";

import {
    SimilarityBadge,
    SimilarityBadgeWithText,
} from "@/components/tags/similarityBadge";

import { useConfig } from "../common/useConfig";
import { CandidatePreview } from "./candidates/preview";
import { useImportContext } from "./context";
import { PenaltyIconRow } from "./icons";
import { CandidateState, SelectionState } from "./types";

import "@/main.css";
import styles from "./import.module.scss";

/** Wrapper for all selection to align them in a grid based on the view size
 * with automatically wrapping or resizing the items.
 */
export function Selections() {
    const { selStates } = useImportContext();

    return (
        <div className={styles.wrapper}>
            {/* loading */}
            {/* {!selections && <Skeleton />} */}
            {selStates?.map((selection) => {
                // For debugging the hover state get current selected candidate
                const candidate = selection.candidate_states.find(
                    (c) => c.id === selection.current_candidate_id
                );

                return (
                    <Fragment key={selection.id}>
                        <ImportSelection selection={selection} />
                        {candidate && (
                            <Paper className="p-3">
                                <CandidatePreview candidate={candidate} />
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

    useEffect(() => {
        // set the default choice, but only once the user has seen something.
        // first candidate is the best match, and we only
        // move the asis candidate above on the display, so index 0 remains the right default
        if (
            selection.current_candidate_id === null ||
            selection.current_candidate_id === undefined
        ) {
            if (selection.candidate_states.length > 0) {
                selection.current_candidate_id = selection.candidate_states[0].id;
            } else {
                selection.current_candidate_id = null;
            }
        }
        if (selection.current_candidate_id !== null) {
            chooseCandidate(selection.id, selection.current_candidate_id);
        }
    }, [selection, chooseCandidate]);

    return (
        <div className={styles.selection}>
            <span className={styles.folderName}>{folder}</span>
            <Paper className={styles.choices}>
                <FormControl sx={{ width: "100%", marginRight: 0 }}>
                    <RadioGroup
                        value={selection.current_candidate_id}
                        onChange={handleCandidateChange}
                    >
                        {displayedCandidates.map((choice) => {
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
            <Box
                sx={{
                    marginTop: "0.5rem",
                    display: "flex",
                    alignItems: "center",
                    flexDirection: "row",
                    gap: "1rem",
                }}
            >
                {selection.candidate_states.length > numCandidatesToShow && (
                    <Button variant="outlined" onClick={toggleShowAll}>
                        {showAll ? "Show Less" : "Show All"}
                    </Button>
                )}
                <DuplicateActions selection={selection} />
                <AddCandidatesModal selection={selection} />
            </Box>
        </div>
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

function DuplicateActions({ selection }: { selection: SelectionState }) {
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
                <ToggleButton value={action} aria-label={action}>
                    <Icon size={14} />
                </ToggleButton>
            );
        } else {
            return (
                <Tooltip title={title}>
                    <ToggleButton value={action} aria-label={action}>
                        <Icon size={14} />
                    </ToggleButton>
                </Tooltip>
            );
        }
    }

    return (
        <Box sx={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Typography
                id="duplicate-action-label"
                className={enableDuplicateButton ? "" : styles.fade}
            >
                Duplicate Action:
            </Typography>
            <DuplicateActionButtonGroup
                value={duplicateAction}
                exclusive
                onChange={handleDuplicateActionChange}
                aria-label="text alignment"
                // size="small"
                disabled={!enableDuplicateButton}
            >
                {_toggleButtonWithTooltip(!enableDuplicateButton, "skip")}
                {_toggleButtonWithTooltip(!enableDuplicateButton, "merge")}
                {_toggleButtonWithTooltip(!enableDuplicateButton, "keep")}
                {_toggleButtonWithTooltip(!enableDuplicateButton, "remove")}
            </DuplicateActionButtonGroup>
        </Box>
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
                        {candidate.id == "asis" ? (
                            <SimilarityBadgeWithText text={"asis"} color={"custom"} />
                        ) : (
                            <SimilarityBadge dist={candidate.distance} />
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

function AddCandidatesModal({ selection }: { selection: SelectionState }) {
    const { searchForCandidates } = useImportContext();

    const [open, setOpen] = useState(false);
    const handleOpen = () => setOpen(true);
    const handleClose: DialogProps["onClose"] = (_event, reason) => {
        if (reason && reason === "backdropClick") return;
        setOpen(false);
    };
    const [id, setId] = useState<string>(""); // ids can be multiple, separated by whitespaces
    const [artist, setArtist] = useState<string>("");
    const [album, setAlbum] = useState<string>("");
    const [error, setError] = useState("");
    const [searching, setSearching] = useState(false);

    const handleApply = () => {
        // parse empty strings
        setSearching(true);
        searchForCandidates(
            selection.id,
            id ? id : null,
            artist ? artist : null,
            album ? album : null
        )
            .then(() => {
                setSearching(false);
                setOpen(false);
            })
            .catch((message) => {
                setSearching(false);
                setError(message as string);
            });
    };

    const isApplyEnabled = () => {
        return id.length > 0 || (artist.length > 0 && album.length > 0);
    };

    const validateArtistAlbum = () => {
        if ((artist && !album) || (!artist && album)) {
            setError("Provide an album with artist!");
        } else {
            setError("");
        }
    };

    return (
        <>
            <Tooltip title="Search for more candidates">
                <IconButton onClick={handleOpen}>
                    <Plus size={14} />
                </IconButton>
            </Tooltip>
            <Modal
                aria-labelledby="unstyled-modal-title"
                aria-describedby="unstyled-modal-description"
                open={open}
                onClose={handleClose}
                slots={{ backdrop: Backdrop }}
            >
                {/* we mainly use the container to get nice auto-width */}
                <Container
                    maxWidth="sm"
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        pointerEvents: "none",
                        "@media (min-height: 300px)": {
                            alignItems: "flex-start",
                            paddingTop: "25vh",
                        },
                    }}
                >
                    <Paper
                        elevation={0}
                        sx={{
                            width: "100%",
                            height: "100%",
                            padding: "1rem",
                            pointerEvents: "auto",
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "center",
                            alignItems: "center",
                            gap: "1rem",
                        }}
                    >
                        <Typography variant="h5">Search for candidates</Typography>
                        <SearchField
                            sx={{ width: "100%" }}
                            id="input-search-id"
                            label="Seach by Id"
                            placeholder=""
                            multiline
                            onChange={(e) => setId(e.target.value)}
                            helperText="Identifier or URL to search for, can be musicbrainz id, spotify url, etc. depending on your configuration."
                        />
                        <div style={{ width: "100%" }}>
                            <Box
                                sx={{
                                    width: "100%",
                                    display: "flex",
                                    flexDirection: "row",
                                    gap: "1rem",
                                }}
                            >
                                <SearchField
                                    sx={{ width: "100%" }}
                                    id="input-search-artist"
                                    label="Seach by artist"
                                    placeholder="Artist"
                                    onChange={(e) => setArtist(e.target.value)}
                                    onBlur={validateArtistAlbum}
                                />
                                <SearchField
                                    sx={{ width: "100%" }}
                                    id="input-search-artist"
                                    label="and album"
                                    placeholder="Album"
                                    onChange={(e) => setAlbum(e.target.value)}
                                    onBlur={validateArtistAlbum}
                                />
                            </Box>
                            <FormHelperText
                                style={{
                                    marginInline: "1rem",
                                }}
                            >
                                Search by artist and album name to find more candidates.
                                Might take a while.
                            </FormHelperText>
                        </div>
                        {error && (
                            <FormHelperText error={error?.length > 0}>
                                {error}
                            </FormHelperText>
                        )}
                        <Box
                            sx={{
                                width: "100%",
                                display: "flex",
                                justifyContent: "flex-end",
                                gap: "1rem",
                                marginTop: "1rem",
                            }}
                        >
                            <Button
                                variant="outlined"
                                color="warning"
                                onClick={() => setOpen(false)}
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleApply}
                                disabled={!isApplyEnabled() || searching}
                                variant="outlined"
                                color="primary"
                            >
                                Search{" "}
                                {searching && (
                                    <CircularProgress
                                        size={"1rem"}
                                        style={{ marginLeft: "0.5rem" }}
                                    />
                                )}
                            </Button>
                        </Box>
                    </Paper>
                </Container>
            </Modal>
        </>
    );
}

const Backdrop = forwardRef<HTMLDivElement, { open?: boolean; className: string }>(
    ({ open, className, ...other }, ref) => (
        <Box
            className={className}
            ref={ref}
            {...other}
            sx={[
                {
                    position: "fixed",
                    inset: 0,
                    backgroundColor: "#00000033",
                    backdropFilter: "blur(5px)",
                    zIndex: -1,
                    WebkitTapHighlightColor: "transparent",
                },
                open
                    ? {
                          display: "block",
                      }
                    : {
                          display: "none",
                      },
            ]}
        />
    )
);
Backdrop.displayName = "Backdrop";

const SearchField = styled(TextField)(({ theme }) => ({
    // backgroundColor: theme.palette.background.default,
    borderColor: theme.palette.divider,
    borderRadius: theme.shape.borderRadius,
    "& .MuiOutlinedInput-root": {
        "& fieldset": {
            borderColor: theme.palette.divider,
        },
        "&:hover fieldset": {
            borderColor: theme.palette.primary.main,
        },
        "&.Mui-focused fieldset": {
            borderColor: theme.palette.primary.main,
        },
    },
}));
