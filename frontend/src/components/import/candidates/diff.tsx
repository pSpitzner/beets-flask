import { Change } from "diff";
import { ArrowRightIcon } from "lucide-react";
import React, {
    createContext,
    Dispatch,
    ReactElement,
    ReactNode,
    SetStateAction,
    useContext,
    useEffect,
    useMemo,
    useState,
} from "react";
import {
    styled,
    SxProps,
    Theme,
    Tooltip,
    useMediaQuery,
    useTheme,
} from "@mui/material";
import Box, { BoxProps } from "@mui/material/Box";

import { useDiff } from "@/components/common/hooks/useDiff";
import { trackLengthRep } from "@/components/common/units/time";
import {
    ItemInfo,
    SerializedCandidateState,
    SerializedTaskState,
    TrackInfo,
} from "@/pythonTypes";

/* ------------------------------- Track Diff ------------------------------- */
// Basically a grid layout showing the changes to all tracks
// In theory we can compare two generic candidates but the current use is always against
// the asis candidate

const TrackChangesGrid = styled(Box)(({ theme }) => ({
    display: "grid",
    width: "min-content",
    gridTemplateColumns: `repeat(7, max-content)`,
    paddingInline: theme.spacing(2),
    fontSize: theme.typography.body2.fontSize,
    lineHeight: 1.25,

    "[data-haschanges=false]": {
        color: theme.palette.diffs.light,
    },

    //Column gap
    "> * > *": {
        paddingInline: theme.spacing(0.75),
    },

    // On mobile the full layout stretches over 2 lines
    [theme.breakpoints.down("tablet")]: {
        gridTemplateColumns: `
            repeat(4, max-content)
        `,

        // Every 5th child spans 2
        "> * > *:nth-of-type(7n)": {
            gridColumn: "span 2",
            justifySelf: "flex-start",
        },
        // Apply Margin to 2nd row in full layout,
        // this seperates the different items
        // we select the first 4 items i.e. [1] t1 ->
        "[data-full=true] > *:nth-of-type(-n+4)": {
            marginTop: theme.spacing(0.75),
        },
        "[data-full=true]:first-of-type > *": {
            marginTop: 0,
        },
    },
}));

type PairChanges = {
    titleHasChanged: boolean;
    timeHasChanged: boolean;
    indexHasChanged: boolean;
    numChanges: number; // how many of the above components changed
};

function didPairChange(
    from: TrackInfo | ItemInfo,
    to: TrackInfo | ItemInfo
): PairChanges {
    const changes = {
        titleHasChanged: from.title !== to.title,
        timeHasChanged: Math.abs((from.length || 0) - (to.length || 0)) > 5,
        indexHasChanged: from.index !== to.index,
    };
    return {
        ...changes,
        numChanges:
            Number(changes.titleHasChanged) +
            Number(changes.timeHasChanged) +
            Number(changes.indexHasChanged),
    };
}

const TrackDiffContext = createContext<{
    extra_items: ItemInfo[];
    extra_tracks: TrackInfo[];
    pairs: Array<[ItemInfo, TrackInfo, PairChanges]>;
    pairs_extended: Array<[ItemInfo | undefined, TrackInfo | undefined, PairChanges]>;
    candidate: SerializedCandidateState;
    items: SerializedTaskState["items"];
    nChanges: number;
} | null>(null);

/** Context provider precomputes
 * some common values for the track diff view
 * which we dont want to recompute.
 */
