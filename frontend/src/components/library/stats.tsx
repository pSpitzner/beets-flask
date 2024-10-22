import { ChevronRightIcon } from "lucide-react";
import {
    Box,
    Card,
    CardContent,
    Divider,
    Link as MUILink,
    Tooltip,
} from "@mui/material";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";

import { libraryStatsQueryOptions } from "./_query";

import { humanizeBytes } from "../common/bytes";
import { humanizeDuration, RelativeTime } from "../common/time";

/** A component for general library
 * statistics, such as the number of
 * items. Their runtime, etc.
 */
export function LibraryStats() {
    const librariesQuery = useSuspenseQuery(libraryStatsQueryOptions());

    return (
        <Card
            elevation={0}
            sx={{
                display: "flex",
                backgroundColor: "transparent",
                width: "100%",
            }}
        >
            <CardContent sx={{ pr: 2, width: "100%" }}>
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
                        {librariesQuery.data?.libraryPath ?? "Loading..."}
                    </Box>
                    <Box
                        component="div"
                        sx={{
                            fontSize: 14,
                            color: "grey.500",
                        }}
                    >
                        last import{" "}
                        <RelativeTime date={librariesQuery.data?.lastItemAdded} />
                    </Box>
                </h4>
                <Divider variant="inset" component="div" sx={{ marginBlock: 0.5 }} />
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
                    <div>
                        Total Runtime: {humanizeDuration(librariesQuery.data?.runtime)}
                    </div>
                    <div>
                        Disk Usage: {humanizeBytes(librariesQuery.data?.size)} /{" "}
                        {humanizeBytes(
                            librariesQuery.data?.size + librariesQuery.data?.freeSpace
                        )}
                    </div>
                    <div>Number of tracks: {librariesQuery.data?.items}</div>
                    <div>Number of albums: {librariesQuery.data?.albums}</div>
                    <div>Number of artists: {librariesQuery.data?.artists}</div>
                    <div>Number of genres: {librariesQuery.data?.genres}</div>
                    <div>Number of labels: {librariesQuery.data?.labels}</div>
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
        </Card>
    );
}

function Item({
    label,
    value,
    hover,
}: {
    label: string;
    value: string | string[] | number | number[];
    hover?: string;
}) {
    const pValue: string[] = Array.isArray(value)
        ? value.map((v) => v.toString())
        : [value.toString()];

    return (
        <Tooltip
            title={hover}
            slotProps={{
                popper: {
                    modifiers: [
                        {
                            name: "offset",
                            options: {
                                offset: [0, -14],
                            },
                        },
                    ],
                },
            }}
        >
            <Box
                sx={{
                    display: "flex",
                    flexDirection: "column",
                    borderRadius: 1,
                }}
            >
                <div>{label}</div>
                {pValue.map((v, i) => (
                    <Box
                        key={i}
                        sx={{
                            ml: 1,
                        }}
                    >
                        {v}
                    </Box>
                ))}
            </Box>
        </Tooltip>
    );
}
