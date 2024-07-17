import { ReactNode } from "react";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableRow from "@mui/material/TableRow";

import { Item } from "@/components/common/_query";

export default function ItemDetailsTableView({
    item,
    keys,
}: {
    item: Item;
    keys?: string | string[];
}) {
    if (!keys || keys === "basic") {
        keys = [
            "name",
            "artist",
            "albumartist",
            "album",
            "albumtype",
            "comp",
            "genre",
            "label",
            "isrc",
            "bpm",
            "initialkey",
            "year",
            "added",
            "length",
            "size",
            "bitrate",
            "samplerate",
            "path",
        ];
    } else if (keys === "all") {
        keys = Object.keys(item);
    }

    keys = keys as string[];

    return (
        <TableContainer>
            <Table size="small">
                <TableBody>
                    {keys.map((key, i) => {
                        return (
                            <TableRow
                                key={i}
                                sx={{
                                    "&:last-child td, &:last-child th": { border: 0 },
                                    "td, th": { borderBottom: "0.5px solid #495057" },
                                }}
                            >
                                <TableCell align="right">{key}</TableCell>
                                <TableCell align="left">
                                    {parse(key, item[key])}
                                </TableCell>
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>
        </TableContainer>
    );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parse(key: string, value: any): ReactNode {
    // format n/a
    if (value === null || value === undefined || value === "") {
        return <span style={{ opacity: 0.3 }}>n/a</span>;
    }
    if (key === "length") {
        // format to 2h 30:12
        const hours = Math.floor(value / 3600);
        const minutes = Math.floor((value % 3600) / 60);
        const seconds = Math.floor(value % 60);
        return `${hours ? `${hours}h ` : ""}${minutes}:${seconds.toString().padStart(2, "0")}`;
    }
    if (key === "size") {
        // format to 2.3 MB
        const size = value / 1024 / 1024;
        return `${size.toFixed(1)} MB`;
    }
    if (key === "samplerate") {
        // format to 44.1 kHz
        return `${value / 1000} kHz`;
    }
    if (key === "bitrate") {
        // format to 320 kbps, no past decimal
        return `${Math.round(value / 1000)} kbps`;
    }
    if (["mtime", "added"].includes(key)) {
        // format to 2023-07-14 12:34:56
        return new Date(value * 1000).toLocaleString();
    }
    if (key === "comp") {
        // format to Yes/No
        return value ? "Yes" : "No";
    }
    if (key === "bpm" && value === 0) {
        // format to n/a
        return <span style={{ opacity: 0.3 }}>n/a</span>;
    }
    return value as string;
}
