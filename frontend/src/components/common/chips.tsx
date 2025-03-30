/** An assortment of chips used to show a variety of information
 * in a compact way.
 *
 * On mobile devices, the chip is not shown but the raw icon
 * is show instead.
 */

import Chip, { ChipProps } from "@mui/material/Chip";
import styled from "@mui/material/styles/styled";

import { useConfig } from "./hooks/useConfig";
import { PenaltyTypeIcon, SourceTypeIconWithTooltip } from "./icons";
import useTheme from "@mui/material/styles/useTheme";
import { useQuery } from "@tanstack/react-query";
import { sessionQueryOptions } from "@/routes/_debug/session.$id";
import { Folder } from "@/pythonTypes";

export const StyledChip = styled(Chip)(({ theme }) => ({
    paddingLeft: theme.spacing(0.5),
    "& .MuiChip-label": {
        paddingLeft: theme.spacing(1.0),
    },
    [theme.breakpoints.down("tablet")]: {
        paddingLeft: 0,
        //Remove border on small screens
        border: "none",

        //Remove label on small screens
        "& .MuiChip-label": {
            display: "none",
        },
    },
}));

/** Match of a candidate.
 *
 *
 */
export function MatchChip({
    source,
    distance,
    ...props
}: { source: string; distance: number } & ChipProps) {
    const config = useConfig();
    const theme = useTheme();

    let color: "success" | "warning" | "error" | "info" = "success";
    if (distance > config.match.strong_rec_thresh) {
        color = "warning";
    }
    if (distance > config.match.medium_rec_thresh) {
        color = "error";
    }
    let label = (Math.abs(distance - 1) * 100).toFixed(0) + "%";

    if (source == "asis") {
        color = "info";
        label = "asis";
    }

    return (
        <StyledChip
            icon={<SourceTypeIconWithTooltip type={source} size={theme.iconSize.sm} />}
            label={label}
            size="small"
            variant="outlined"
            color={color}
            {...props}
        />
    );
}

export function DuplicateChip({ folder }: { folder: Folder }) {
    const { data: session } = useQuery(sessionQueryOptions(folder.hash));
    const theme = useTheme();

    //Fixme: Generalize best candidate
    const bestCandidate = session?.tasks
        .flatMap((t) => t.candidates.map((c) => c))
        .filter((c) => c.info.data_source !== "asis")
        .sort((a, b) => a.distance - b.distance)[0];

    if (!bestCandidate) {
        return null;
    }

    if (bestCandidate.duplicate_ids.length > 0) {
        return null;
    }

    return (
        <StyledChip
            icon={<PenaltyTypeIcon type="duplicate" size={theme.iconSize.sm} />}
            label="Duplicate"
            size="small"
            color="error"
            variant="outlined"
        />
    );
}
