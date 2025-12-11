/** An assortment of chips used to show a variety of information
 * in a compact way.
 *
 * On mobile devices, the chip is not shown but the raw icon
 * is show instead.
 */

import { FolderClockIcon } from 'lucide-react';
import { useMemo } from 'react';
import { Box, darken, styled, Tooltip, useTheme } from '@mui/material';
import Chip, { ChipProps } from '@mui/material/Chip';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';

import { useConfig } from '@/api/config';
import { sessionQueryOptions, statusQueryOptions } from '@/api/session';
import { Archive, Folder, FolderStatus, Progress } from '@/pythonTypes';

import {
    FolderStatusIcon,
    PenaltyTypeIcon,
    SourceTypeIconWithTooltip,
} from './icons';

export const StyledChip = styled(Chip, {
    shouldForwardProp: (prop) => prop !== 'color',
})(({ theme, color }) => {
    let frontColor = theme.palette.grey[400];
    let backColor = darken(theme.palette.grey[500], 0.7);
    if (color != 'default') {
        frontColor =
            color && theme.palette[color]
                ? theme.palette[color].light
                : theme.palette.text.primary;
        backColor =
            color && theme.palette[color]
                ? darken(theme.palette[color].main, 0.7)
                : theme.palette.grey[300];
    }

    return {
        paddingLeft: theme.spacing(0.5),
        display: 'flex',
        justifyContent: 'space-between',
        border: 'none',
        backgroundColor: backColor,
        borderColor: frontColor,
        color: frontColor,
        borderRadius: theme.spacing(1.0),
        '& .MuiChip-label': {
            paddingLeft: theme.spacing(1.0),
        },
        '& .MuiChip-icon': {
            color: frontColor,
        },
        [theme.breakpoints.down('tablet')]: {
            paddingLeft: 0,
            //Remove border on small screens
            border: 'none',
            backgroundColor: 'transparent',

            //Remove label on small screens
            '& .MuiChip-label': {
                display: 'none',
            },
        },
    };
});

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

    let color: 'success' | 'warning' | 'error' | 'info' = 'success';
    if (distance > config.match.strong_rec_thresh) {
        color = 'warning';
    }
    if (distance > config.match.medium_rec_thresh) {
        color = 'error';
    }
    let label = (Math.abs(distance - 1) * 100).toFixed(0) + '%';

    if (source == 'asis') {
        color = 'info';
        label = 'asis';
    }

    return (
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <StyledChip
                label={label}
                size="small"
                color={color}
                {...props}
                sx={{
                    ...props.sx,
                    paddingLeft: theme.spacing(0.5),
                    paddingRight: theme.spacing(0.7),
                    zIndex: 0,
                    height: theme.spacing(2.5),
                    '& .MuiChip-label': {
                        fontWeight: '500',
                        fontFamily: 'monospace',
                    },
                    [theme.breakpoints.down('tablet')]: {
                        '& .MuiChip-label': {
                            display: 'block !important',
                        },
                    },
                }}
            />
            <StyledChip
                icon={
                    <SourceTypeIconWithTooltip
                        type={source}
                        size={theme.iconSize.sm}
                    />
                }
                label=""
                size="small"
                color={'default'}
                {...props}
                sx={{
                    ...props.sx,
                    marginLeft: theme.spacing(-1.0),
                    position: 'relative',
                    paddingInline: theme.spacing(0.7),
                    zIndex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    '& .MuiChip-label': {
                        display: 'none',
                    },
                    '& .MuiChip-icon': {
                        position: 'relative',
                        display: 'block',
                        margin: 0,
                        padding: '0 !important',
                    },
                    [theme.breakpoints.down('tablet')]: {
                        paddingRight: 0,
                    },
                }}
            />
        </Box>
    );
}

/* ------------------------------- Inbox Chips ------------------------------ */
// Include data fetching if needed
// mainly used for status in the /inbox route

/** Shows a chip if the candidate is a duplicate.
 */
