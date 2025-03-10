import { Library, RefreshCcw } from "lucide-react";
import { Box, Divider, Tooltip } from "@mui/material";
import { useQuery } from "@tanstack/react-query";

import { libraryStatsQueryOptions } from "@/components/common/_query";
import { IconButtonWithMutation } from "@/components/common/buttons";
import { JSONPretty } from "@/components/common/json";
import { RelativeTime } from "@/components/common/units/time";
import {
    Card,
    CardActions,
    CardAvatar,
    CardContent,
    CardTopInfo,
} from "@/components/frontpage/card";

import { humanizeBytes } from "../common/units/bytes";

export function LibraryStats() {
    const { data } = useQuery(libraryStatsQueryOptions());

    return (
        <Card>
            <CardContent>
                <LastAddedInfo />
                <CardAvatar Icon={Library} title="Library">
                    <Box
                        component="code"
                        sx={{
                            fontSize: 14,
                            color: "grey.500",
                            marginBottom: "0.875em",
                        }}
                    >
                        {data?.libraryPath ?? "Loading..."}
                    </Box>
                </CardAvatar>
                <div className="h-full flex flex-col justify-end ">
                    <LibraryTable />
                </div>
            </CardContent>
            <Divider className="mt-auto" />
            <CardActions>
                <div className="flex flex-row space-x-4"></div>
                <div className="flex flex-row space-x-4">
                    <IconButtonWithMutation
                        className="ms-auto"
                        disabled
                        color="primary"
                    >
                        <Tooltip title="Refresh library stats">
                            <RefreshCcw size="1em" />
                        </Tooltip>
                    </IconButtonWithMutation>
                </div>
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
                        <th>Artists</th>
                        <td>{data.artists}</td>
                    </tr>
                    <tr>
                        <th>Labels</th>
                        <td>{data.labels}</td>
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
                        <th>Genres</th>
                        <td>{data.genres}</td>
                    </tr>
                    <tr>
                        <th>Size</th>
                        <td>{humanizeBytes(data.size)}</td>
                    </tr>
                </tbody>
            </table>
        </div>
    );
}

function LastAddedInfo() {
    const { data, isLoading, isPending, isError } = useQuery(
        libraryStatsQueryOptions()
    );

    if (isPending || isLoading) {
        return <div>Loading...</div>;
    }
    if (isError) {
        return null;
    }

    return (
        <CardTopInfo>
            Last added: <RelativeTime date={data.lastItemAdded} />
        </CardTopInfo>
    );
}
