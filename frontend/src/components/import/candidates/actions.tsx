import { PageWrapper } from "@/components/common/page";
import { SerializedCandidateState } from "@/pythonTypes";
import {
    Box,
    BoxProps,
    Button,
    ButtonGroupProps,
    Divider,
    FormHelperText,
    IconButton,
    Modal,
    styled,
    TextField,
    ToggleButton,
    ToggleButtonGroup,
    ToggleButtonGroupProps,
    ToggleButtonProps,
    Tooltip,
    Typography,
    TypographyProps,
    useTheme,
} from "@mui/material";
import {
    CheckIcon,
    CopyMinusIcon,
    CopyPlusIcon,
    MergeIcon,
    SearchIcon,
    Trash2Icon,
    XIcon,
} from "lucide-react";
import { Ref, useState } from "react";

/** Text that is show as an indicator
 * how good a match is.
 *
 *
 */
function candidateMatchText({ candidate }: { candidate: SerializedCandidateState }) {
    let text = "";
    const match = 1 - candidate.distance;
    if (match > 0.95) {
        text = "This is a perfect match!";
    } else if (match > 0.9) {
        text = "Great choice!";
    } else if (match > 0.8) {
        text = "Not too shabby, this could work.";
    } else if (match > 0.7) {
        text = "It's fine, I guess...";
    } else if (match > 0.6) {
        text = "Sure, if you're okay with 'average'.";
    } else if (match > 0.5) {
        text = "I mean, you could do better, but okay.";
    } else if (match > 0.3) {
        text = "Really? This is what you're going with?";
    } else if (match > 0.2) {
        text = "I don't even know why you're considering this.";
    } else if (match > 0.1) {
        text = "You might want to rethink your choices.";
    } else {
        text = "This... is a disaster.";
    }

    // Special case for asis
    if (candidate.info.data_source === "asis") {
        text = "Fear of the unknown?";
    }

    return text;
}

export function ImportCandidateButton({
    candidate,
}: {
    candidate: SerializedCandidateState;
}) {
    return (
        <Button
            variant="outlined"
            color="primary"
            startIcon={<CheckIcon size={14} />}
            onClick={() => {
                alert("TODO: Import " + candidate.info.data_url);
            }}
        >
            Import
        </Button>
    );
}

export function ImportCandidateLabel({
    candidate,
    ...props
}: {
    candidate: SerializedCandidateState;
} & TypographyProps) {
    return (
        <Typography variant="caption" color="textDisabled" {...props}>
            {candidateMatchText({ candidate })}
        </Typography>
    );
}

/* ---------------------------- Duplicate actions --------------------------- */

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

/** Actions which are shown if a candidate is already
 * existing in the database. I.e. duplicate
 */
export function DuplicateActions({ ...props }: Omit<ToggleButtonGroupProps, "color">) {
    return (
        <DuplicateActionButtonGroup
            exclusive
            color="primary"
            disabled={true}
            aria-label="duplicate actions"
            {...props}
        >
            <DuplicateActionButton value="skip" />
            <DuplicateActionButton value="merge" />
            <DuplicateActionButton value="keep" />
            <DuplicateActionButton value="remove" />
        </DuplicateActionButtonGroup>
    );
}

function DuplicateActionButton({
    value,
    ...props
}: {
    value: "skip" | "merge" | "keep" | "remove";
} & Omit<ToggleButtonProps, "value" | "type">) {
    const theme = useTheme();

    let Icon = CopyMinusIcon;
    let title = "";
    switch (value) {
        case "skip":
            Icon = CopyMinusIcon;
            title = "Skip new (don't import)";
            break;
        case "merge":
            Icon = MergeIcon;
            title = "Merge new and old into one album";
            break;
        case "keep":
            Icon = CopyPlusIcon;
            title = "Keep both, old and new";
            break;
        case "remove":
            Icon = Trash2Icon;
            title = "Remove old items";
            break;
        default:
            break;
    }

    return (
        <Tooltip title={title}>
            <ToggleButton
                value={value}
                aria-label={value}
                size="small"
                color="primary"
                {...props}
            >
                <Icon size={theme.iconSize.sm} />
            </ToggleButton>
        </Tooltip>
    );
}

