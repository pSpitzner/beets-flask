import { ChevronRightIcon, Inbox, RefreshCcw } from "lucide-react";
import {
    Avatar,
    Box,
    Card,
    CardActions,
    CardContent,
    Divider,
    IconButton,
    Link as MUILink,
    Tooltip,
} from "@mui/material";
import { Link } from "@tanstack/react-router";

import { InboxStats } from "@/pythonTypes";

import styles from "../library/stats.module.scss";
import { humanizeBytes } from "../common/units/bytes";
import { RelativeTime } from "../common/units/time";

/** A component for general inbox
 * statistics, such as the number of
 * items. Their runtime, etc.
 *
 * As this might hold multiple inboxes
 * this is a wrapper component for the
 * InboxStatsItem.
 */
export function InboxStatsComponent({ inboxStats }: { inboxStats: InboxStats[] }) {
    return (
        <Box>
            {inboxStats.map((stats, i) => (
                <InboxStatsItem key={i} data={stats} />
            ))}
        </Box>
    );
}

/** A component for displaying the stats
 * of a single inbox.
 */
function InboxStatsItem({ data }: { data: InboxStats }) {
    return (
        <Card
            sx={{
                display: "flex",
                width: "100%",
                backgroundColor: "transparent",
            }}
        >
            <CardContent sx={{ pr: 2, width: "100%" }}>
                <Header data={data} />
                <Divider variant="inset" component="div" sx={{ marginBlock: 0.5 }} />
                <Box sx={{ display: "flex", alignItems: "center" }}>
                    <Box
                        sx={{
                            fontSize: 14,
                            color: "grey.500",
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fit, 250px)",
                            width: "100%",
                            ml: 2,
                            alignItems: "center",
                        }}
                    >
                        <div>Number of files: {data.nFiles}</div>
                        <div>Tagged files: {data.nTagged}</div>
                        <div>Size of inbox: {humanizeBytes(data.size)}</div>
                        <div>
                            Size of tagged files: {humanizeBytes(data.sizeTagged)}
                        </div>
                    </Box>
                </Box>
                <Divider variant="inset" component="div" sx={{ marginBlock: 0.5 }} />
                <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
                    <MUILink
                        sx={{
                            fontSize: 14,
                            color: "primary.light",
                            opacity: 0.87,
                            textDecoration: "none",
                            "&:hover, &:focus": {
                                color: "primary.main",
                                opacity: 1,
                                "& $icon": {
                                    opacity: 1,
                                },
                            },
                            display: "flex",
                            alignItems: "center",
                        }}
                        component={Link}
                        to="/inbox"
                    >
                        Show my inbox <ChevronRightIcon size={"1rem"} />
                    </MUILink>
                </Box>
            </CardContent>
            <CardActions>
                <div className="flex flex-row space-x-4"></div>
                <div className="flex flex-row space-x-4"></div>
            </CardActions>
        </Card>
    );
}

function Header({ data }: { data: InboxStats }) {
    return (
        <Box sx={{ display: "flex", alignItems: "center" }}>
            <Avatar
                sx={{
                    backgroundColor: "transparent",
                    color: "primary.main",
                }}
                variant="rounded"
            >
                <Inbox size="100%" />
            </Avatar>

            <Box
                sx={{
                    ml: 2,
                    width: "100%",
                    display: "flex",
                    alignItems: "flex-end",
                    justifyContent: "space-between",
                }}
            >
                <Box>
                    <h3
                        style={{
                            fontSize: "17px",
                            fontWeight: "bold",
                            marginBottom: "0",
                            display: "inline-block",
                        }}
                    >
                        {data.inboxName}
                    </h3>
                    <h4
                        style={{
                            display: "flex",
                            justifyContent: "space-between",
                            marginBottom: 0,
                        }}
                    >
                        <Box
                            component="div"
                            sx={{
                                fontSize: 14,
                                color: "grey.500",
                            }}
                        >
                            {data.inboxPath}
                        </Box>
                    </h4>
                </Box>
                <Box
                    sx={{
                        display: "flex",
                        alignItems: "flex-end",
                        flexDirection: "column",
                    }}
                >
                    <RefreshStatsButton />
                    <Box
                        component="div"
                        sx={{
                            fontSize: 14,
                            color: "grey.500",
                            display: "flex",
                            alignItems: "center",
                            gap: 1,
                            textAlign: "right",
                        }}
                    >
                        last tag <RelativeTime date={data.lastTagged} />
                    </Box>
                </Box>
            </Box>
        </Box>
    );
}

function RefreshStatsButton() {
    // TODO: Add mutation to refresh the cache
    const loading = false;

    return (
        <IconButton
            sx={{ padding: 0, color: "grey.500" }}
            className={loading ? styles.spin : ""}
            disabled
        >
            <Tooltip title="Refresh library stats">
                <RefreshCcw size="1rem" />
            </Tooltip>
        </IconButton>
    );
}
