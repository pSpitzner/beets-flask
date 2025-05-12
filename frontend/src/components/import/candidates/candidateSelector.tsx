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
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import {
    ButtonGroup,
    Chip,
    ChipProps,
    Divider,
    Grid,
    IconButton,
    Radio,
    Skeleton,
    Stack,
    styled,
    SxProps,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    Theme,
    Tooltip,
    Typography,
    useTheme,
} from "@mui/material";
import Box, { BoxProps } from "@mui/material/Box";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";

import { FileMetadata, fileMetaQueryOptions } from "@/api/inbox";
import { Search } from "@/components/common/inputs/search";
import { isLikelyBlob } from "@/components/common/units/bytes";
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

    const expanded = isExpanded(candidate.id);
    const { data } = useSuspenseQuery(
        fileMetaQueryOptions(
            items.map((item) => item.path).filter((i) => i != undefined)
        )
    );

    // TODO: multiple files?
    const meta = data[0];

    // Filtering logic
    const [filter, setFilter] = useState<string>("");
    const filteredMeta = useMemo(() => {
        return Object.entries(meta).filter(
            ([key, value]) => key.includes(filter) || String(value).includes(filter)
        );
    }, [meta, filter]);
    const nExcluded = Object.entries(meta).length - filteredMeta.length;

    // I created an empty file, and these keys we
    // we still got -> make badges?:

    // filename	/music/inbox/Annix/Antidote/empty.flac
    // filesize	30929699
    // duration	224.77544217687074
    // channels	2
    // bitrate	1100.821289032531
    // bitdepth	16
    // samplerate	44100

    // then make badges for some common sense keys:
    // here grabbed from id3 as written by beets.
    // likely, we will have less. check with something from
    // beatport or so!

    // ARTIST (merge / combine / prio/ info from below fields)
    // artist	Annix
    // composer	Annix
    // album artist	Annix
    // album_artist	Annix
    // albumartist	Annix
    // albumartist_credit	Annix
    // albumartistsort	Annix
    // artist_credit	Annix
    // artistsort	Annix

    // ALBUM
    // album	Antidote

    // TITLE
    // title	Antidote

    // LABEL
    // label	DnB Allstars Records
    // publisher	DnB Allstars Records

    // GENRE
    // genre	Drum And Bass, Electronic

    // catalog_number	DNBA015
    // isrc	GB8KE2159647

    // DATE
    // year	2021-02-19
    // originaldate	2021-02-19
    // _year	2021

    // DISC STATS
    // compilation	0
    // disc	1
    // disc_total	1
    // _disc	1
    // discc	1
    // track	1
    // track_total	1
    // _track	1
    // trackc	1
    // media	Digital Media

    // TLDR
    // copyright	℗ 2021 Copyright Control
    // releasestatus	Official
    // releasetype	s
    // bpm	0
    // releasecountry	XW
    // language	eng
    // musicbrainz_albumstatus	Official
    // musicbrainz_albumtype	s
    // musicbrainz_albumartistid	b7c65173-4a6c-4add-b468-7e16c0833038
    // musicbrainz_albumid	a25664c1-6db7-43db-9e32-1f1f249dbecc
    // musicbrainz_artistid	b7c65173-4a6c-4add-b468-7e16c0833038
    // musicbrainz_releasegroupid	b3db3a9c-9ca8-4437-b469-0a5208ce49f9
    // musicbrainz_releasetrackid	8c850a41-d891-4050-9111-ef0201eb8cba
    // musicbrainz_trackid	6cc80949-2152-4b94-ba8d-7de353f172ef
    // script	Latn

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
            <Stack
                direction="row"
                sx={{
                    justifyContent: "flex-start",
                    alignItems: "flex-start",
                }}
            >
                <MetaArtist meta={meta} />
                <MetaAlbum meta={meta} />
                <MetaLabel meta={meta} />
                <MetaGenre meta={meta} />
                <MetaYear meta={meta} />
            </Stack>

            <Box
                sx={{
                    overflow: "auto",
                    width: "100%",
                    maxHeight: "400px",
                    height: "100%",
                }}
            >
                {/* <JSONPretty data={data[0]} /> */}
                <Table
                    size="small"
                    sx={{
                        //display: "grid",
                        width: "100%",
                        borderCollapse: "separate",
                        maxHeight: "400px",
                        height: "100%",
                        //tableLayout: "fixed",
                        td: {
                            //overflowWrap: "break-word",
                            maxHeight: "200px",
                            maxWidth: "100%",
                        },
                        position: "relative",
                        //thicker border bottom for head
                        thead: {
                            fontWeight: "bold",
                            fontSize: "0.95rem",
                            verticalAlign: "bottom",
                            top: 0,
                            position: "sticky",
                            th: { border: "unset" },
                            "> *:last-child > th": {
                                borderBottomWidth: 2,
                                borderBottomStyle: "solid",
                                borderBottomColor: "#515151",
                            },
                        },
                    }}
                >
                    <TableHead>
                        <TableRow
                            sx={(theme) => ({
                                display: "none",
                                [theme.breakpoints.down("tablet")]: {
                                    display: "table-row",
                                },
                            })}
                        >
                            <TableCell colSpan={3}>
                                <Search
                                    size="small"
                                    value={filter}
                                    setValue={setFilter}
                                    sx={{
                                        marginTop: 1,
                                        p: 0,
                                        height: "100%",
                                        width: "100%",
                                    }}
                                    color="secondary"
                                />
                            </TableCell>
                        </TableRow>
                        <TableRow>
                            <TableCell sx={{ width: "auto" }}>Property</TableCell>
                            <TableCell sx={{ width: "50%" }}>Value</TableCell>
                            <TableCell
                                sx={(theme) => ({
                                    width: "50%",
                                    textAlign: "right",
                                    [theme.breakpoints.down("tablet")]: {
                                        display: "none",
                                    },
                                })}
                            >
                                <Search
                                    size="small"
                                    value={filter}
                                    setValue={setFilter}
                                    sx={{
                                        p: 0,
                                        height: "100%",
                                        maxWidth: "300px",
                                        input: {
                                            paddingBlock: 0.5,
                                        },
                                    }}
                                    color="secondary"
                                />
                            </TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {filteredMeta.map(([key, value]) => (
                            <TableRow key={key}>
                                <TableCell
                                    sx={{
                                        width: "max-content",
                                        verticalAlign: "top",
                                    }}
                                >
                                    {key}
                                </TableCell>
                                <TableCell colSpan={2}>
                                    <Box
                                        sx={{
                                            overflow: "auto",
                                            maxHeight: "200px",
                                            overflowWrap: "anywhere",
                                            maxWidth: "100%",
                                        }}
                                    >
                                        {String(value)}
                                    </Box>
                                </TableCell>
                            </TableRow>
                        ))}
                        {nExcluded > 0 && (
                            <TableRow>
                                <TableCell colSpan={3}>
                                    <Typography
                                        variant="caption"
                                        color="text.secondary"
                                        sx={{
                                            textAlign: "center",
                                            fontStyle: "italic",
                                        }}
                                    >
                                        {nExcluded} more properties excluded via filter
                                    </Typography>
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </Box>
        </CandidateDetailsRow>
    );
}

