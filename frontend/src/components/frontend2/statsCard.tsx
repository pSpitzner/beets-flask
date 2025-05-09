import {
    ChevronRight,
    HardDriveIcon,
    InboxIcon,
    LibraryIcon,
    TimerIcon,
} from "lucide-react";
import { ReactNode } from "react";
import {
    Avatar,
    Box,
    BoxProps,
    Button,
    Card,
    CardContent,
    Divider,
    Typography,
} from "@mui/material";
import { Link } from "@tanstack/react-router";

import { LibraryStats } from "@/api/library";
import { InboxStats } from "@/pythonTypes";

import { PenaltyTypeIcon } from "../common/icons";
import { humanizeBytes } from "../common/units/bytes";
import { humanizeDuration, relativeTime } from "../common/units/time";

export function LibraryStatsCard({ libraryStats }: { libraryStats: LibraryStats }) {
    return (
        <Card sx={{ padding: 2 }}>
            {/* Top bar with accent */}
            <CardHeader icon={<LibraryIcon size={36} />}>
                <Typography
                    sx={{
                        fontSize: 14,
                        color: "grey.600",
                        whiteSpace: "nowrap",
                        letterSpacing: "1px",
                    }}
                >
                    last import: {relativeTime(libraryStats.lastItemAdded)}
                </Typography>
            </CardHeader>
            <CardContent
                sx={{
                    paddingInline: 1,
                    paddingTop: 2,
                    m: 0,
                    paddingBottom: "0 !important",
                }}
            >
                <ContentHeader title="Library" subtitle={libraryStats.libraryPath} />
                <Box
                    sx={{
                        display: "flex",
                        gap: 2,
                        paddingTop: 2.5,
                        flexWrap: "wrap",
                        // color for boarders
                        color: "primary.muted",
                    }}
                >
                    <StatItem
                        title="Total Runtime"
                        icon={<TimerIcon />}
                        value={humanizeDuration(libraryStats.runtime)}
                    />
                    <StatItem
                        title="Size"
                        icon={<HardDriveIcon />}
                        value={humanizeBytes(libraryStats.size)}
                    />
                    <StatItem
                        title="Items"
                        icon={<PenaltyTypeIcon type="tracks" />}
                        value={libraryStats.items}
                    />
                    <StatItem
                        title="Albums"
                        icon={<PenaltyTypeIcon type="album" />}
                        value={libraryStats.albums}
                    />
                    <StatItem
                        title="Artists"
                        icon={<PenaltyTypeIcon type="artist" />}
                        value={libraryStats.artists}
                    />
                    <StatItem
                        title="Labels"
                        icon={<PenaltyTypeIcon type="label" />}
                        value={libraryStats.labels}
                    />
                </Box>
                <Box
                    sx={(theme) => ({
                        paddingTop: 3,
                        display: "flex",
                        gap: 2,
                        fontWeight: 600,
                        justifyContent: "flex-end",
                        minWidth: "200px",
                        [theme.breakpoints.down("tablet")]: {
                            ">*": {
                                width: "100%",
                            },
                        },
                    })}
                >
                    <Button
                        variant="contained"
                        color="primary"
                        endIcon={<ChevronRight />}
                        component={Link}
                        to="/library/browse"
                        size="large"
                        sx={{
                            fontWeight: 600,
                        }}
                    >
                        Browse Library
                    </Button>
                </Box>
            </CardContent>
        </Card>
    );
}

