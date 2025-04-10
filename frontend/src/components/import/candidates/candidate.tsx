import {
    ChevronDownIcon,
    ChevronsDownUpIcon,
    ChevronsUpDownIcon,
    ExternalLinkIcon,
} from "lucide-react";
import {
    createContext,
    Fragment,
    ReactNode,
    useCallback,
    useContext,
    useMemo,
    useState,
} from "react";
import {
    Button,
    ButtonGroup,
    Divider,
    IconButton,
    Radio,
    Skeleton,
    styled,
    SxProps,
    Theme,
    Typography,
    useTheme,
} from "@mui/material";
import Box, { BoxProps } from "@mui/material/Box";
import { Link } from "@tanstack/react-router";

import {
    AlbumInfo,
    SerializedCandidateState,
    SerializedTaskState,
} from "@/pythonTypes";

import { GenericDetailsItem, GenericDetailsItemWithDiff, TrackDiff } from "./diff";

import { MatchChip } from "../../common/chips";
import { PenaltyTypeIcon, SourceTypeIcon } from "../../common/icons";
import { PenaltyIconRow } from "../icons";
import {
    CandidateSearch,
    DuplicateActions,
    ImportCandidateButton,
    ImportCandidateLabel,
} from "./actions";

/** Show a radio list of task candidates.
 *
 * Each item is expandable to show more details about the candidate.
 */
export function TaskCandidates({ task }: { task: SerializedTaskState }) {
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
        <CandidatesContextProvider candidates={sortedCandidates}>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                <TopBar candidates={task.candidates} />

                <GridWrapper>
                    {sortedCandidates.map((candidate) => (
                        <Fragment key={candidate.id}>
                            <CandidateInfo key={candidate.id} candidate={candidate} />
                            <CandidateDetails
                                candidate={candidate}
                                items={task.items}
                                metadata={task.current_metadata}
                            />
                        </Fragment>
                    ))}
                </GridWrapper>

                <BottomBar candidates={task.candidates} />
            </Box>
        </CandidatesContextProvider>
    );
}

/* --------------------------------- Context -------------------------------- */
// Used to manage expanded state i.e. the state of the accordion

const CandidatesContext = createContext<null | {
    expandedCandidates: Set<SerializedCandidateState["id"]>;
    isExpanded: (id: SerializedCandidateState["id"]) => boolean;
    toggleExpanded: (id: SerializedCandidateState["id"]) => void;
    collapseAll: () => void;
    setExpandedCandidates: (candidates: Set<SerializedCandidateState["id"]>) => void;
    expandAll: () => void;

    selected: SerializedCandidateState["id"];
    setSelected: (id: SerializedCandidateState["id"]) => void;
}>(null);

const useCandidatesContext = () => {
    const context = useContext(CandidatesContext);
    if (!context) {
        throw new Error(
            "useCandidateContext must be used within a CandidatesContextProvider"
        );
    }
    return context;
};

function CandidatesContextProvider({
    children,
    candidates,
}: {
    children: ReactNode;
    candidates: Array<SerializedCandidateState>;
}) {
    const [selected, setSelected] = useState<SerializedCandidateState["id"]>(() => {
        if (candidates.length === 1) {
            return candidates[0].id;
        }
        return candidates[1]?.id;
    });

    const [expanded, setExpanded] = useState<Set<SerializedCandidateState["id"]>>(
        () => {
            if (candidates.length === 1) {
                return new Set([candidates[0].id]);
            }
            return new Set([candidates[1].id]);
        }
    );

    const isExpanded = useCallback(
        (id: SerializedCandidateState["id"]) => {
            return expanded.has(id);
        },
        [expanded]
    );

    return (
        <CandidatesContext.Provider
            value={{
                isExpanded,
                expandedCandidates: expanded,
                setExpandedCandidates: setExpanded,
                collapseAll: () => {
                    setExpanded(new Set());
                },
                toggleExpanded: (id) => {
                    setExpanded((prev) => {
                        const copy = new Set(prev);

                        if (copy.has(id)) {
                            copy.delete(id);
                        } else {
                            copy.add(id);
                        }

                        return copy;
                    });
                },
                expandAll: () => {
                    setExpanded(new Set(candidates.map((c) => c.id)));
                },
                selected,
                setSelected,
            }}
        >
            {children}
        </CandidatesContext.Provider>
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

    flexDirection: "column",
}));

