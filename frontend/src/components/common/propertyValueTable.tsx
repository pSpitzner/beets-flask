import { useMemo, useState } from "react";
import {
    Box,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableProps,
    TableRow,
    Typography,
} from "@mui/material";

import { Search } from "./inputs/search";

type Serializable = string | number | boolean | null | undefined;

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

    return (
        <Table
            size="small"
            sx={[
                {
                    //display: "grid",
                    width: "100%",
                    borderCollapse: "separate",
                    maxHeight: "400px",
                    height: "100%",
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
                        <Search
                            size="small"
                            value={filter}
                            setValue={setFilter}
                            sx={{
                                marginTop: 1,
                                p: 0,
                                height: "100%",
                                width: "100%",
                            }}
                            color="secondary"
                        />
                    </TableCell>
                </TableRow>
                <TableRow>
                    <TableCell sx={{ width: "auto" }}>Property</TableCell>
                    <TableCell sx={{ width: "50%" }}>Value</TableCell>
                    <TableCell
                        sx={(theme) => ({
                            width: "50%",
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
                                {nExcluded} more properties excluded via filter
                            </Typography>
                        </TableCell>
                    </TableRow>
                )}
            </TableBody>
        </Table>
    );
}
