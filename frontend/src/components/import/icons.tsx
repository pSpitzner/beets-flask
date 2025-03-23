import { LucideProps } from "lucide-react";
import { Box } from "@mui/material";
import Tooltip from "@mui/material/Tooltip";

import { SerializedCandidateState } from "@/pythonTypes";

import { StyledChip } from "../common/chips";
import { PenaltyTypeIcon } from "../common/icons";

/** A chip showing the current penalties.
 *
 * Has some breakpoints depending on the
 * screen size.
 */
export function PenaltyIconsChip({ candidate }: { candidate: SerializedCandidateState }) {
    return (
        <StyledChip
            icon={<PenaltyIconRow candidate={candidate} size={20 * 0.85} />}
            label="Penalties"
            color="info"
            variant="outlined"
            size="small"
        />
    );
}

const penaltyOrder = [
    "missing_tracks",
    "tracks",
    "unmatched_tracks",
    "artist",
    "album",
    "media",
    "mediums",
    "year",
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
                        color: candidate.penalties.includes(p) ? "#ebcb8c" : "#403b31",
                        [theme.breakpoints.down("tablet")]: {
                            display: candidate.penalties.includes(p) ? "flex" : "none",
                        },
                        display: "flex",
                    })}
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
