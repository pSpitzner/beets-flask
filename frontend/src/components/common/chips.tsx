/** An assortment of chips used to show a variety of information
 * in a compact way.
 *
 * On mobile devices, the chip is not shown but the raw icon
 * is show instead.
 */

import Chip, { ChipProps } from "@mui/material/Chip";
import styled from "@mui/material/styles/styled";

import { useConfig } from "./hooks/useConfig";
import { FolderStatusIcon, PenaltyTypeIcon, SourceTypeIconWithTooltip } from "./icons";
import useTheme from "@mui/material/styles/useTheme";
import { useQuery } from "@tanstack/react-query";
import { sessionQueryOptions } from "@/routes/_debug/session.$id";
import { Folder, FolderStatus } from "@/pythonTypes";
import { statusQueryOptions } from "./websocket/status";

export const StyledChip = styled(Chip)(({ theme }) => ({
    paddingLeft: theme.spacing(0.5),
    display: "flex",
    justifyContent: "space-between",
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
 * Shows source and percentage of match.
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

/* ------------------------------- Inbox Chips ------------------------------ */
// Include data fetching if needed
// mainly used for status in the /inbox route

/** Shows a chip if the candidate is a duplicate.
 */
export function DuplicateChip({ folder, ...props }: { folder: Folder } & ChipProps) {
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
            {...props}
        />
    );
}

/** Shows the current import status of the
 * folder.
 */
export function FolderStatusChip({ folder, ...props }: { folder: Folder } & ChipProps) {
    const { data: status } = useQuery(statusQueryOptions);
    const theme = useTheme();

    // Status enum value
    const status_value = status?.find((s) => s.path === folder.full_path)?.status;

    // Status enum name
    let status_name: string | undefined = undefined;
    if (status_value !== undefined) {
        status_name = FolderStatus[status_value];
    }

    if (!status_name || !status_value) {
        return null;
    }

    return (
        <StyledChip
            icon={<FolderStatusIcon status={status_value} size={theme.iconSize.sm} />}
            label={status_name.charAt(0) + status_name.slice(1).toLowerCase()}
            size="small"
            variant="outlined"
            color="info"
            {...props}
        />
    );
}

/** Shows the current best candidate of the folder.
 *
 * If any candidate is found.
 */
export function BestCandidateChip({
    folder,
    ...props
}: { folder: Folder } & ChipProps) {
    // FIXME: Fetching the full session here is kinda overkill
    const { data: session } = useQuery(sessionQueryOptions(folder.hash));

    const bestCandidate = session?.tasks
        .flatMap((t) => t.candidates.map((c) => c))
        .filter((c) => c.info.data_source !== "asis")
        .sort((a, b) => a.distance - b.distance)[0];

    if (!bestCandidate || !bestCandidate.info.data_source) {
        return null;
    }

    return (
        <MatchChip
            source={bestCandidate.info.data_source}
            distance={bestCandidate.distance}
            {...props}
        />
    );
}
