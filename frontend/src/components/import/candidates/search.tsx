import {
    Search,
} from "lucide-react";
import { forwardRef, useState } from "react";
import {
    CircularProgress,
    Container,
    DialogProps,
    FormHelperText,
    Modal,
    styled,
    TextField,
    Tooltip,
} from "@mui/material";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";

import { useImportContext } from "../context";
import { SelectionState } from "../types";

export function CandidateSearch({ selection }: { selection: SelectionState }) {
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
            <Tooltip title="Search for more candidates" placement="top">
                <Box>
                    <Button
                        sx={{ height: "36px" }}
                        variant="outlined"
                        color="secondary"
                        onClick={handleOpen}
                        startIcon={<Search size={14} />}
                    >
                        Search
                    </Button>
                </Box>
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
                        paddingTop: "1rem",
                        "@media (min-height: 500px)": {
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
