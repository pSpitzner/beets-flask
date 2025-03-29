import Box from "@mui/material/Box";
import { Disambiguation } from "./details";
import {
    ItemInfo,
    SerializedCandidateState,
    SerializedTaskState,
    TrackInfo,
} from "@/pythonTypes";
import { useDiff } from "@/components/common/hooks/useDiff";
import { PenaltyTypeIcon } from "@/components/common/icons";
import { ArrowRightIcon, EyeIcon, EyeOffIcon } from "lucide-react";
import useTheme from "@mui/material/styles/useTheme";
import { IconButton, styled } from "@mui/material";
import { trackLength } from "@/components/common/units/time";
import { ReactNode, useEffect, useState } from "react";

/* ----------------------------- Candidate Diff ----------------------------- */

// detailed info
export function CandidateDiff({
    items,
    metadata,
    candidate,
}: {
    items: SerializedTaskState["items"];
    metadata: SerializedTaskState["current_metadata"];
    candidate: SerializedCandidateState;
}) {
    const [showAll, setShowAll] = useState(false);
    const theme = useTheme();

    return (
        <Box>
            <Disambiguation candidate={candidate} />

            {/* Artist */}
            <GenericDiff
                from={metadata.artist || "Unknown artist"}
                to={candidate.info.artist || "Unknown artist"}
                icon={<PenaltyTypeIcon type="artist" />}
            />

            {/* Album */}
            <GenericDiff
                from={metadata.album || "Unknown album"}
                to={candidate.info.album || "Unknown album"}
                icon={<PenaltyTypeIcon type="album" />}
            />

            {/* Tracks */}
            <Box>
                {candidate.penalties.includes("tracks") ? (
                    <Box
                        sx={{
                            "[data-hasChanges=false]": {
                                display: showAll ? undefined : "none",
                            },
                        }}
                    >
                        <Box
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 0.5,
                                color: theme.palette.diffs.changed,
                            }}
                        >
                            <PenaltyTypeIcon type="tracks" size={theme.iconSize.sm} />
                            <Box>Track changes</Box>
                            <IconButton
                                sx={{ p: 0, color: "inherit", marginLeft: "auto" }}
                                onClick={() => setShowAll((prev) => !prev)}
                                size="small"
                            >
                                {!showAll ? (
                                    <EyeIcon size={theme.iconSize.sm} />
                                ) : (
                                    <EyeOffIcon size={theme.iconSize.sm} />
                                )}
                            </IconButton>
                        </Box>
                        <TrackChanges
                            items={items}
                            tracks={candidate.tracks}
                            mapping={candidate.mapping}
                        />
                    </Box>
                ) : (
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                        <PenaltyTypeIcon type="tracks" size={theme.iconSize.sm} />
                        <Box>No severe track changes</Box>
                    </Box>
                )}
            </Box>
        </Box>
    );
}

/* ------------------------------- Track Diff ------------------------------- */
// Basically a grid layout showing the changes to all tracks
// In theory we can compare two generic candidates but the current use is always against
// the asis candidate

const TrackChangesGrid = styled(Box)(({ theme }) => ({
    display: "grid",
    width: "min-content",
    gridTemplateColumns: `
        [index-from] max-content
        [title-from] max-content
        [length-from] max-content
        [change-arrow] max-content
        [index-to] max-content
        [title-to] max-content
        [length-to] max-content
    `,
    paddingInline: theme.spacing(2),
    fontSize: "0.875rem",
    lineHeight: 1.25,

    //Column gap
    "> * > *": {
        paddingInline: theme.spacing(0.75),
    },
}));

/** Shows all track changes as a list/grid */
function TrackChanges({
    items,
    tracks,
    mapping,
}: {
    items: ItemInfo[];
    tracks: TrackInfo[];
    mapping: SerializedCandidateState["mapping"];
}) {
    // Title change variable
    // force major change layout for all rows
    const [titleChange, setTitleChange] = useState(false);

    // create venn diagram
    let extra_items = [];
    let extra_tracks = [];
    let pairs: Array<[ItemInfo, TrackInfo]> = [];
    //const changes;

    // mapping is a dict of item_idx -> track_idx
    for (const item_idx in mapping) {
        const track_idx = mapping[item_idx];
        const item = items[item_idx];
        const track = tracks[track_idx];
        if (item && track) {
            pairs.push([item, track]);
        } else if (item) extra_items.push(item);
        else if (track) extra_tracks.push(track);
    }

    pairs.sort((a, b) => {
        const a_idx = a[1].index ?? 0;
        const b_idx = b[1].index ?? 0;
        if (a_idx < b_idx) return -1;
        if (a_idx > b_idx) return 1;
        return 0;
    });

    return (
        <TrackChangesGrid>
            {pairs.map(([item, track]) => (
                <TrackDiffRow
                    key={item.track}
                    from={item}
                    to={track}
                    forceMajorChange={titleChange}
                    setForceMajorChange={setTitleChange}
                />
            ))}
        </TrackChangesGrid>
    );
}