function MetaArtist({ meta }: { meta: FileMetadata }) {
    const theme = useTheme();
    const keys = [
        "artist",
        "composer",
        "album_artist",
        "albumartist",
        "albumartistsort",
        "artist_credit",
        "artistsort",
    ];
    const icon = <PenaltyTypeIcon type="artist" size={theme.iconSize.xs} />;
    return <MetaBadge meta={meta} keys={keys} icon={icon} />;
}
function MetaAlbum({ meta }: { meta: FileMetadata }) {
    const theme = useTheme();
    const keys = ["album"];
    const icon = <PenaltyTypeIcon type="album" size={theme.iconSize.xs} />;
    return <MetaBadge meta={meta} keys={keys} icon={icon} />;
}
function MetaLabel({ meta }: { meta: FileMetadata }) {
    const theme = useTheme();
    const keys = ["label", "publisher"];
    const icon = <PenaltyTypeIcon type="label" size={theme.iconSize.xs} />;
    return <MetaBadge meta={meta} keys={keys} icon={icon} />;
}
function MetaGenre({ meta }: { meta: FileMetadata }) {
    const theme = useTheme();
    const keys = ["genre"];
    const icon = <PenaltyTypeIcon type="genre" size={theme.iconSize.xs} />;
    return <MetaBadge meta={meta} keys={keys} icon={icon} />;
}
function MetaYear({ meta }: { meta: FileMetadata }) {
    const theme = useTheme();
    const keys = ["_year", "year", "originaldate"];
    const icon = <PenaltyTypeIcon type="year" size={theme.iconSize.xs} />;
    return <MetaBadge meta={meta} keys={keys} icon={icon} />;
}

function MetaBadge({
    meta,
    keys,
    icon,
    ...props
}: {
    meta: FileMetadata;
    keys: string[];
    icon: JSX.Element;
} & ChipProps) {
    const filtered = Object.fromEntries(
        Object.entries(meta)
            .filter(([k, v]) => keys.includes(k) && v !== undefined)
            .sort(([a], [b]) => keys.indexOf(a) - keys.indexOf(b))
    );

    const label = Object.values(filtered)[0];
    if (!label) return null;

    return (
        <Tooltip
            title={
                <Grid container spacing={0.5}>
                    {Object.entries(filtered).map(([k, v]) => (
                        <>
                            <Grid size={5} sx={{ textAlign: "right" }}>
                                {k}:
                            </Grid>
                            <Grid size={5} sx={{ textAlign: "left" }}>
                                {v}
                            </Grid>
                        </>
                    ))}
                </Grid>
            }
        >
            <Chip size="small" icon={icon} label={label} {...props} />
        </Tooltip>
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