function TopBar({ candidates }: { candidates: SerializedCandidateState[] }) {
    const { expandedCandidates, collapseAll, expandAll } = useCandidatesContext();

    return (
        <ButtonGroup
            size="small"
            sx={{
                marginLeft: "auto",
            }}
            color="secondary"
        >
            <Button
                disabled={expandedCandidates.size === candidates.length}
                onClick={expandAll}
                startIcon={<ChevronsUpDownIcon size={20} />}
            >
                Expand all
            </Button>
            <Button
                disabled={expandedCandidates.size === 0}
                onClick={collapseAll}
                startIcon={<ChevronsDownUpIcon size={20} />}
            >
                Collapse all
            </Button>
        </ButtonGroup>
    );
}

function BottomBar({ candidates }: { candidates: SerializedCandidateState[] }) {
    const { selected } = useCandidatesContext();

    const selectedCandidate = useMemo(() => {
        return candidates.find((c) => c.id === selected);
    }, [candidates, selected]);

    if (!selectedCandidate) {
        return "No candidate selected";
    }

    return (
        <Box
            sx={{
                width: "100%",
                display: "flex",
                flexDirection: "column",
                justifyContent: "flex-end",
                gap: 0.5,
            }}
        >
            <Box
                sx={{
                    width: "100%",
                    display: "flex",
                    gap: 1,
                    justifyContent: "flex-end",
                }}
            >
                <Typography variant="caption" color="error">
                    If an error occurs while importing, we could show it here instead of
                    the import label.
                </Typography>
                <ImportCandidateLabel
                    candidate={selectedCandidate}
                    sx={{ textAlign: "right" }}
                />
            </Box>
            <Box sx={{ display: "flex", gap: 1 }}>
                <CandidateSearch />
                <DuplicateActions sx={{ marginLeft: "auto" }} />
                <ImportCandidateButton candidate={selectedCandidate} />
            </Box>
        </Box>
    );
}

/* -------------------------------- Candidate ------------------------------- */

/** Candidate info.
 *
 * Shows a row with the major information about the candidate.
 */
