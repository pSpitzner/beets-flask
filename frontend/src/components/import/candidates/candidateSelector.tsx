import {
    ChevronDownIcon,
    ChevronsDownUpIcon,
    ChevronsUpDownIcon,
    EllipsisIcon,
} from "lucide-react";
import {
    createContext,
    Fragment,
    ReactNode,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import {
    ButtonGroup,
    DialogContent,
    Divider,
    IconButton,
    Radio,
    styled,
    Typography,
    useTheme,
} from "@mui/material";
import Box, { BoxProps } from "@mui/material/Box";
import { useSuspenseQueries } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";

import { FileMetadata, fileMetadataQueryOptions } from "@/api/library";
import { Dialog } from "@/components/common/dialogs";
import { PropertyValueTable } from "@/components/common/propertyValueTable";
import { humanizeBytes } from "@/components/common/units/bytes";
import { trackLengthRep } from "@/components/common/units/time";
import { ExternalCoverArt, FileCoverArt } from "@/components/library/coverArt";
import {
    AlbumInfo,
    SerializedCandidateState,
    SerializedTaskState,
} from "@/pythonTypes";

import { CandidateSearch } from "./actions";
import {
    ExtraItems,
    ExtraTracks,
    GenericDetailsItem,
    GenericDetailsItemWithDiff,
    NoChanges,
    TrackChanges,
    TrackDiffContextProvider,
    TrackDiffsAfterImport,
    useTrackDiffContext,
} from "./diff";

import { MatchChip } from "../../common/chips";
import {
    AlbumIcon,
    ArtistIcon,
    AudioFileIcon,
    DurationIcon,
    GenreIcon,
    PenaltyTypeIcon,
    SourceTypeIcon,
    TrackIcon,
} from "../../common/icons";
import { PenaltyIconRow } from "../icons";

/**
 * Renders a selection interface for import candidates, allowing users to choose
 * between multiple metadata matching options for a given task.
 *
 * @example
 * <CandidateSelector
 *   task={importTask}
 *   selected={selectedId}
 *   onChange={handleSelectionChange}
 * />
 */
export function CandidateSelector({
    task,
    selected,
    onChange,
}: {
    task: SerializedTaskState;
    selected: SerializedCandidateState["id"];
    onChange: (id: SerializedCandidateState["id"]) => void;
}) {
    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
            <CandidateSelectionContextProvider
                candidates={[task.asis_candidate, ...task.candidates]}
                selected={selected}
                setSelected={onChange}
            >
                <TopBar task={task} />
                <GridWrapper>
                    {/* As-is candidate */}
                    <CandidateInfo candidate={task.asis_candidate} />
                    <AsisCandidateDetails
                        candidate_id={task.asis_candidate.id}
                        items={task.items}
                        metadata={task.current_metadata}
                    />
                    {/* Other candidates */}
                    {task.candidates.map((candidate) => (
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
            </CandidateSelectionContextProvider>
        </Box>
    );
}

export function ImportedCandidate({
    task,
    ...props
}: {
    task: SerializedTaskState;
} & BoxProps) {
    // Chosen candidate
    const candidate = [...task.candidates, task.asis_candidate].find(
        (cand) => cand.id === task.chosen_candidate_id
    );
    if (!candidate) {
        throw new Error(
            "No candidate selected. This should not happen for imported tasks."
        );
    }

    return (
        <Box {...props}>
            <Box
                sx={(theme) => ({
                    display: "flex",
                    gap: 1,

                    [theme.breakpoints.down("tablet")]: {
                        alignItems: "flex-start",
                        paddingLeft: 1,
                        flexDirection: "column-reverse",
                    },
                })}
            >
                <Box
                    sx={{
                        display: "block",
                        width: "100%",
                    }}
                >
                    <OverviewChanges
                        items={task.items}
                        candidate={candidate}
                        metadata={task.current_metadata}
                    />
                </Box>
                <Box
                    sx={(theme) => ({
                        display: "flex",
                        width: "125px",
                        height: "125px",
                        alignSelf: "center",

                        [theme.breakpoints.down("tablet")]: {
                            width: "100%",
                            height: "auto",
                            alignSelf: "inherit",
                            maxHeight: "200px",
                        },
                    })}
                >
                    {candidate.info.data_url !== null && (
                        <ExternalCoverArt
                            sx={{
                                height: "auto",
                                width: "100%",
                                aspectRatio: "1 / 1",
                                objectFit: "contain",
                            }}
                            data_url={candidate.info.data_url}
                        />
                    )}
                </Box>
            </Box>
            <Box sx={{ pt: 2 }}>
                <Divider sx={{ mb: 2 }} />
                <TrackDiffsAfterImport items={task.items} candidate={candidate} />
            </Box>
        </Box>
    );
}

/* --------------------------------- Context -------------------------------- */
// Used to manage expanded state i.e. the state of the accordion

const CandidateSelectionContext = createContext<null | {
    expandedCandidates: Set<SerializedCandidateState["id"]>;
    isExpanded: (id: SerializedCandidateState["id"]) => boolean;
    toggleExpanded: (id: SerializedCandidateState["id"]) => void;
    collapseAll: () => void;
    setExpandedCandidates: (candidates: Set<SerializedCandidateState["id"]>) => void;
    expandAll: () => void;

    selected: SerializedCandidateState["id"];
    setSelected: (id: SerializedCandidateState["id"]) => void;
}>(null);

const useCandidateSelection = () => {
    const context = useContext(CandidateSelectionContext);
    if (!context) {
        throw new Error(
            "useCandidateContext must be used within a CandidatesContextProvider"
        );
    }
    return context;
};

function CandidateSelectionContextProvider({
    children,
    candidates,
    selected,
    setSelected,
}: {
    children: ReactNode;
    candidates: Array<SerializedCandidateState>;
    selected: SerializedCandidateState["id"];
    setSelected: (id: SerializedCandidateState["id"]) => void;
}) {
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
        <CandidateSelectionContext.Provider
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
        </CandidateSelectionContext.Provider>
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
    paddingInline: theme.spacing(1),
    paddingBlock: theme.spacing(0.5),

    // Gap between rows
    marginTop: theme.spacing(0.5),
    ":nth-of-type(1)": {
        marginTop: theme.spacing(0),
    },

    // Border bottom when details are shown
    '&[data-expanded="true"]': {
        borderBottomLeftRadius: 0,
        borderBottomRightRadius: 0,
        borderBottom: `1px solid ${theme.palette.divider}`,
    },

    '&[data-selected="true"]': {
        backgroundColor: theme.palette.action.selected,
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
    // TODO: would be nice to not render the details at all
    // would prevent the images from loading
    // should also prevent the long loading time when switching
    // tasks
    "&[data-expanded='false']": {
        display: "none",
    },

    '&[data-selected="true"]': {
        backgroundColor: theme.palette.action.selected,
        thead: {
            backgroundColor: theme.palette.action.selected,
        },
    },

    thead: {
        backgroundColor: theme.palette.background.paper,
    },

    flexDirection: "column",
}));

function TopBar({ task }: { task: SerializedTaskState }) {
    const theme = useTheme();
    const { expandedCandidates, collapseAll, expandAll } = useCandidateSelection();

    return (
        <Box
            sx={{
                display: "flex",
                gap: 1,
                alignItems: "center",
                justifyContent: "flex-end",
            }}
        >
            <CandidateSearch task={task} />
            <ButtonGroup size="small" color="secondary">
                <IconButton
                    color="secondary"
                    // +1 for asis candidate
                    disabled={expandedCandidates.size === task.candidates.length + 1}
                    onClick={expandAll}
                    title="Expand all"
                >
                    <ChevronsUpDownIcon size={theme.iconSize.lg} />
                </IconButton>
                <IconButton
                    color="secondary"
                    disabled={expandedCandidates.size === 0}
                    onClick={collapseAll}
                    title="Collapse all"
                >
                    <ChevronsDownUpIcon size={theme.iconSize.lg} />
                </IconButton>
            </ButtonGroup>
        </Box>
    );
}

/* -------------------------------- Candidate ------------------------------- */

/** Candidate info.
 *
 * Shows a row with the major information about the candidate.
 */
function CandidateInfo({
    candidate,
    slotProps = {},
}: {
    candidate: SerializedCandidateState;
    slotProps?: {
        selector?: BoxProps;
    };
}) {
    const ref = useRef<HTMLDivElement>(null);
    const { isExpanded, toggleExpanded, selected, setSelected } =
        useCandidateSelection();
    const theme = useTheme();

    const expanded = isExpanded(candidate.id);
    const candidateSelected = selected === candidate.id;

    useEffect(() => {
        // Set css data-expanded attribute to the ref element
        // using ref for performance reasons
        if (ref.current) {
            ref.current.setAttribute("data-expanded", String(expanded));
            ref.current.setAttribute(
                "data-selected",
                String(selected === candidate.id)
            );
        }
    }, [candidate.id, expanded, selected]);

    return useMemo(() => {
        return (
            <CandidateInfoRow
                ref={ref}
                onClick={(e: React.MouseEvent) => {
                    e.stopPropagation();
                    setSelected(candidate.id);
                }}
                sx={(theme) => ({
                    cursor: "pointer",
                    userSelect: "none",
                    "&:hover": {
                        background: `linear-gradient(to right, ${theme.palette.secondary.muted} 0%, transparent 100%)`,
                    },
                })}
            >
                <Box gridColumn="selector" display="flex" {...slotProps.selector}>
                    <Radio
                        checked={candidateSelected}
                        onChange={() => {
                            setSelected(candidate.id);
                        }}
                        value={candidate.id}
                        size="small"
                        sx={{
                            padding: 0,
                            pointerEvents: "none",
                        }}
                        color="secondary"
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
                        onClick={(e) => {
                            e.stopPropagation();
                            toggleExpanded(candidate.id);
                        }}
                        sx={{
                            padding: 0,
                            "& svg": {
                                transform: expanded ? "rotate(180deg)" : undefined,
                            },
                        }}
                    >
                        <ChevronDownIcon size={20} />
                    </IconButton>
                </Box>
            </CandidateInfoRow>
        );
    }, [
        slotProps.selector,
        candidateSelected,
        candidate,
        theme.iconSize.md,
        expanded,
        setSelected,
        toggleExpanded,
    ]);
}

/** Candidate details.
 *
 * Shows additional information about the candidate. I.e. cover art, metadata, etc.
 * and also shows the diff of the items.
 */
export function CandidateDetails({
    candidate,
    items,
    metadata,
}: {
    candidate: SerializedCandidateState;
    items: SerializedTaskState["items"];
    metadata: SerializedTaskState["current_metadata"];
}) {
    const ref = useRef<HTMLDivElement>(null);
    const { isExpanded, selected } = useCandidateSelection();

    const expanded = isExpanded(candidate.id);

    useEffect(() => {
        // Set css data-expanded attribute to the ref element
        // using ref for performance reasons
        if (ref.current) {
            ref.current.setAttribute("data-expanded", String(expanded));
            ref.current.setAttribute(
                "data-selected",
                String(selected === candidate.id)
            );
        }
    }, [candidate.id, expanded, selected]);

    return useMemo(() => {
        return (
            <CandidateDetailsRow ref={ref}>
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
                        <OverviewChanges
                            items={items}
                            candidate={candidate}
                            metadata={metadata}
                        />
                        <Box
                            sx={(theme) => ({
                                display: "flex",
                                alignItems: "center",
                                width: "125px",
                                height: "125px",

                                [theme.breakpoints.down("tablet")]: {
                                    padding: 0.5,
                                    //maxHeight: "500px",
                                    width: "100%",
                                    height: "auto",
                                    justifyContent: "center",
                                },
                            })}
                        >
                            {candidate.info.data_url !== null && (
                                <ExternalCoverArt
                                    sx={{
                                        height: "auto",
                                        width: "100%",
                                        aspectRatio: "1 / 1",
                                        objectFit: "contain",
                                    }}
                                    data_url={candidate.info.data_url}
                                />
                            )}
                        </Box>
                    </Box>
                </Box>
            </CandidateDetailsRow>
        );
    }, [candidate, items, metadata]);
}

function AsisCandidateDetails({
    candidate_id,
    items,
}: {
    candidate_id: SerializedCandidateState["id"];
    items: SerializedTaskState["items"];
    metadata: SerializedTaskState["current_metadata"];
}) {
    const ref = useRef<HTMLDivElement>(null);
    const { isExpanded, selected } = useCandidateSelection();

    const expanded = isExpanded(candidate_id);
    const filesMetaDataQueries = useSuspenseQueries({
        queries: items.map((item) => fileMetadataQueryOptions(item.path!)),
    });

    useEffect(() => {
        // Set css data-expanded attribute to the ref element
        // using ref for performance reasons
        if (ref.current) {
            ref.current.setAttribute("data-expanded", String(expanded));
            ref.current.setAttribute(
                "data-selected",
                String(selected === candidate_id)
            );
        }
    }, [candidate_id, expanded, selected]);

    return (
        <CandidateDetailsRow ref={ref}>
            <Box
                sx={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 2,
                }}
            >
                {filesMetaDataQueries.map((query, idx) => {
                    return (
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
                            key={idx}
                        >
                            <OverviewMetadata metadata={query.data} />
                            <Box
                                sx={(theme) => ({
                                    display: "flex",
                                    alignItems: "center",
                                    width: "125px",
                                    height: "125px",

                                    [theme.breakpoints.down("tablet")]: {
                                        padding: 0.5,
                                        width: "100%",
                                        marginRight: "auto",
                                        height: "auto",
                                        justifyContent: "center",
                                    },
                                })}
                            >
                                <FileCoverArt
                                    sx={{
                                        height: "auto",
                                        width: "100%",
                                        objectFit: "contain",
                                        aspectRatio: "1 / 1",
                                    }}
                                    path={items[idx].path!}
                                />
                            </Box>
                        </Box>
                    );
                })}
            </Box>
        </CandidateDetailsRow>
    );
}

/** Overview of changes to metadata if track
 * is applied.
 *
 * Two columns on desktop and one on mobile.
 */
function OverviewChanges({
    items,
    candidate,
    metadata,
}: {
    items: SerializedTaskState["items"];
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
                columnGap: 2,

                [theme.breakpoints.down("tablet")]: {
                    display: "flex",
                    gridAutoFlow: "row",
                    "*": {
                        textWrap: "unset",
                    },
                },
            })}
        >
            {/* first column, important stuff */}
            <GenericDetailsItemWithDiff
                icon={<PenaltyTypeIcon type="artist" />}
                from={metadata.artist}
                to={candidate.info.artist}
                tooltip="Artist"
                sx={{
                    gridColumn: "1",
                    gridRow: "1",
                }}
            />
            <GenericDetailsItemWithDiff
                icon={<PenaltyTypeIcon type="album" />}
                from={metadata.album}
                to={candidate.info.album}
                tooltip="Album"
                sx={{
                    gridColumn: "1",
                    gridRow: "2",
                }}
            />
            <SourceDetailItem
                data_source={candidate.info.data_source!}
                data_url={candidate.info.data_url}
                sx={{
                    gridColumn: "1",
                    gridRow: "3",
                    textWrap: "nowrap",
                    textOverflow: "ellipsis",
                }}
            />
            <GenericDetailsItemWithDiff
                icon={<PenaltyTypeIcon type="year" />}
                from={metadata.year?.toString()}
                to={candidate.info.year?.toString()}
                tooltip="Release Year"
                sx={{
                    gridColumn: "1",
                    gridRow: "4",
                }}
            />

            {/* second column, extra info */}
            <GenericDetailsItemWithDiff
                icon={<PenaltyTypeIcon type="label" />}
                from={metadata.label}
                to={(candidate.info as AlbumInfo).label}
                tooltip="Recordlabel"
                sx={{
                    gridColumn: "2",
                    gridRow: "1",
                }}
            />
            <GenericDetailsItemWithDiff
                icon={<PenaltyTypeIcon type="media" />}
                from={metadata.media}
                to={candidate.info.media}
                tooltip="Media Type"
                sx={{
                    gridColumn: "2",
                    gridRow: "2",
                }}
            />
            <GenericDetailsItemWithDiff
                icon={<PenaltyTypeIcon type="catalognum" />}
                from={metadata.catalognum}
                to={(candidate.info as AlbumInfo).catalognum}
                tooltip="Catalog Number"
                sx={{
                    gridColumn: "2",
                    gridRow: "3",
                }}
            />
            <GenericDetailsItemWithDiff
                icon={<PenaltyTypeIcon type="country" />}
                from={metadata.country}
                to={(candidate.info as AlbumInfo).country}
                tooltip="The country in which this candidate was released."
                sx={{
                    gridColumn: "2",
                    gridRow: "4",
                }}
            />

            {/* track changes */}
            <TrackDiffContextProvider candidate={candidate} items={items}>
                <TrackChangesDetailItem
                    kind="track_changes"
                    sx={{
                        gridColumn: "1",
                        gridRow: "5",
                    }}
                />
                <TrackChangesDetailItem
                    kind="extra_items"
                    sx={{
                        gridColumn: "2",
                        gridRow: "5",
                    }}
                />
                <TrackChangesDetailItem
                    kind="extra_tracks"
                    sx={{
                        gridColumn: "2",
                        gridRow: "6",
                    }}
                />
            </TrackDiffContextProvider>
        </Box>
    );
}