export function TrackDiffContextProvider({
    children,
    candidate,
    items,
}: {
    children: React.ReactNode;
    candidate: SerializedCandidateState;
    items: SerializedTaskState["items"];
}) {
    // Create Venn diagram
    // items ∩ tracks = pairs
    // items' ∩ tracks = extra_items
    // items ∩ tracks' = extra_tracks
    const { extra_items, extra_tracks, pairs, pairs_extended, nChanges } =
        useMemo(() => {
            const extra_items: ItemInfo[] = [];
            const extra_tracks: TrackInfo[] = [];
            const pairs: Array<[ItemInfo, TrackInfo, PairChanges]> = [];
            let pairs_extended: Array<
                [ItemInfo | undefined, TrackInfo | undefined, PairChanges]
            > = [];
            let nChanges = 0;

            // mapping is a dict of item_idx -> track_idx
            for (const item_idx in candidate.mapping) {
                const track_idx = candidate.mapping[item_idx];
                const item = items[item_idx];
                const track = candidate.tracks[track_idx];
                if (item && track) {
                    const change = didPairChange(item, track);
                    pairs.push([item, track, change]);
                    nChanges += Number(change.numChanges > 0);
                } else {
                    console.warn(
                        `TrackDiffContextProvider: item ${item_idx} or track ${track_idx} not found`
                    );
                }
            }

            // FIXME: could be a bit more efficient with sets
            for (let i = 0; i < candidate.tracks.length; i++) {
                const track = candidate.tracks[i];
                if (!pairs.some(([, other]) => other.index === track.index)) {
                    extra_tracks.push(track);
                }
            }
            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                if (!pairs.some(([other]) => other.index === item.index)) {
                    extra_items.push(item);
                }
            }

            pairs.sort((a, b) => {
                const a_idx = a[1].index ?? 0;
                const b_idx = b[1].index ?? 0;
                if (a_idx < b_idx) return -1;
                if (a_idx > b_idx) return 1;
                return 0;
            });

            // create a list of pairs_extended for all items - track combinations, even where one side cannot be associated
            // with the other. then the missing side should just be undefined.
            // Add all matched pairs
            pairs_extended = structuredClone(pairs);
            extra_tracks.forEach((track) => {
                // we have the convention that missing items/tracks are not changes!
                pairs_extended.push([undefined, track, didPairChange(track, track)]);
            });

            // Sort pairs_extended by canonical track order (right-hand side)
            // Pairs and extra tracks come first (ordered by track index), then extra items at the end
            pairs_extended.sort((a, b) => {
                const a_idx = a[1]!.index ?? 0;
                const b_idx = b[1]!.index ?? 0;
                if (a_idx < b_idx) return -1;
                if (a_idx > b_idx) return 1;
                return 0;
            });

            extra_items.forEach((item) => {
                pairs_extended.push([item, undefined, didPairChange(item, item)]);
            });

            return {
                extra_items,
                extra_tracks,
                pairs,
                pairs_extended,
                nChanges,
            };
        }, [items, candidate]);

    return (
        <TrackDiffContext.Provider
            value={{
                extra_items,
                extra_tracks,
                pairs,
                pairs_extended,
                candidate,
                items,
                nChanges,
            }}
        >
            {children}
        </TrackDiffContext.Provider>
    );
}

export function useTrackDiffContext() {
    const context = useContext(TrackDiffContext);
    if (!context) {
        throw new Error(
            "useTrackDiffContext must be used within a TrackDiffContextProvider"
        );
    }
    return context;
}

export function TrackDiffsAfterImport({
    items,
    candidate,
}: {
    items: SerializedTaskState["items"];
    candidate: SerializedCandidateState;
}) {
    const theme = useTheme();

    // Show all track changes, unmatched tracks and unmatched items
    return (
        <TrackDiffContextProvider candidate={candidate} items={items}>
            <Box
                sx={{
                    display: "flex",
                    flexDirection: "row",
                }}
            >
                <TrackChangesExtended />
            </Box>
        </TrackDiffContextProvider>
    );
}

/** The track diff contains a variety of information.
 *
 * - TrackChanges, shows how items (on disk) are mapped to tracks (from the candidate).
 * - UnmatchedTracks, shows tracks that are not matched to any item.
 * - UnmatchedItems, shows items that are not missing from the candidate.
 */
export function TrackDiffs({
    items,
    candidate,
}: {
    items: SerializedTaskState["items"];
    candidate: SerializedCandidateState;
}) {
    const theme = useTheme();

    if (!candidate.penalties.includes("tracks")) {
        return (
            <Box>
                <TrackChangesGrid
                    sx={{
                        color: theme.palette.diffs.light,
                    }}
                >
                    {candidate.tracks
                        .sort((a) => a.index ?? 0)
                        .map((track, i) => (
                            <TrackRow
                                key={i}
                                index={track.index || 0}
                                title={track.title || ""}
                                time={trackLengthRep(track.length)}
                            />
                        ))}
                </TrackChangesGrid>
            </Box>
        );
    }

    // Show all track changes, unmatched tracks and unmatched items
    return (
        <TrackDiffContextProvider candidate={candidate} items={items}>
            <TrackDiffInner />
        </TrackDiffContextProvider>
    );
}

