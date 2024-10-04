import { Bug as BugOn, BugOff } from "lucide-react";
import { useState } from "react";
import { ReactNode, useMemo } from "react";
import { Box, CircularProgress } from "@mui/material";
import IconButton from "@mui/material/IconButton";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableRow from "@mui/material/TableRow";
import Tooltip from "@mui/material/Tooltip";
import { useQuery } from "@tanstack/react-query";

import {
    Album,
    albumQueryOptions,
    Item,
    itemQueryOptions,
} from "@/components/common/_query";
import { JSONPretty } from "@/components/common/json";

export function ItemView({ itemId }: { itemId?: number }) {
    const [detailed, setDetailed] = useState(false);
    const {
        data: item,
        isFetching,
        isError,
        error,
        isSuccess,
    } = useQuery(itemQueryOptions({ id: itemId, minimal: false, expand: true }));

    return (
        <>
            <Box
                sx={{
                    display: "flex",
                    flexDirection: "column",
                    flexGrow: 1,
                    alignItems: "center",
                    justifyContent: "flex-start",
                    overflow: "auto",
                }}
            >
                {isSuccess && (
                    <>
                        <Tooltip title="Toggle Details" className="ml-auto mt-1">
                            <IconButton
                                color="primary"
                                onClick={() => setDetailed(!detailed)}
                            >
                                {detailed && <BugOff size="1em" />}
                                {!detailed && <BugOn size="1em" />}
                            </IconButton>
                        </Tooltip>
                        <DetailsTable obj={item!} keys={detailed ? "all" : "basic"} />
                    </>
                )}
                {!isSuccess && isFetching && (
                    <Box sx={{ margin: "auto" }}>
                        <CircularProgress />
                    </Box>
                )}
                {isError && (
                    <>
                        <span>Error:</span>
                        <JSONPretty error={error} />
                    </>
                )}
            </Box>
        </>
    );
}

// for now this is the same as ItemView.
export function AlbumView({ albumId }: { albumId?: number }) {
    const [detailed, setDetailed] = useState(false);
    const { data, isFetching, isError, error, isSuccess } = useQuery(
        albumQueryOptions({ id: albumId, minimal: false, expand: false })
    );
    const album = data as Album;

    return (
        <>
            <Box
                sx={{
                    display: "flex",
                    flexDirection: "column",
                    flexGrow: 1,
                    alignItems: "center",
                    justifyContent: "flex-start",
                    overflow: "auto",
                }}
            >
                {isSuccess && (
                    <>
                        <Tooltip title="Toggle Details" className="ml-auto mt-1">
                            <IconButton
                                color="primary"
                                onClick={() => setDetailed(!detailed)}
                            >
                                {detailed && <BugOff size="1em" />}
                                {!detailed && <BugOn size="1em" />}
                            </IconButton>
                        </Tooltip>
                        <DetailsTable obj={album} keys={detailed ? "all" : "basic"} />
                    </>
                )}
                {!isSuccess && isFetching && (
                    <Box sx={{ margin: "auto" }}>
                        <CircularProgress />
                    </Box>
                )}
                {isError && (
                    <>
                        <span>Error:</span>
                        <JSONPretty error={error} />
                    </>
                )}
            </Box>
        </>
    );
}

const basicItemKeys = [
    "title",
    "artist",
    "albumartist",
    "album",
    "albumtype",
    "comp",
    "genre",
    "label",
    "isrc",
    "bpm",
    "initial_key",
    "year",
    "added",
    "length",
    "size",
    "bitrate",
    "samplerate",
    "path",
];

const basicAlbumKeys = [
    "album",
    "albumartist",
    "albumtype",
    "genre",
    "comp",
    "label",
    "year",
    "added",
];

export function DetailsTable({
    obj,
    keys,
}: {
    obj: Item | Album;
    keys?: string | string[];
}) {
    // albums only have an albumartist (not artist), so we can use this to distinguish
    const isItem = (item: unknown): item is Item => {
        return (item as Item).artist !== undefined;
    };

    if (!keys || keys === "basic") {
        keys = isItem(obj) ? basicItemKeys : basicAlbumKeys;
    } else if (keys === "all") {
        keys = Object.keys(obj);
        // we only added name for backend-frontend consistency, its not a beets-field
        // note: this could cause problems if a user adds a custom field "name"
        keys = keys.filter((key) => key !== "name");
    }

    keys = keys as string[];

    const maxKeyWidth = useMemo(() => {
        const keyWidths = keys.map((key) => key.length);
        return Math.max(...keyWidths) * 10;
    }, [keys]);

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
                                <TableCell
                                    align="right"
                                    sx={{
                                        width: maxKeyWidth,
                                    }}
                                >
                                    {key}
                                </TableCell>
                                <TableCell align="left">
                                    {parse(key, obj[key])}
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