function OverviewMetadata({ metadata }: { metadata: FileMetadata }) {
    const [show, setShow] = useState<boolean>(false);
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
                columnGap: 2,

                [theme.breakpoints.down("tablet")]: {
                    display: "flex",
                    gridAutoFlow: "row",
                    "*": {
                        textWrap: "unset",
                    },
                },
            })}
        >
            {/* first column, important stuff */}
            <MetadataDetailsItem
                type="track"
                metadata={metadata}
                sx={{
                    gridColumn: "1",
                    gridRow: "1",
                }}
            />

            <MetadataDetailsItem
                type="title"
                metadata={metadata}
                sx={{
                    gridColumn: "1",
                    gridRow: "2",
                }}
            />

            <MetadataDetailsItem
                type="artist"
                metadata={metadata}
                sx={{
                    gridColumn: "1",
                    gridRow: "3",
                }}
            />
            <MetadataDetailsItem
                type="album"
                metadata={metadata}
                sx={{
                    gridColumn: "1",
                    gridRow: "4",
                }}
            />
            <MetadataDetailsItem
                type="filepath"
                metadata={metadata}
                sx={{
                    gridColumn: "1",
                    gridRow: "5",
                }}
            />
            <MetadataDetailsItem
                type="year"
                metadata={metadata}
                sx={{
                    gridColumn: "2",
                    gridRow: "1",
                }}
            />

            {/* second column, extra info */}
            <MetadataDetailsItem
                type="label"
                metadata={metadata}
                sx={{
                    gridColumn: "2",
                    gridRow: "2",
                }}
            />
            <MetadataDetailsItem
                type="genre"
                metadata={metadata}
                sx={{
                    gridColumn: "2",
                    gridRow: "3",
                }}
            />
            <MetadataDetailsItem
                type="duration"
                metadata={metadata}
                sx={{
                    gridColumn: "2",
                    gridRow: "4",
                }}
            />
            <GenericDetailsItem
                icon={<EllipsisIcon />}
                label="Full Metadata"
                onClick={() => setShow(true)}
                sx={{
                    gridColumn: "2",
                    gridRow: "5",
                }}
            />
            <Dialog
                title="Full Metadata"
                open={show}
                onClose={() => {
                    setShow(false);
                }}
                maxWidth="laptop"
                fullWidth={true}
            >
                <DialogContent sx={{ pt: 0 }}>
                    <PropertyValueTable data={metadata} allowFullscreen={false} />
                </DialogContent>
            </Dialog>
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
    const isAsis = data_source === "asis";

    const label = isAsis ? "Metadata from disk" : data_source;

    return (
        <GenericDetailsItem
            icon={<SourceTypeIcon type={data_source} />}
            label={
                <>
                    <Link
                        to={data_url || "#"}
                        target="_blank"
                        style={{
                            alignItems: "center",
                            display: "flex",
                        }}
                    >
                        {label}
                    </Link>
                </>
            }
            tooltip={`${data_url || "No URL"}`}
            {...props}
        />
    );
}

