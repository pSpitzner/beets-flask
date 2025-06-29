import { LucideProps } from "lucide-react";
import { Box } from "@mui/material";
import Tooltip from "@mui/material/Tooltip";

import { SerializedCandidateState } from "@/pythonTypes";

import { PenaltyTypeIcon } from "../common/icons";

const penaltyOrder = [
    "artist",
    "album",
    "tracks",
    "extra_tracks",
    "extra_items",
    "year",
    "label",
    "media",
    "mediums",
    "country",
];

/** Helper function to show all penalties.
 *
 * Colors all active penalties orange.
 *
 */
export function PenaltyIconRow({
    candidate,
    size,
}: {
    candidate: SerializedCandidateState;
    size?: number;
}) {
    return (
        <>
            {penaltyOrder.map((p) => (
                <Box
                    sx={(theme) => ({
                        color: candidate.penalties.includes(p)
                            ? theme.palette.diffs.changed
                            : theme.palette.diffs.changedLight,
                        [theme.breakpoints.down("tablet")]: {
                            display: "none",
                        },
                        display: "flex",
                    })}
                    key={p}
                >
                    <PenaltyIconWithTooltip key={p} type={p} size={size} />
                </Box>
            ))}
        </>
    );
}

/**
 * Renders an icon representing a specific penalty kind with an
 * additional tooltip.
 */
function PenaltyIconWithTooltip({
    type,
    ...props
}: { type: string; className?: string } & Omit<LucideProps, "ref">): React.JSX.Element {
    const tooltip = type
        .replace("album_", "")
        .replace("track_", "")
        .replaceAll(" ", ", ")
        .replaceAll("_", " ")
        // rename for more verbose hover
        .replace(/^tracks\b/, "track changes")
        .replace(/^mediums\b/, "number of discs");

    return (
        <Tooltip title={tooltip}>
            <PenaltyTypeIcon type={type} {...props} />
        </Tooltip>
    );
}
