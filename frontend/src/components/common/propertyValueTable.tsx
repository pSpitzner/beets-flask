import { Maximize2, Minimize2 } from "lucide-react";
import { useMemo, useState } from "react";
import {
    Box,
    IconButton,
    Slide,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableProps,
    TableRow,
    Typography,
    useTheme,
} from "@mui/material";

import { Search } from "./inputs/search";

import { FullScreenOntop } from "../library/audio/player";

export type Serializable = string | number | boolean | null | undefined;

/** A generic table to show and search in a table
 * with given properties and values.
 *
 * TODO: handle arrays of values more gracefully atm they are cast to string
 */
export function PropertyValueTable({
    data,
    sx,
    ...props
}: {
    data: Record<string, Serializable | Serializable[]>;
} & TableProps) {
    const theme = useTheme();
    const [fullscreen, setFullscreen] = useState(false);
    const [filter, setFilter] = useState<string>("");

    const filteredData = useMemo(() => {
        return Object.entries(data)
            .filter(
                ([key, value]) => key.includes(filter) || String(value).includes(filter)
            )
            .sort((a, b) => {
                // Sort by string comparison, ignoring case
                const aKey = a[0].toLowerCase();
                const bKey = b[0].toLowerCase();
                if (aKey < bKey) return -1;
                if (aKey > bKey) return 1;
                return 0;
            });
    }, [data, filter]);

    const nExcluded = Object.entries(data).length - filteredData.length;

    const table = useMemo(
        () => (
            <Table
                size="small"
                sx={[
                    {
                        //display: "grid",
                        width: "100%",
                        borderCollapse: "separate",
                        maxHeight: "400px",
                        //tableLayout: "fixed",
                        td: {
                            //overflowWrap: "break-word",
                            maxHeight: "200px",
                            maxWidth: "100%",
                        },
                        position: "relative",
                        //thicker border bottom for head
                        thead: {
                            fontWeight: "bold",
                            fontSize: "0.95rem",
                            verticalAlign: "bottom",
                            top: 0,
                            position: "sticky",
                            th: {
                                border: "unset",
                            },
                            "> *:last-child > th": {
                                borderBottomWidth: 2,
                                borderBottomStyle: "solid",
                                borderBottomColor: "#515151",
                            },
                        },
                    },
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                    ...(Array.isArray(sx) ? sx : [sx]),
                ]}
                {...props}
            >
                <TableHead>
                    <TableRow
                        sx={(theme) => ({
                            display: "none",
                            [theme.breakpoints.down("tablet")]: {
                                display: "table-row",
                            },
                        })}
                    >
                        <TableCell colSpan={3}>
                            <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
                                <IconButton
                                    size="medium"
                                    sx={{
                                        color: "gray",
                                    }}
                                    onClick={() => {
                                        setFullscreen((prev) => !prev);
                                    }}
                                >
                                    {fullscreen ? (
                                        <Minimize2 size={theme.iconSize.lg} />
                                    ) : (
                                        <Maximize2 size={theme.iconSize.lg} />
                                    )}
                                </IconButton>
                                <Search
                                    size="small"
                                    value={filter}
                                    setValue={setFilter}
                                    sx={{
                                        p: 0,
                                        height: "100%",
                                        width: "100%",
                                    }}
                                    color="secondary"
                                />
                            </Box>
                        </TableCell>
                    </TableRow>
                    <TableRow>
                        <TableCell sx={{ width: "auto" }}>Property</TableCell>
                        <TableCell
                            sx={(theme) => ({
                                width: "50%",
                                [theme.breakpoints.down("tablet")]: {
                                    width: "100%",
                                },
                            })}
                        >
                            Value
                        </TableCell>
                        <TableCell
                            sx={(theme) => ({
                                textAlign: "right",
                                [theme.breakpoints.down("tablet")]: {
                                    display: "none",
                                },
                            })}
                        >
                            <Search
                                size="small"
                                value={filter}
                                setValue={setFilter}
                                sx={{
                                    p: 0,
                                    height: "100%",
                                    maxWidth: "300px",
                                    input: {
                                        paddingBlock: 0.5,
                                    },
                                }}
                                color="secondary"
                            />
                        </TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {filteredData.map(([key, value]) => (
                        <TableRow key={key}>
                            <TableCell
                                sx={{
                                    width: "max-content",
                                    verticalAlign: "top",
                                }}
                            >
                                {key}
                            </TableCell>
                            <TableCell colSpan={2}>
                                <Box
                                    sx={{
                                        width: "100%",
                                        overflow: "auto",
                                        maxHeight: "200px",
                                        overflowWrap: "anywhere",
                                        maxWidth: "100%",
                                    }}
                                >
                                    {String(value)}
                                </Box>
                            </TableCell>
                        </TableRow>
                    ))}
                    {nExcluded > 0 && (
                        <TableRow>
                            <TableCell colSpan={3}>
                                <Typography
                                    variant="caption"
                                    color="text.secondary"
                                    sx={{
                                        textAlign: "center",
                                        fontStyle: "italic",
                                    }}
                                >
                                    Excluded {nExcluded} more properties via filter
                                </Typography>
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        ),
        [filter, filteredData, fullscreen, nExcluded, props, sx, theme.iconSize.lg]
    );

    return (
        <>
            {table}
            <Slide direction="up" in={fullscreen} mountOnEnter unmountOnExit>
                <FullScreenOntop sx={{ overflow: "auto" }}>{table}</FullScreenOntop>
            </Slide>
        </>
    );
}