function TrackDiffRow({
    from,
    to,
    forceMajorChange,
    setForceMajorChange,
}: {
    from: ItemInfo;
    to: TrackInfo;
    forceMajorChange: boolean;
    setForceMajorChange: (value: boolean) => void;
}) {
    // FIXME: the backend types seem wrong, why optional?
    const theme = useTheme();
    const { fromParts, toParts, diff } = useDiffParts(from.title || "", to.title || "");

    const fromD = {
        time: trackLength(from.length),
        idx: from.track ?? 0,
        data: fromParts,
        color: theme.palette.diffs.removed,
        type: "from",
    };
    const toD = {
        time: trackLength(to.length),
        idx: to.index ?? 0,
        data: toParts,
        color: theme.palette.diffs.added,
        type: "to",
    };

    const changed = {
        title: from.title !== to.title,
        time: fromD.time !== toD.time,
        index: from.track !== to.index,
    };

    const hasChanges = changed.title || changed.time || changed.index;

    useEffect(() => {
        // if there is a major change in the title, we force the major change layout
        // for all rows
        if (changed.title) {
            //Count changed chars vs unchanged
            let total = 0;
            let changed = 0;
            for (let i = 0; i < diff.length; i++) {
                const part = diff[i]!;
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
    }, [changed.title, diff]);

    // depending on the number of changes we render a slightly different row
    // major change shows changes with arrow i.e. [1] t1 -> [2] t2
    if (forceMajorChange) {
        return (
            <Box sx={{ display: "contents" }} data-hasChanges={hasChanges}>
                <Box
                    sx={{
                        gridColumn: "index-from",
                        color: changed.index ? fromD.color : "inherit",
                        justifyContent: "flex-end",
                        textAlign: "right",
                    }}
                    data-column="index-from"
                >
                    {fromD.idx}
                </Box>
                <Box sx={{ gridColumn: "title-from" }}>{fromD.data}</Box>
                <Box
                    sx={{
                        gridColumn: "length-from",
                        display: changed.time ? "flex" : "none",
                        justifyContent: "flex-begin",
                        color: changed.time ? fromD.color : "inherit",
                    }}
                >
                    {fromD.time}
                </Box>
                <Box
                    sx={{
                        gridColumn: "change-arrow",
                        paddingInline: 1,
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                    }}
                >
                    <ArrowRightIcon size={theme.iconSize.xs} />
                </Box>
                <Box
                    sx={{
                        gridColumn: "index-to",
                        color: changed.index ? toD.color : "inherit",
                        textAlign: "right",
                    }}
                >
                    {toD.idx}
                </Box>
                <Box sx={{ gridColumn: "title-to" }}>{toD.data}</Box>
                <Box
                    sx={{
                        gridColumn: "length-to",
                        justifyContent: "flex-end",
                        display: "flex",
                        color: changed.time ? toD.color : "inherit",
                    }}
                >
                    {toD.time}
                </Box>
            </Box>
        );
    }

    // Minor changes show only the changed title or change value
    // i.e. [1] t1 -> t2
    // or [1] -> [2] t1
    // no changes
    return (
        <Box
            sx={{
                display: "grid",
                gridColumn: "1 / -1",
                gridTemplateColumns: "subgrid",
            }}
            data-hasChanges={hasChanges}
        >
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
                    gridTemplateColumns: changed.index ? "1fr auto 1fr" : "auto",
                    alignItems: "center",
                }}
            >
                {changed.index && (
                    <>
                        <Box
                            sx={{
                                color: fromD.color,
                                textAlign: "right",
                            }}
                        >
                            {fromD.idx}
                        </Box>
                        <ArrowRightIcon size={theme.iconSize.xs} />
                    </>
                )}
                <Box
                    sx={{
                        color: changed.index ? toD.color : "inherit",
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
                                  : theme.palette.text.primary,

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
                    gridTemplateColumns: changed.time ? "1fr auto 1fr" : "auto",
                    alignItems: "center",
                }}
            >
                {changed.time && (
                    <>
                        <Box
                            sx={{
                                color: changed.time ? fromD.color : "inherit",
                                textAlign: "right",
                            }}
                        >
                            {fromD.time}
                        </Box>
                        <ArrowRightIcon size={theme.iconSize.xs} />
                    </>
                )}
                <Box
                    sx={{
                        color: changed.time ? toD.color : "inherit",
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
    from: string,
    to: string,
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

function GenericDiff({
    from,
    to,
    method,
    icon,
}: {
    from: string;
    to: string;
    method?: "chars" | "words" | "wordsWithSpace" | "full" | "auto";
    icon?: React.ReactNode;
}) {
    const { fromParts, toParts, hasAdded, hasRemoved } = useDiffParts(from, to, method);
    const theme = useTheme();

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
            <Box
                sx={{
                    display: "flex",
                    flexDirection: "row",
                    gap: 0.5,
                    alignItems: "center",
                }}
            >
                {hasAdded || hasRemoved ? (
                    <>
                        {fromParts}
                        <ArrowRightIcon size={theme.iconSize.xs} />
                        {toParts}
                    </>
                ) : (
                    <>{toParts}</>
                )}
            </Box>
        </Box>
    );
}