function TrackDiffInner() {
    const { extra_tracks, extra_items, pairs } = useTrackDiffContext();
    const isDesktop = useMediaQuery((theme) => theme.breakpoints.up("desktop"));

    // sort problematic diffs by number of changes, so big blocks appear first
    const nodes: Array<[React.ReactNode, number]> = [
        [<TrackChanges key={1} />, pairs.length],
        [<ExtraTracks key={2} />, extra_tracks.length],
        [<ExtraItems key={3} />, extra_items.length],
    ];

    // but do not do this on mobile
    if (isDesktop) {
        nodes.sort((a, b) => b[1] - a[1]);
    }

    return (
        <Box
            sx={(theme) => ({
                display: "flex",
                flexDirection: "row",
                rowGap: 0.25,
                columnGap: 1,
                flexWrap: "wrap",
                justifyContent: "space-between",
                "> *": {
                    flexGrow: 1,
                    flexShrink: 0,

                    [theme.breakpoints.down("tablet")]: {
                        minWidth: "100%",
                    },
                },
            })}
        >
            {nodes.map(([node]) => node)}
        </Box>
    );
}

export function ExtraTracks() {
    const { extra_tracks } = useTrackDiffContext();
    const theme = useTheme();
    if (extra_tracks.length === 0) {
        return null;
    }
    return (
        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <TrackChangesGrid
                sx={{
                    color: theme.palette.diffs.light,
                }}
            >
                {extra_tracks.map((track, i) => (
                    <TrackRow
                        key={i}
                        index={track.index || 0}
                        title={track.title || ""}
                        time={trackLengthRep(track.length)}
                    />
                ))}
            </TrackChangesGrid>
        </Box>
    );
}

export function ExtraItems() {
    const { extra_items } = useTrackDiffContext();
    const theme = useTheme();
    if (extra_items.length === 0) {
        return null;
    }
    return (
        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <TrackChangesGrid
                sx={{
                    color: theme.palette.diffs.light,
                }}
            >
                {extra_items.map((item, i) => (
                    <TrackRow
                        key={i}
                        index={item.index || 0}
                        title={item.title || ""}
                        time={trackLengthRep(item.length)}
                    />
                ))}
            </TrackChangesGrid>
        </Box>
    );
}

/** Shows all track changes as a list/grid
 *
 * has to be used inside a TrackDiffContextProvider
 */
export function TrackChanges() {
    const { pairs } = useTrackDiffContext();

    // force major change layout for all rows
    const [titleChange, setTitleChange] = useState(false);

    if (pairs.length === 0) {
        return null;
    }

    return (
        <Box
            sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
            }}
        >
            {/*Changes grid*/}
            <TrackChangesGrid>
                {pairs.map(([item, track, change], i) => (
                    <TrackChangesRow
                        key={i}
                        from={item}
                        to={track}
                        pairChanges={change}
                        forceMajorChange={titleChange}
                        setForceMajorChange={setTitleChange}
                    />
                ))}
            </TrackChangesGrid>
        </Box>
    );
}

/** Shows all track changes, including extra and missing
 *
 * has to be used inside a TrackDiffContextProvider
 */
export function TrackChangesExtended() {
    const { pairs, pairs_extended, items, extra_items, extra_tracks } =
        useTrackDiffContext();

    const theme = useTheme();

    console.log("Extra items", extra_items);
    console.log("Extra tracks", extra_tracks);
    console.log("items", items);
    console.log("pairs", pairs);

    // create a list of pairs_extended for all items - track combinations, even where one side cannot be associated
    // with the other. then the missing side should just be undefined.

    if (pairs.length === 0) {
        return null;
    }

    return (
        <Box
            sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
            }}
        >
            {/*Changes grid*/}
            <TrackChangesGrid>
                {pairs_extended.map(([item, track, change], i) =>
                    // only use this component if both item and track are defined
                    item && track ? (
                        <TrackChangesRow
                            key={i}
                            from={item}
                            to={track}
                            pairChanges={change}
                            forceMajorChange={false}
                        />
                    ) : (
                        <TrackChangesRowOneNotFound
                            key={i}
                            from={item}
                            to={track}
                            pairChanges={change}
                            forceMajorChange={false}
                        />
                    )
                )}
            </TrackChangesGrid>
        </Box>
    );
}