export function DuplicateChip({
    folder,
    ...props
}: { folder: Folder | Archive } & ChipProps) {
    const theme = useTheme();
    const { data: session } = useQuery(
        sessionQueryOptions({ folderPath: folder.full_path })
    );

    //Fixme: Generalize best candidate
    const bestCandidate = session?.tasks
        .flatMap((t) => t.candidates.map((c) => c))
        .filter((c) => c.info.data_source !== 'asis')
        .sort((a, b) => a.distance - b.distance)[0];

    if (!bestCandidate) {
        return null;
    }

    if (bestCandidate.duplicate_ids.length == 0) {
        return null;
    }

    if (session.status.progress >= Progress.IMPORT_COMPLETED) {
        return null;
    }
    return (
        <Tooltip title="This album is already in your beets library!">
            <StyledChip
                icon={
                    <PenaltyTypeIcon
                        type="duplicate"
                        size={theme.iconSize.sm - 2}
                    />
                }
                label="Duplicate"
                size="small"
                color="error"
                variant="outlined"
                {...props}
            />
        </Tooltip>
    );
}

/** Shows the current import status of the
 * folder.
 */
export function FolderStatusChip({
    folder,
    ...props
}: { folder: Folder | Archive } & ChipProps) {
    const { data: statuses } = useQuery(statusQueryOptions);
    const theme = useTheme();

    // Status enum value
    const folderStatus = useMemo(() => {
        return statuses?.find((s) => s.path === folder.full_path);
    }, [statuses, folder.full_path]);

    if (!folderStatus) {
        return null;
    }

    let status_name: string;
    switch (folderStatus.status) {
        case FolderStatus.PREVIEWING:
            status_name = 'Tagging';
            break;
        case FolderStatus.PREVIEWED:
            status_name = 'Tagged';
            break;
        case FolderStatus.DELETING:
            status_name = 'Undoing';
            break;
        case FolderStatus.DELETED:
            status_name = 'Undone';
            break;
        case FolderStatus.FAILED:
            status_name = 'Failed';
            if (folderStatus.exc?.type === 'NoCandidatesFoundException') {
                status_name = 'No Match';
            } else if (folderStatus.exc?.type === 'NotImportedException') {
                status_name = 'Threshold';
            }
            break;
        default:
            status_name = FolderStatus[folderStatus.status];
    }

    return (
        <Tooltip title={folderStatus.exc?.message || undefined}>
            <Link
                to={'/inbox/folder/$path/$hash'}
                params={{ path: folder.full_path, hash: folder.hash }}
                mask={{
                    to: '/inbox/folder/$path',
                    params: { path: folder.full_path },
                }}
                preload="intent"
                style={{ gridColumn: 'chip' }}
            >
                <StyledChip
                    icon={
                        <FolderStatusIcon
                            status={folderStatus.status}
                            exception={folderStatus.exc}
                            size={theme.iconSize.sm}
                        />
                    }
                    label={
                        status_name.charAt(0) +
                        status_name.slice(1).toLowerCase()
                    }
                    size="small"
                    variant="outlined"
                    color="info"
                    {...props}
                />
            </Link>
        </Tooltip>
    );
}

/** Shows the current best candidate of the folder.
 *
 * If any candidate is found.
 */
export function BestCandidateChip({
    folder,
    ...props
}: { folder: Folder | Archive } & ChipProps) {
    // FIXME: Fetching the full session here is kinda overkill
    // Only use path here, and
    // TODO: add hash inconsistency warning badge!
    const { data: session } = useQuery(
        sessionQueryOptions({ folderPath: folder.full_path })
    );

    const bestCandidate = session?.tasks
        .flatMap((t) => t.candidates.map((c) => c))
        .filter((c) => c.info.data_source !== 'asis')
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

/** Shows a chip if the folder is not
 * in sync with the current most recent session.
 *
 * This may happen if new files are added or content changed.
 */
export function HashMismatchChip({
    folder,
    ...props
}: { folder: Folder | Archive } & ChipProps) {
    const theme = useTheme();
    const { data: session } = useQuery(
        sessionQueryOptions({ folderPath: folder.full_path })
    );

    if (!session) {
        return null;
    }

    if (session.folder_hash == folder.hash) {
        return null;
    }

    return (
        <Tooltip title="The current folder content does not match the content when the folder was tagged/imported.">
            <StyledChip
                icon={<FolderClockIcon size={theme.iconSize.sm} />}
                label="Integrity"
                size="small"
                variant="outlined"
                color="warning"
                {...props}
            />
        </Tooltip>
    );
}
