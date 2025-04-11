import { ChevronRightIcon, Library, RefreshCcw } from "lucide-react";
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

import { LibraryStats } from "@/routes/_frontpage/index";

import styles from "./stats.module.scss";
import { humanizeBytes } from "../common/units/bytes";
import { humanizeDuration, relativeTime } from "../common/units/time";

/** A component for general library
 * statistics, such as the number of
 * items. Their runtime, etc.
 */
export function LibraryStatsComponent({ stats }: { stats: LibraryStats }) {
    return (
        <Card
            sx={{
                display: "flex",
                width: "100%",
                backgroundColor: "transparent",
            }}
        >
            <CardContent sx={{ pr: 2, width: "100%" }}>
                <Header data={stats} />
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
                        <div>Total Runtime: {humanizeDuration(stats.runtime)}</div>
                        <div>
                            Disk Usage: {humanizeBytes(stats.size)} /{" "}
                            {humanizeBytes(stats.size + stats.freeSpace)}
                        </div>
                        <div>Number of tracks: {stats.items}</div>
                        <div>Number of albums: {stats.albums}</div>
                        <div>Number of artists: {stats.artists}</div>
                        <div>Number of genres: {stats.genres}</div>
                        <div>Number of labels: {stats.labels}</div>
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
                        to="/library/browse"
                    >
                        Show my library <ChevronRightIcon size={"1rem"} />
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

function Header({ data }: { data?: LibraryStats }) {
    return (
        <Box sx={{ display: "flex", alignItems: "center" }}>
            <Avatar
                sx={{
                    backgroundColor: "transparent",
                    color: "primary.main",
                }}
                variant="rounded"
            >
                <Library size="100%" />
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
                        Your Library
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
                            {data?.libraryPath ?? "Loading..."}
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
                        last import <relativeTime date={data?.lastItemAdded} />
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