interface GenericDetailsItemProps extends BoxProps {
    icon: ReactElement;
    children?: ReactNode;
    tooltip?: string;
    label?: ReactNode;
    sx?: SxProps<Theme>;
    iconColor?: string;
    labelColor?: string;
}

export function GenericDetailsItem({
    icon,
    children,
    tooltip,
    label,
    sx,
    iconColor,
    labelColor,
    ...props
}: GenericDetailsItemProps) {
    // Show tooltip on hover of label row
    let ToolTipComp = ({ children }: { children: ReactElement }) => <>{children}</>;
    if (tooltip) {
        ToolTipComp = ({ children }: { children: ReactElement }) => (
            <Tooltip title={tooltip}>{children}</Tooltip>
        );
    }

    // label is string or number
    if ((label && typeof label === "string") || typeof label === "number") {
        label = (
            <Box
                component="span"
                sx={{
                    color: labelColor || "inherit",
                    // TODO: include icon in click, and make this more generic
                    cursor: "pointer",
                }}
            >
                {label}
            </Box>
        );
    }

    if (!label) {
        label = <Box component="span">Unknown</Box>;
    }

    return (
        <Box
            sx={[
                {
                    display: "flex",
                    alignItems: "center",
                    gap: 0.5,
                    height: "20px",
                },
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                ...(Array.isArray(sx) ? sx : [sx]),
            ]}
            {...props}
        >
            {/*Heading/content row*/}
            <ToolTipComp>
                <Box display="flex" gap={1} alignItems="center">
                    <Box
                        sx={(theme) => ({
                            display: "flex",
                            justifyContent: "center",
                            alignItems: "center",

                            width: theme.iconSize.sm,
                            height: theme.iconSize.sm,
                            color: iconColor || "inherit",
                        })}
                    >
                        {icon}
                    </Box>
                    {label}
                </Box>
            </ToolTipComp>
            {children}
        </Box>
    );
}

export function GenericDetailsItemWithDiff({
    from,
    to,
    icon,
    tooltip,
    children,
    sx,
}: {
    from?: string | null;
    to?: string | null;
    icon: ReactElement;
    tooltip?: string;
    children?: ReactNode;
    sx?: SxProps<Theme>;
}) {
    const { fromParts, toParts, diff } = useDiffParts(from, to);

    return (
        <GenericDetailsItem
            icon={icon}
            tooltip={tooltip}
            label={
                <StyledDiff
                    fromParts={fromParts}
                    toParts={toParts}
                    diff={diff}
                    threshold={0.8}
                />
            }
            iconColor={undefined}
            sx={sx}
        >
            {children}
        </GenericDetailsItem>
    );
}

function TrackRow({
    index,
    title,
    time,
}: {
    index: number;
    title: string;
    time: string;
}) {
    return (
        <Box
            sx={{
                display: "grid",
                gridColumn: "1 / -1",
                gridTemplateColumns: "subgrid",
            }}
        >
            {/* Index */}
            <Box
                sx={{
                    color: "inherit",
                    textAlign: "right",
                }}
            >
                {index}
            </Box>

            {/* Title */}
            <Box
                sx={{
                    textAlign: "right",
                    display: "flex",
                }}
            >
                {title}
            </Box>

            {/* Length */}
            <Box
                sx={{
                    color: "inherit",
                    textAlign: "right",
                }}
            >
                {time}
            </Box>
        </Box>
    );
}

/**
 * Wrapper around TrackChangesRow that handles undefined `from` or `to` values.
 * (indicating a missing item or missing track, respectively).
 */
