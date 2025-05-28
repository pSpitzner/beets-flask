import {
    ChevronDownIcon,
    ChevronsDownUpIcon,
    ChevronsUpDownIcon,
    ExternalLinkIcon,
    EyeIcon,
    EyeOffIcon,
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
    Divider,
    IconButton,
    Radio,
    Skeleton,
    styled,
    SxProps,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    Theme,
    Typography,
    useTheme,
} from "@mui/material";
import Box, { BoxProps } from "@mui/material/Box";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";

import { FileMetadata, fileMetaQueryOptions } from "@/api/inbox";
import { Search } from "@/components/common/inputs/search";
import { PropertyValueTable } from "@/components/common/propertyValueTable";
import {
    AlbumInfo,
    SerializedCandidateState,
    SerializedTaskState,
} from "@/pythonTypes";

import {
    CandidateSearch,
    DuplicateActions,
    ImportCandidateButton,
    ImportCandidateLabel,
} from "./actions";
import { GenericDetailsItem, GenericDetailsItemWithDiff, TrackDiff } from "./diff";
import { MetaBadge } from "./metaBadge";

import { MatchChip } from "../../common/chips";
import { PenaltyTypeIcon, SourceTypeIcon } from "../../common/icons";
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
                    <Fragment key={task.asis_candidate.id}>
                        <CandidateInfo
                            key={task.asis_candidate.id}
                            candidate={task.asis_candidate}
                        />
                        <AsisCandidateDetails
                            candidate={task.asis_candidate}
                            items={task.items}
                            metadata={task.current_metadata}
                        />
                    </Fragment>

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

type ClickHandler = (event: React.MouseEvent) => void;

function useSingleAndDoubleClick({
    onClick,
    onDoubleClick,
    delay = 250,
}: {
    onClick: ClickHandler;
    onDoubleClick: ClickHandler;
    delay?: number;
}): ClickHandler {
    const clickTimeout = useRef<number | null>(null);

    const handler = useCallback(
        (event: React.MouseEvent) => {
            if (clickTimeout.current) {
                clearTimeout(clickTimeout.current);
                clickTimeout.current = null;
                onDoubleClick(event);
            } else {
                clickTimeout.current = setTimeout(() => {
                    onClick(event);
                    clickTimeout.current = null;
                }, delay);
            }
        },
        [onClick, onDoubleClick, delay]
    );

    return handler;
}

export function SelectedCandidate({
    task,
    folderHash,
    folderPath,
    ...props
}: {
    task: SerializedTaskState;
    folderHash: string;
    folderPath: string;
} & BoxProps) {
    // Chosen candidate
    const candidate = task.candidates.find(
        (cand) => cand.id === task.chosen_candidate_id
    );
    if (!candidate) {
        throw new Error(
            "No candidate selected. This should not happen for imported tasks."
        );
    }

    return (
        <Box {...props}>
            <Box sx={{ fontWeight: "bold" }}>
                {candidate.info.artist} - {candidate.info.album}
            </Box>
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
                        candidate={candidate}
                        metadata={task.current_metadata}
                    />
                </Box>
                <Box
                    sx={(theme) => ({
                        display: "flex",
                        width: "80px",
                        height: "80px",
                        alignSelf: "center",

                        [theme.breakpoints.down("tablet")]: {
                            width: "100%",
                            height: "auto",
                            alignSelf: "inherit",
                            maxHeight: "200px",
                        },
                    })}
                >
                    <ExternalCoverArt
                        data_url={candidate.info.data_url}
                        sx={{ width: "80px", height: "80px" }}
                    />
                </Box>
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
                    disabled={expandedCandidates.size === task.candidates.length}
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

/* ----------------------------- Trigger import ----------------------------- */

// DEPRECATED: this is not used anymore just for reference
function BottomBar({
    candidates,
    folderHash,
    folderPath,
}: {
    candidates: SerializedCandidateState[];
    folderHash: string;
    folderPath: string;
}) {
    const [duplicateAction, setDuplicateAction] = useState<
        "skip" | "merge" | "keep" | "remove" | null
    >(null);

    const { selected } = useCandidateSelection();

    const selectedCandidate = useMemo(() => {
        return candidates.find((c) => c.id === selected);
    }, [candidates, selected]);

    if (!selectedCandidate) {
        // should not happen!
        return "No candidate selected";
    }
    let duplicateError: string | null = null;
    if (selectedCandidate.duplicate_ids.length > 0 && !duplicateAction) {
        duplicateError = `Please choose an action on how to resolve the duplicates from the library.`;
    }

    const isError = duplicateError !== null;

    return (
        <Box
            sx={{
                width: "100%",
                display: "flex",
                flexDirection: "column",
                justifyContent: "flex-end",
                gap: 0.5,
                mt: 2,
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
                <Typography
                    variant="caption"
                    color="error"
                    display={isError ? "block" : "none"}
                >
                    {duplicateError}
                </Typography>
                <ImportCandidateLabel
                    candidate={selectedCandidate}
                    sx={{ textAlign: "right", display: isError ? "none" : "block" }}
                />
            </Box>
            <Box sx={{ display: "flex", gap: 1 }}>
                <Box sx={{ display: "flex", gap: 1, marginLeft: "auto" }}>
                    {selectedCandidate.duplicate_ids.length > 0 && (
                        <DuplicateActions
                            selectedCandidate={selectedCandidate}
                            duplicateAction={duplicateAction}
                            setDuplicateAction={setDuplicateAction}
                        />
                    )}
                    <ImportCandidateButton
                        candidate={selectedCandidate}
                        duplicateAction={duplicateAction}
                        folderHash={folderHash}
                        folderPath={folderPath}
                    />
                </Box>
            </Box>
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

    const handleClicks = useSingleAndDoubleClick({
        onClick: (e: React.MouseEvent) => {
            e.stopPropagation();
            setSelected(candidate.id);
        },
        onDoubleClick: (e: React.MouseEvent) => {
            e.stopPropagation();
            toggleExpanded(candidate.id);
        },
        delay: 200,
    });

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
    }, [expanded, selected]);

    return useMemo(() => {
        return (
            <CandidateInfoRow
                ref={ref}
                onClick={handleClicks}
                sx={{
                    cursor: "pointer",
                    userSelect: "none",
                    "&:hover": {
                        backgroundColor: "action.hover",
                    },
                }}
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
    }, [expanded, candidateSelected]);
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
    }, [expanded, selected]);

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
    }, []);
}

