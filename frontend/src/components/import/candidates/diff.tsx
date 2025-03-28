import Box from "@mui/material/Box";
import { Disambiguation } from "./details";
import { SerializedCandidateState, TrackInfo } from "@/pythonTypes";
import { useDiff } from "@/components/common/hooks/useDiff";
import { PenaltyTypeIcon } from "@/components/common/icons";
import { ArrowRightIcon } from "lucide-react";
import useTheme from "@mui/material/styles/useTheme";
import { styled } from "@mui/material";
import { trackLength } from "@/components/common/units/time";

/* ----------------------------- Candidate Diff ----------------------------- */

export function CandidateDiff({
    from,
    to,
}: {
    // TODO: Should be TaskState["items"] instead of SerializedCandidateState
    from: SerializedCandidateState;
    to: SerializedCandidateState;
}) {
    const theme = useTheme();

    return (
        <Box>
            <Disambiguation candidate={to} />

            {/* Artist */}
            <GenericDiff
                from={from.info.artist || "Unknown artist"}
                to={to.info.artist || "Unknown artist"}
                icon={<PenaltyTypeIcon type="artist" />}
            />

            {/* Album */}
            <GenericDiff
                from={from.info.album || "Unknown album"}
                to={to.info.album || "Unknown album"}
                icon={<PenaltyTypeIcon type="album" />}
            />

            {/* Tracks */}
            <Box>
                {to.penalties.includes("tracks") ? (
                    <Box>
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
                        </Box>
                        <TracksDiff from={from.tracks!} to={to.tracks!} />
                    </Box>
                ) : (
                    <Box>
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
    width: "100%",
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
    columnGap: theme.spacing(1),
}));

function TracksDiff({ from, to }: { from: TrackInfo[]; to: TrackInfo[] }) {
    return (
        <TrackChangesGrid>
            {from!.map((track, index) => {
                const toTrack = to.find((t) => t.index === track.index);
                if (toTrack) {
                    return <TrackDiffRow from={track} to={toTrack} key={index} />;
                }
            })}
        </TrackChangesGrid>
    );
}

function TrackDiffRow({ from, to }: { from: TrackInfo; to: TrackInfo }) {
    // FIXME: the backend types seem wrong, why optional?
    const theme = useTheme();
    const { fromParts, toParts } = useDiffParts(from.title || "", to.title || "");

    const fromD = {
        time: trackLength(from.length),
        idx: from.index ?? 0,
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
        time: from.length !== to.length,
        index: from.index !== to.index,
    };

    const numChanges = [changed.title, changed.time, changed.index].filter(
        (x) => x
    ).length;

    // depending on the number of changes we render a slightly different row
    // major change shows changes with arrow i.e. [1] t1 -> [2] t2
    if (changed.title || numChanges > 1) {
        return (
            <Box sx={{ display: "contents" }}>
                <Box
                    sx={{
                        gridColumn: "index-from",
                        color: changed.index ? fromD.color : "inherit",
                        justifyContent: "flex-end",
                        textAlign: "right",
                    }}
                    data-column="index-from"
                >
                    {fromD.idx} {from.medium}
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
                    {toD.idx} {to.medium}
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
            <Box>{toD.data}</Box>

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
                {true && (
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