function TrackChangesRowOneNotFound({
    from,
    to,
    pairChanges,
    forceMajorChange,
    setForceMajorChange,
}: {
    from?: ItemInfo;
    to?: TrackInfo | ItemInfo;
    pairChanges?: PairChanges;
    forceMajorChange: boolean;
    setForceMajorChange?: (value: boolean) => void;
}) {
    if (!from && !to) {
        // both are undefined, we cannot render anything
        return null;
    }

    let fixedFrom: ItemInfo;
    let fixedTo: ItemInfo | TrackInfo;
    // simply map the missing item to the present one,
    // then no changes visible.
    if (!from) {
        fixedTo = to as TrackInfo;
        fixedFrom = to as ItemInfo;
    } else {
        fixedTo = from;
        fixedFrom = from;
    }

    return TrackChangesRow({
        from: fixedFrom,
        to: fixedTo,
        pairChanges: pairChanges,
        forceMajorChange,
        setForceMajorChange,
        sx: {
            // TODO: how to disable custom styling of nested children?
            color: "red !important",
        },
    });
}

function TrackChangesRow({
    from,
    to,
    pairChanges,
    forceMajorChange,
    setForceMajorChange = () => {},
    sx = {},
}: {
    from: ItemInfo;
    to: TrackInfo | ItemInfo;
    pairChanges?: PairChanges;
    // HACK: React-Anti-Pattern: we do a computation in each row that we need to set
    // the state of all rows
    forceMajorChange: boolean;
    setForceMajorChange?: (value: boolean) => void;
    sx?: SxProps<Theme>;
}) {
    // FIXME: the backend types seem wrong, why optional?
    const theme = useTheme();

    const { fromParts, toParts, diff } = useDiffParts(from.title || "", to.title || "");

    const fromD = {
        time: trackLengthRep(from.length),
        idx: from.index ?? 0,
        data: fromParts,
        color: theme.palette.diffs.removed,
        type: "from",
    };
    const toD = {
        time: trackLengthRep(to.length),
        idx: to.index ?? 0,
        data: toParts,
        color: theme.palette.diffs.added,
        type: "to",
    };

    pairChanges = pairChanges || didPairChange(from, to);

    const hasChanges =
        pairChanges.titleHasChanged ||
        pairChanges.timeHasChanged ||
        pairChanges.indexHasChanged;

    /* ---------------------------- Major changes --------------------------- */

    // TODO: this is a bit harder to move to the context. we do not want to
    // compute the text-level diff for each row twice (probably expensive)
    // depending on the number of changes we render a slightly different row
    // major change shows changes with arrow i.e. [1] t1 -> [2] t2
    useEffect(() => {
        // if there is a major change in the title, we force the major change layout
        // for all rows
        if (pairChanges.titleHasChanged) {
            //Count changed chars vs unchanged
            let total = 0;
            let changed = 0;
            for (let i = 0; i < diff.length; i++) {
                const part = diff[i];
                total += part.count ?? 0;
                if (part.added || part.removed) {
                    changed += part.count ?? 0;
                }
            }
            // If the change is more than 75% we consider it a major change
            // otherwise we consider it a minor change
            if (changed / total > 0.75) {
                setForceMajorChange(true);
            }
        }
    }, [pairChanges.titleHasChanged, diff, setForceMajorChange]);

    if (forceMajorChange) {
        return (
            <Box
                sx={{ ...sx, display: "contents" }}
                data-haschanges={hasChanges}
                data-full={true}
            >
                {/* index */}
                <Box
                    sx={{
                        color: pairChanges.titleHasChanged
                            ? fromD.color
                            : theme.palette.diffs.light,
                        justifyContent: "flex-end",
                        textAlign: "right",
                    }}
                >
                    {fromD.idx}
                </Box>

                {/* title and time */}
                <Box>{fromD.data}</Box>
                <Box
                    sx={{
                        display: "flex",
                        justifyContent: "flex-begin",
                        color: pairChanges.timeHasChanged
                            ? fromD.color
                            : theme.palette.diffs.light,
                    }}
                >
                    {fromD.time}
                </Box>

                {/* change arrow */}
                <Box
                    sx={{
                        paddingInline: 1,
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                    }}
                >
                    <ArrowRightIcon
                        size={theme.iconSize.xs}
                        color={theme.palette.diffs.changed}
                    />
                </Box>

                {/* index */}
                <Box
                    sx={{
                        color: pairChanges.indexHasChanged
                            ? toD.color
                            : theme.palette.diffs.light,
                        textAlign: "right",
                    }}
                >
                    {toD.idx}
                </Box>

                {/* title and time */}
                <Box>{toD.data}</Box>
                <Box
                    sx={{
                        justifyContent: "flex-end",
                        display: "flex",
                        color: pairChanges.timeHasChanged
                            ? toD.color
                            : theme.palette.diffs.light,
                    }}
                >
                    {toD.time}
                </Box>
            </Box>
        );
    }

    /* ---------------------------- Minor changes --------------------------- */

    // Minor changes show only the changed title or change value
    // i.e. [1] t1 -> t2
    // or [1] -> [2] t1
    // no changes
    return (
        <Box
            sx={{
                ...sx,
                display: "grid",
                gridColumn: "1 / -1",
                gridTemplateColumns: "subgrid",
            }}
            data-haschanges={hasChanges}
        >
            {/* index */}
            <Box
                sx={{
                    textAlign: "right",
                    display: "grid",
                    gap: 0.5,
                    justifyContent: "flex-end",
                    // Dynamically set the subgrid if there is a index change
                    // this aligns the indexs
                    //        [2]
                    // [2] -> [3]
                    gridTemplateColumns: pairChanges.indexHasChanged
                        ? "1fr auto 1fr"
                        : "auto",
                    alignItems: "center",
                }}
            >
                {pairChanges.indexHasChanged && (
                    <>
                        <Box
                            sx={{
                                color: fromD.color,
                                textAlign: "right",
                            }}
                        >
                            {fromD.idx}
                        </Box>
                        <ArrowRightIcon
                            size={theme.iconSize.xs}
                            color={theme.palette.diffs.changed}
                        />
                    </>
                )}
                <Box
                    sx={{
                        color: pairChanges.indexHasChanged
                            ? toD.color
                            : theme.palette.diffs.light,
                    }}
                >
                    {toD.idx}
                </Box>
            </Box>

            {/*Title has no changes in mimal*/}
            <Box
                sx={{
                    textAlign: "right",
                    display: "flex",
                    color: pairChanges.titleHasChanged
                        ? "inherit"
                        : theme.palette.diffs.light,
                }}
            >
                {diff.map((part, index) => (
                    <Box
                        key={index}
                        sx={(theme) => ({
                            color: part.added
                                ? theme.palette.diffs.added
                                : part.removed
                                  ? theme.palette.diffs.removed
                                  : "inherit",

                            textDecoration: part.removed ? "line-through" : "none",
                        })}
                        component="span"
                    >
                        {part.value}
                    </Box>
                ))}
            </Box>

            {/* Length might have changed */}
            <Box
                sx={{
                    textAlign: "right",
                    display: "grid",
                    gap: 0.5,
                    justifyContent: "flex-end",
                    gridTemplateColumns: pairChanges.timeHasChanged
                        ? "1fr auto 1fr"
                        : "auto",
                    alignItems: "center",
                }}
            >
                {pairChanges.timeHasChanged && (
                    <>
                        <Box
                            sx={{
                                color: pairChanges.timeHasChanged
                                    ? fromD.color
                                    : "inherit",
                                textAlign: "right",
                            }}
                        >
                            {fromD.time}
                        </Box>
                        <ArrowRightIcon
                            size={theme.iconSize.xs}
                            color={theme.palette.diffs.changed}
                        />
                    </>
                )}
                <Box
                    sx={{
                        color: pairChanges.timeHasChanged
                            ? toD.color
                            : theme.palette.diffs.light,
                        textAlign: "right",
                    }}
                >
                    {toD.time}
                </Box>
            </Box>
        </Box>
    );
}