/* -------------------------- Search new candidate -------------------------- */

export function CandidateSearch() {
    const theme = useTheme();
    const [open, setOpen] = useState(false);
    return (
        <>
            <Tooltip title="Search for more candidates" placement="top">
                <Button
                    variant="outlined"
                    color="secondary"
                    onClick={() => setOpen(true)}
                    startIcon={<SearchIcon size={14} />}
                >
                    Search
                </Button>
            </Tooltip>
            <Modal
                open={open}
                onClose={() => setOpen(false)}
                slots={{ backdrop: Backdrop }}
                sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                }}
            >
                <Box
                    sx={(theme) => ({
                        display: "flex",
                        flexDirection: "column",
                        padding: 0.5,
                        paddingInline: 1,
                        paddingBlock: 1.5,
                        borderRadius: 1,
                        gap: 1.5,
                        backgroundColor: theme.palette.background.paper,
                        minWidth: theme.breakpoints.values.tablet + "px",
                        [theme.breakpoints.down("tablet")]: {
                            width: "100%",
                            height: "100%",
                            minWidth: "auto",
                        },
                        boxShadow: theme.shadows[4],
                    })}
                >
                    <Box
                        sx={{
                            display: "flex",
                            width: "100%",
                            gap: 1,
                            alignItems: "center",
                            justifyContent: "space-between",
                        }}
                    >
                        <Typography variant="h5" component="div">
                            Search for more candidates
                        </Typography>
                        <IconButton
                            onClick={() => setOpen(false)}
                            sx={{
                                margin: 0,
                                padding: 0.5,
                            }}
                        >
                            <XIcon />
                        </IconButton>
                    </Box>
                    <Divider variant="inset" />
                    <SearchField
                        sx={{ width: "100%" }}
                        id="input-search-id"
                        label="Seach by Id"
                        placeholder=""
                        multiline
                        helperText="Identifier or URL to search for, can be musicbrainz id, spotify url, etc. depending on your configuration."
                    />
                    <Box>
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
                            />
                            <SearchField
                                sx={{ width: "100%" }}
                                id="input-search-artist"
                                label="and album"
                                placeholder="Album"
                            />
                        </Box>
                        <FormHelperText
                            sx={(theme) => ({
                                marginInline: "1rem",
                                color: theme.palette.text.disabled,
                                fontSize: theme.typography.caption.fontSize,
                            })}
                        >
                            Search by artist and album name to find more candidates.
                            Might take a while.
                        </FormHelperText>
                    </Box>
                    <Box
                        sx={{
                            width: "100%",
                            display: "flex",
                            justifyContent: "flex-end",
                            gap: 1,
                            marginTop: "auto",
                        }}
                    >
                        <FormHelperText
                            error={true}
                            sx={{
                                alignSelf: "flex-end",
                            }}
                        >
                            Something bad happened, show error message here.
                        </FormHelperText>
                        <Button
                            variant="outlined"
                            color="primary"
                            startIcon={<SearchIcon size={theme.iconSize.sm} />}
                            onClick={() => {
                                alert("TODO: Search for candidates");
                            }}
                        >
                            Search
                        </Button>
                    </Box>
                </Box>
            </Modal>
        </>
    );
}

const Backdrop = ({
    open,
    ref,
    ...other
}: {
    open: boolean;
    ref: Ref<HTMLDivElement>;
} & BoxProps) => (
    <Box
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
);

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
    ".MuiFormHelperText-root": {
        marginInline: "1rem",
        color: theme.palette.text.disabled,
        fontSize: theme.typography.caption.fontSize,
    },
}));