function TrackChangesDetailItem({
    kind,
    ...props
}: {
    kind: "track_changes" | "extra_tracks" | "extra_items";
} & BoxProps) {
    const { extra_tracks, extra_items, candidate, nChanges, pairs } =
        useTrackDiffContext();

    const [open, setOpen] = useState(false);

    const icon = <PenaltyTypeIcon type={kind} />;
    let text = "Track Changes";
    let dialogTitle: string | null = null;
    let pl: string;
    let color: string | undefined = undefined;
    let tooltip: string | undefined = undefined;
    let content: ReactNode | null = null;

    switch (kind) {
        case "track_changes":
            if (candidate.penalties.includes("tracks")) {
                // TODO: get number of changed tracks, but that is currently
                // deeply nested in the subcomponent...
                tooltip =
                    "Shows which items (on disk) are mapped to tracks (from the candidate). Changes are highlighted in red and green.";
                text = "Tracks changed";
                dialogTitle = `${nChanges} of ${pairs.length} tracks changed`;
                color = "diffs.changed";
                content = <TrackChanges />;
            } else {
                text = "No severe track changes";
                content = <TrackChanges />;
            }
            break;
        case "extra_items":
            if (extra_items.length > 0) {
                tooltip = "Tracks on disk that could not be matched to tracks online.";
                pl = "track" + (extra_items.length !== 1 ? "s" : "");
                text = `${extra_items.length} ${pl} from disk not found online`;
                color = "diffs.extraItem";
                content = <ExtraItems />;
            } else {
                text = "All tracks on disk found online";
                content = <NoChanges type="extra_items" />;
            }
            break;
        case "extra_tracks":
            if (extra_tracks.length > 0) {
                tooltip =
                    "Tracks found online that could not be found on disk (usually because they are missing).";
                pl = "item" + (extra_tracks.length !== 1 ? "s" : "");
                text = `${extra_tracks.length} ${pl} missing on disk`;
                color = "diffs.extraTrack";
                content = <ExtraTracks />;
            } else {
                text = "All tracks online present on disk";
                content = <NoChanges type="extra_tracks" />;
            }
            break;
        default:
            break;
    }

    return (
        <>
            <GenericDetailsItem
                icon={icon}
                label={text}
                tooltip={tooltip}
                labelColor={color}
                onClick={() => {
                    setOpen(true);
                }}
                {...props}
            />
            {content ? (
                <Dialog
                    open={open}
                    onClose={() => {
                        setOpen(false);
                    }}
                    title={dialogTitle || text}
                    title_icon={icon}
                >
                    <DialogContent>{content}</DialogContent>
                </Dialog>
            ) : null}
        </>
    );
}