/* ------------------------------ Generic Diff ------------------------------ */

function useDiffParts(
    from?: string | null,
    to?: string | null,
    method?: "chars" | "words" | "wordsWithSpace" | "full" | "auto"
) {
    const diff = useDiff(from, to, method);

    // Construct a from and to element
    const fromParts: React.ReactNode[] = [];
    const toParts: React.ReactNode[] = [];

    let hasAdded = false;
    let hasRemoved = false;

    diff.forEach((part, index) => {
        const span = (
            <Box
                key={index}
                sx={(theme) => ({
                    color: part.added
                        ? theme.palette.diffs.added
                        : part.removed
                          ? theme.palette.diffs.removed
                          : theme.palette.text.primary,
                })}
                component="span"
            >
                {part.value}
            </Box>
        );

        if (part.added) {
            toParts.push(span);
            hasAdded = true;
        } else if (part.removed) {
            fromParts.push(span);
            hasRemoved = true;
        } else {
            fromParts.push(span);
            toParts.push(span);
        }
    });

    return { fromParts, toParts, hasAdded, hasRemoved, diff };
}

export function GenericDiff({
    from,
    to,
    method,
    icon,
}: {
    from?: string | null;
    to: string;
    method?: "chars" | "words" | "wordsWithSpace" | "full" | "auto";
    icon?: React.ReactNode;
}) {
    if (!from) {
        from = "";
    }

    const { fromParts, toParts, hasAdded, hasRemoved, diff } = useDiffParts(
        from,
        to,
        method
    );

    return (
        <Box
            sx={{
                display: "flex",
                flexDirection: "row",
                gap: 0.5,
                alignItems: "center",
            }}
        >
            <Box
                sx={(theme) => ({
                    color:
                        hasAdded || hasRemoved
                            ? theme.palette.diffs.changed
                            : theme.palette.text.primary,
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",

                    // Define the size of the icon
                    " > *": {
                        width: theme.iconSize.sm,
                        height: theme.iconSize.sm,
                    },
                })}
            >
                {icon}
            </Box>
            <StyledDiff
                fromParts={fromParts}
                toParts={toParts}
                diff={diff}
                threshold={0.8}
            />
        </Box>
    );
}