export function InboxStatsCard({ inboxStats }: { inboxStats: InboxStats }) {
    return (
        <Card sx={{ padding: 2 }}>
            <CardHeader icon={<InboxIcon size={36} />} color="secondary.main">
                <Typography
                    sx={{
                        fontSize: 14,
                        color: "grey.600",
                        whiteSpace: "nowrap",
                        letterSpacing: "1px",
                    }}
                >
                    todo
                </Typography>
            </CardHeader>
            <CardContent
                sx={{
                    paddingInline: 1,
                    paddingTop: 2,
                    m: 0,
                    paddingBottom: "0 !important",
                }}
            >
                <ContentHeader title={inboxStats.name} subtitle={inboxStats.path} />
                <Box
                    sx={{
                        display: "flex",
                        gap: 2,
                        paddingTop: 2.5,
                        flexWrap: "wrap",
                        color: "secondary.muted",
                    }}
                >
                    <StatItem
                        title="Size"
                        icon={<HardDriveIcon />}
                        value={humanizeBytes(inboxStats.size)}
                    />
                    <StatItem
                        title="Files"
                        icon={<PenaltyTypeIcon type="tracks" />}
                        value={inboxStats.nFiles}
                    />
                    <StatItem
                        title="Tagged"
                        icon={<PenaltyTypeIcon type="tracks" />}
                        value={inboxStats.tagged_via_gui}
                    />
                </Box>
                <Box
                    sx={(theme) => ({
                        paddingTop: 3,
                        display: "flex",
                        gap: 2,
                        fontWeight: 600,
                        justifyContent: "flex-end",
                        [theme.breakpoints.down("tablet")]: {
                            ">*": {
                                width: "100%",
                            },
                        },
                    })}
                >
                    <Button
                        variant="contained"
                        color="secondary"
                        endIcon={<ChevronRight />}
                        component={Link}
                        to="/inbox"
                        size="large"
                        sx={{
                            fontWeight: 600,
                        }}
                    >
                        Show Inbox
                    </Button>
                </Box>
            </CardContent>
        </Card>
    );
}

/** Top bar of the stats card, shows an icon and
 * accent line.
 *
 * Additional children can be passed to the placed
 * on the right side of the icon.
 */
export function CardHeader({
    icon,
    children,
    color = "primary.main",
    reverse = false,
    sx,
    ...props
}: {
    icon: ReactNode;
    children: ReactNode;
    color?: string;
    reverse?: boolean;
} & BoxProps) {
    return (
        <Box
            sx={[
                { position: "relative", flexGrow: 1 },
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                ...(Array.isArray(sx) ? sx : [sx]),
            ]}
            {...props}
        >
            <Divider
                sx={{
                    position: "absolute",
                    top: "calc(50% - 1px)",
                    width: "100%",
                    backgroundColor: color,
                    borderBottomWidth: 2,
                }}
            />
            <Box
                sx={{
                    paddingLeft: reverse ? 1 : 4,
                    paddingRight: reverse ? 4 : 1,
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    zIndex: 1,
                    flexDirection: reverse ? "row-reverse" : "row",
                }}
            >
                <Avatar
                    variant="rounded"
                    sx={{
                        width: 56,
                        height: 56,
                        backgroundColor: color,
                        "& > img": {
                            margin: 0,
                        },
                    }}
                >
                    {icon}
                </Avatar>
                {children}
            </Box>
        </Box>
    );
}

function ContentHeader({ title, subtitle }: { title: string; subtitle: string }) {
    return (
        <>
            <Typography
                fontWeight={600}
                fontSize={16}
                color="grey.600"
                fontFamily="monospace"
            >
                {subtitle}
            </Typography>
            <Typography variant="h5" fontWeight={800} letterSpacing={0.5}>
                {title}
            </Typography>
        </>
    );
}

/** A single stat item on the stats card
 * @param title - The title of the stat item
 * @param icon - The icon to display next to the title
 * @param value - The value of the stat item
 */
function StatItem({
    title,
    icon,
    value,
}: {
    title: React.ReactNode;
    icon: React.ReactNode;
    value: React.ReactNode;
}) {
    return (
        <Box
            sx={{
                border: `2px solid`,
                borderRadius: 1,
                padding: 0.5,
                minWidth: "100px",
            }}
        >
            <Typography
                component="div"
                sx={{
                    fontSize: 16,
                    fontWeight: 600,
                    letterSpacing: "0.5px",
                    display: "flex",
                    alignItems: "center",
                    gap: 0.5,
                    color: "grey.800",
                }}
            >
                <Box
                    sx={(theme) => ({
                        width: theme.iconSize.sm,
                        height: theme.iconSize.sm,
                        display: "flex",
                        alignItems: "center",
                    })}
                >
                    {icon}
                </Box>
                {title}
            </Typography>
            <Typography
                variant="h6"
                fontWeight={600}
                fontFamily="monospace"
                sx={{ paddingLeft: 1, textAlign: "right", width: "100%" }}
            >
                {value}
            </Typography>
        </Box>
    );
}
