/** An assortment of chips used to show a variety of information
 * in a compact way.
 *
 * On mobile devices, the chip is not shown but the raw icon
 * is show instead.
 */

import Chip, { ChipProps } from "@mui/material/Chip";
import styled from "@mui/material/styles/styled";

import { SourceTypeIconWithTooltip } from "./icons";
import { useConfig } from "./hooks/useConfig";

export const StyledChip = styled(Chip)(({ theme }) => ({
    paddingLeft: theme.spacing(0.5),
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

    let color: "success" | "warning" | "error" = "success";
    if (distance > config.match.strong_rec_thresh) {
        color = "warning";
    }
    if (distance > config.match.medium_rec_thresh) {
        color = "error";
    }

    return (
        <StyledChip
            icon={<SourceTypeIconWithTooltip type={source} size={20 * 0.85} />}
            label={(Math.abs(distance - 1) * 100).toFixed(0) + "%"}
            size="small"
            variant="outlined"
            color={color}
            {...props}
        />
    );
}