// Associations of meta keys to groupings
// allows to show only one item per grouping
const metaGroupings = {
    filepath: ["filename"],
    artist: [
        "artist",
        "composer",
        "album_artist",
        "albumartist",
        "albumartistsort",
        "artist_credit",
        "artistsort",
    ],
    album: ["album"],
    track: ["track", "index", "catalognum"],
    title: ["title"],
    label: ["label", "publisher"],
    genre: ["genre", "genres"],
    year: ["year", "originaldate", "_year"],
    duration: ["duration"],
    filesize: ["filesize"],
    bitrate: ["bitrate"],
    bpm: ["bpm"],
    compilation: ["compilation"],
    identifiers: [
        "isrc",
        "catalognum",
        "catalog_number",
        "musicbrainz_trackid",
        "musicbrainz_releasetrackid",
    ],
    lyrics: ["lyrics"],
} as const;

function MetadataDetailsItemIcon({ type }: { type: keyof typeof metaGroupings }) {
    switch (type) {
        case "filepath":
            return <AudioFileIcon />;
        case "artist":
            return <ArtistIcon />;
        case "album":
            return <AlbumIcon />;
        case "track":
            return <PenaltyTypeIcon type="catalognum" />;
        case "title":
            return <TrackIcon />;
        case "label":
            return <PenaltyTypeIcon type="label" />;
        case "genre":
            return <GenreIcon />;
        case "year":
            return <PenaltyTypeIcon type="year" />;
        case "duration":
            return <DurationIcon />;
        default:
            return <></>;
    }
}