function AsisCandidateDetails({
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
    const theme = useTheme();

    const expanded = isExpanded(candidate.id);
    const { data: filesMetaData } = useSuspenseQuery(
        fileMetaQueryOptions(
            items.map((item) => item.path).filter((i) => i != undefined)
        )
    );

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
    }, [expanded, selected]);

    return (
        <CandidateDetailsRow ref={ref}>
            <Box
                sx={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 1,
                }}
            >
                {filesMetaData.map((meta, idx) => {
                    return (
                        <Box
                            sx={{
                                padding: theme.spacing(1),
                                borderRadius: theme.spacing(0.5),
                                backgroundColor:
                                    idx % 2 === 0 ? "#00000011" : "#00000044",
                                // borderBottom: "1px solid #515151",
                            }}
                        >
                            <MetaRow meta={meta} />
                        </Box>
                    );
                })}
            </Box>
        </CandidateDetailsRow>
    );
}

function MetaRow({ meta }: { meta: FileMetadata }) {
    const [advanced, setAdvanced] = useState(false);
    return (
        <>
            <MetaBadges meta={meta} advanced={advanced} setAdvanced={setAdvanced} />
            {advanced ? <PropertyValueTable data={meta} /> : null}
        </>
    );
}

function MetaBadges({
    meta,
    advanced,
    setAdvanced,
}: {
    meta: FileMetadata;
    advanced: boolean;
    setAdvanced: (advanced: boolean) => void;
}) {
    const theme = useTheme();

    return (
        <Box
            sx={{
                display: "flex",
                flexDirection: "column",
                gap: 1,
            }}
        >
            <Box
                sx={{
                    display: "flex",
                    flexDirection: "row",
                    gap: 1,
                    flexWrap: "wrap",
                    justifyContent: "flex-start",
                    alignItems: "flex-start",
                    columnGap: 0.5,
                    rowGap: 1,
                }}
            >
                <MetaBadge meta={meta} type={"track"} />
                <MetaBadge meta={meta} type={"title"} />
                <MetaBadge meta={meta} type={"artist"} />
                <MetaBadge meta={meta} type={"album"} />
                <MetaBadge meta={meta} type={"filepath"} />
                <IconButton
                    sx={{ p: 0, color: "inherit" }}
                    onClick={() => {
                        setAdvanced(!advanced);
                    }}
                    size="small"
                >
                    {!advanced ? (
                        <EyeIcon size={theme.iconSize.sm} />
                    ) : (
                        <EyeOffIcon size={theme.iconSize.sm} />
                    )}
                </IconButton>
            </Box>

            {advanced ? null : (
                <Box
                    sx={{
                        display: "flex",
                        flexDirection: "row",
                        gap: 1,
                        flexWrap: "wrap",
                        justifyContent: "flex-start",
                        alignItems: "flex-start",
                        columnGap: 0.5,
                        rowGap: 1,
                    }}
                >
                    <MetaBadge meta={meta} type={"label"} />
                    <MetaBadge meta={meta} type={"genre"} />
                    <MetaBadge meta={meta} type={"year"} />
                    <MetaBadge meta={meta} type={"duration"} />
                    <MetaBadge meta={meta} type={"filesize"} />
                    <MetaBadge meta={meta} type={"bitrate"} />
                    <MetaBadge meta={meta} type={"bpm"} />
                    <MetaBadge meta={meta} type={"identifiers"} />
                    <MetaBadge meta={meta} type={"compilation"} />
                    <MetaBadge meta={meta} type={"lyrics"} />
                    <MetaBadge meta={meta} type={"remaining"} />
                </Box>
            )}
        </Box>
    );
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

                [theme.breakpoints.down("tablet")]: {
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
    sx,
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
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                    ...(Array.isArray(sx) ? sx : [sx]),
                ]}
                onError={() => setError(true)}
                onLoad={() => setLoaded(true)}
                {...props}
            />
        </>
    );
}