/** Simple string styling and diffing of two strings.
 *
 * Very similar to git diff. If the two strings are very different
 * it will show the diff as a single line with an arrow in between.
 *
 * Usage:
 * ```
 * const { fromParts, toParts, diff } = useDiffParts(from, to);
 * <StyledDiff from={fromParts} to={toParts} diff={diff} />
 */
export function StyledDiff({
    fromParts,
    toParts,
    diff,
    threshold = 0.8,
    ...props
}: {
    fromParts: ReactNode[];
    toParts: ReactNode[];
    diff: Change[];
    threshold?: number;
} & BoxProps) {
    const theme = useTheme();

    const majorChange = useMemo(() => {
        //Count changed chars vs unchanged
        //FIXME: This should be a generic function and not copy pasted
        let total = 0;
        let changed = 0;
        for (let i = 0; i < diff.length; i++) {
            const part = diff[i];
            total += part.count ?? 0;
            if (part.added || part.removed) {
                changed += part.count ?? 0;
            }
        }

        return changed / total > threshold && diff.length > 1;
    }, [diff, threshold]);

    if (fromParts.length === 0 && toParts.length === 0) {
        return (
            <Box sx={{ lineHeight: 1.25 }} {...props}>
                Unknown
            </Box>
        );
    }

    return (
        <Box sx={{ lineHeight: 1.25 }} {...props}>
            {majorChange && fromParts.length > 0 && toParts.length > 0 ? (
                <>
                    {fromParts}
                    <ArrowRightIcon
                        size={theme.iconSize.xs}
                        color={theme.palette.diffs.changed}
                    />
                    {toParts}
                </>
            ) : (
                diff.map((part, index) => (
                    <Box
                        key={index}
                        sx={(theme) => ({
                            color: part.added
                                ? theme.palette.diffs.added
                                : part.removed
                                  ? theme.palette.diffs.removed
                                  : "inherit",

                            textDecoration: part.removed ? "line-through" : "none",
                        })}
                        component="span"
                    >
                        {part.value}
                    </Box>
                ))
            )}
        </Box>
    );
}
