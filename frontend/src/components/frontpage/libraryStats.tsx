import { Card, CardContent, CardActions } from "@/components/common/card";
import { libraryStatsQueryOptions } from "@/lib/stats";
import { JSONPretty } from "../json";
import { useQuery } from "@tanstack/react-query";
import { Avatar, Box, Divider, Tooltip } from "@mui/material";
import { Library, Trash2 } from "lucide-react";
import { IconButtonWithMutation } from "../common/buttons";

export function LibraryStats() {
    return (
        <Card>
            <CardContent className="flex flex-row justify-between">
                <div className="flex flex-col space-x-1 overflow-visible justify-start items-center p-1">
                    <Avatar
                        sx={{
                            width: 60,
                            height: 60,
                            margin: "auto",
                            backgroundColor: "transparent",
                            color: "primary.main",
                        }}
                        variant="rounded"
                    >
                        <Library size="100%" />
                    </Avatar>
                    <Box
                        component="h3"
                        sx={{
                            fontSize: 18,
                            fontWeight: "bold",
                            letterSpacing: "0.5px",
                            marginTop: 1,
                            marginBottom: 0,
                        }}
                    >
                        Library
                    </Box>
                </div>

                <div className="flex flex-col justify-end">
                    <LibraryTable />
                </div>
            </CardContent>
            <Divider className="mt-auto" />
            <CardActions>
                <Tooltip title="Delete all files in the inbox">
                    <IconButtonWithMutation color="error">
                        <Trash2 size="1em" />
                    </IconButtonWithMutation>
                </Tooltip>
            </CardActions>
        </Card>
    );
}

function LibraryTable() {
    const { data, isLoading, isPending, isError, error } = useQuery(
        libraryStatsQueryOptions()
    );

    if (isError) {
        return <JSONPretty json={error} />;
    }
    if (isPending || isLoading) {
        return <div>Loading...</div>;
    }

    return (
        <div className="flex flex-row space-x-2">
            <table className="table-info text-gray-100 text-sm">
                <tbody>
                    <tr>
                        <th>Items</th>
                        <td>{data.items}</td>
                    </tr>
                    <tr>
                        <th>Size</th>
                        <td>{Math.round(data.size / 1024 / 1024)}mb</td>
                    </tr>
                    <tr>
                        <th>Last Item Added</th>
                        <td>
                            {data.lastItemAdded.getDate()}
                            {"."}
                            {data.lastItemAdded.getMonth()}
                            {"."}
                            {data.lastItemAdded.getFullYear()}
                        </td>
                    </tr>
                </tbody>
            </table>
            <table className="table-info text-gray-100 text-sm">
                <tbody>
                    <tr>
                        <th>Albums</th>
                        <td>{data.albums}</td>
                    </tr>
                    <tr>
                        <th>Artists</th>
                        <td>{data.artists}</td>
                    </tr>
                    <tr>
                        <th>Genres</th>
                        <td>{data.genres}</td>
                    </tr>
                </tbody>
            </table>
        </div>
    );
}