function CandidateInfo({ candidate }: { candidate: SerializedCandidateState }) {
    const { isExpanded, toggleExpanded, selected, setSelected } =
        useCandidatesContext();
    const theme = useTheme();

    const expanded = isExpanded(candidate.id);
    return useMemo(() => {
        return (
            <CandidateInfoRow data-expanded={expanded}>
                <Box gridColumn="selector" display="flex">
                    <Radio
                        checked={selected === candidate.id}
                        onChange={() => {
                            setSelected(candidate.id);
                        }}
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
                        onClick={() => toggleExpanded(candidate.id)}
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
    }, [expanded, selected]);
}

/** Candidate details.
 *
 * Shows additional information about the candidate. I.e. cover art, metadata, etc.
 * and also shows the diff of the items.
 */
function CandidateDetails({
    candidate,
    items,
    metadata,
}: {
    candidate: SerializedCandidateState;
    items: SerializedTaskState["items"];
    metadata: SerializedTaskState["current_metadata"];
}) {
    const { isExpanded } = useCandidatesContext();

    const expanded = isExpanded(candidate.id);

    return useMemo(() => {
        return (
            <CandidateDetailsRow data-expanded={expanded}>
                <Box
                    sx={{
                        display: "flex",
                        flexDirection: "column",
                    }}
                >
                    {/* Wrapper to show the cover art and the general info */}
                    <Box
                        sx={(theme) => ({
                            display: "flex",
                            alignItems: "flex-start",
                            gap: 1,

                            [theme.breakpoints.down("tablet")]: {
                                flexDirection: "column-reverse",
                                alignItems: "flex-start",
                                paddingLeft: 1,
                            },
                        })}
                    >
                        <OverviewChanges candidate={candidate} metadata={metadata} />
                        <Box
                            sx={(theme) => ({
                                display: "flex",
                                alignItems: "center",
                                width: "72px",
                                height: "72px",

                                [theme.breakpoints.down("tablet")]: {
                                    width: "100%",
                                    height: "auto",
                                    maxHeight: "200px",
                                },
                            })}
                        >
                            <ExternalCoverArt data_url={candidate.info.data_url} />
                        </Box>
                    </Box>

                    <Divider sx={{ marginY: 1 }} />

                    {/* Track/item Diffs */}
                    <TrackDiff items={items} candidate={candidate} />
                </Box>

                {/* Tracks */}
            </CandidateDetailsRow>
        );
    }, [expanded]);
}
/** Overview of changes to metadata if track
 * is applied.
 *
 * Two columns on desktop and one on mobile.
 */
function OverviewChanges({
    candidate,
    metadata,
}: {
    candidate: SerializedCandidateState;
    metadata: SerializedTaskState["current_metadata"];
}) {
    return (
        <Box
            sx={(theme) => ({
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                color: "text.secondary",
                flexDirection: "column",
                gridAutoFlow: "dense",
                width: "100%",
                flexGrow: 1,

                [theme.breakpoints.down("laptop")]: {
                    gridTemplateColumns: "1fr",
                    gridAutoFlow: "row",
                },
            })}
        >
            <SourceDetailItem
                data_source={candidate.info.data_source!}
                data_url={candidate.info.data_url}
            />
            <GenericDetailsItemWithDiff
                icon={<PenaltyTypeIcon type="artist" />}
                from={metadata.artist}
                to={candidate.info.artist}
                tooltip="The album artist of this candidate."
            />
            <GenericDetailsItemWithDiff
                icon={<PenaltyTypeIcon type="album" />}
                from={metadata.album}
                to={candidate.info.album}
                tooltip="The album title of this candidate."
            />
            <GenericDetailsItemWithDiff
                icon={<PenaltyTypeIcon type="year" />}
                from={metadata.year?.toString()}
                to={candidate.info.year?.toString()}
                tooltip="The year of the album was released."
            />
            <GenericDetailsItemWithDiff
                icon={<PenaltyTypeIcon type="label" />}
                from={metadata.label}
                to={(candidate.info as AlbumInfo).label}
                tooltip="The label of this candidate."
            />
            <GenericDetailsItemWithDiff
                icon={<PenaltyTypeIcon type="media" />}
                from={metadata.media}
                to={candidate.info.media}
                tooltip="The media type of this candidate."
            />
            <GenericDetailsItemWithDiff
                icon={<PenaltyTypeIcon type="catalognum" />}
                from={metadata.catalognum}
                to={(candidate.info as AlbumInfo).catalognum}
                tooltip="The catalog number of this candidate."
            />
            <GenericDetailsItemWithDiff
                icon={<PenaltyTypeIcon type="country" />}
                from={metadata.country}
                to={(candidate.info as AlbumInfo).country}
                tooltip="The country in which this candidate was released."
            />
        </Box>
    );
}

/* ---------------------------------- utils --------------------------------- */

function SourceDetailItem({
    data_source,
    data_url,
    ...props
}: {
    data_source: string;
    data_url?: string | null;
} & BoxProps) {
    const theme = useTheme();
    const isAsis = data_source === "asis";

    const tooltip = isAsis
        ? "Metadata from files"
        : `Candidate data was fetched from ${data_source}`;
    const label = isAsis ? "Metadata from files" : data_source;

    return (
        <GenericDetailsItem
            icon={<SourceTypeIcon type={data_source} />}
            label={
                <>
                    <Box component="span">{label}</Box>
                    {data_url && (
                        <Box
                            sx={{
                                fontSize: theme.typography.body2.fontSize,
                                color: "gray",
                                display: "inline-flex",
                            }}
                        >
                            {"("}
                            {data_source !== "asis"
                                ? data_url.split("/").pop()
                                : data_url}
                            <Link
                                to={data_url}
                                target="_blank"
                                style={{
                                    alignItems: "center",
                                    display: "flex",
                                }}
                            >
                                <ExternalLinkIcon
                                    size={theme.iconSize.xs + 1}
                                    style={{ marginLeft: theme.spacing(0.5) }}
                                />
                                {")"}
                            </Link>
                        </Box>
                    )}
                </>
            }
            tooltip={tooltip}
            {...props}
        />
    );
}

function ExternalCoverArt({
    data_url,
    ...props
}: {
    data_url?: string | null;
} & BoxProps) {
    const [error, setError] = useState(false);
    const [loaded, setLoaded] = useState(false);

    if (!data_url || error) {
        return null;
    }

    const common_style: SxProps<Theme> = (theme) => ({
        width: "72px",
        height: "72px",
        border: `2px solid ${theme.palette.divider}`,
        borderRadius: 1,
        objectFit: "contain",
        marginRight: 1,
        color: "text.secondary",
        alignItems: "center",
        fontSize: theme.typography.body2.fontSize,
        textAlign: "center",
    });

    return (
        <>
            <Skeleton
                variant="rounded"
                sx={[
                    common_style,
                    {
                        display: loaded ? "none" : "flex",
                        margin: 0,
                    },
                ]}
            />
            <Box
                component="img"
                src={`/api_v1/art?url=${encodeURIComponent(data_url)}`}
                sx={[
                    common_style,
                    {
                        display: !loaded ? "none" : "flex",
                    },
                ]}
                onError={() => setError(true)}
                onLoad={() => setLoaded(true)}
                {...props}
            />
        </>
    );
}