export function MetadataDetailsItem({
    type,
    metadata,
    ...props
}: {
    type: keyof typeof metaGroupings;
    metadata: FileMetadata;
} & BoxProps) {
    const keys = metaGroupings[type];
    const values = keys.map((key) => metadata[key]).filter(Boolean);

    // Parse values
    let value = values.at(0) ?? "";
    if (type === "duration" && typeof value === "number") {
        value = trackLengthRep(value, false);
    } else if (type === "filesize" && typeof value === "number") {
        value = humanizeBytes(value);
    }

    return (
        <GenericDetailsItem
            icon={<MetadataDetailsItemIcon type={type} />}
            tooltip={
                <Box>
                    <Typography variant="caption" fontWeight="bold" gutterBottom>
                        {type.toLocaleUpperCase()}
                    </Typography>
                    <Box
                        sx={{
                            display: "grid",
                            gridTemplateColumns: "1fr auto",
                            gap: 0.5,
                        }}
                    >
                        {keys
                            .filter((k) => metadata[k] !== undefined)
                            .map((k) => (
                                <>
                                    <Box sx={{ textAlign: "left" }}>{k}:</Box>
                                    <Box sx={{ textAlign: "left" }}>{metadata[k]}</Box>
                                </>
                            ))}
                    </Box>
                </Box>
            }
            label={value}
            {...props}
        />
    );
}
