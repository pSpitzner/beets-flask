import {
    Card,
    CardContent,
    CardActions,
    CardAvatar,
    CardTopInfo,
} from "@/components/common/card";
import { libraryStatsQueryOptions } from "@/lib/stats";
import { JSONPretty } from "../json";
import { useQuery } from "@tanstack/react-query";
import { Divider, Tooltip } from "@mui/material";
import { Library, Trash2 } from "lucide-react";
import { IconButtonWithMutation } from "../common/buttons";
import { RelativeTime } from "../common/time";

export function LibraryStats() {
    return (
        <Card>
            <CardContent>
                <LastAddedInfo />
                <CardAvatar Icon={Library} title="Library"></CardAvatar>
                <div className="h-full flex flex-col justify-end ">
                    <LibraryTable />
                </div>
            </CardContent>
            <Divider className="mt-auto" />
            <CardActions>
                <IconButtonWithMutation color="error">
                    <Tooltip title="Delete all files in the inbox">
                        <Trash2 size="1em" />
                    </Tooltip>
                </IconButtonWithMutation>
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
                        <td>{Math.round(data.size / 1024 / 1024)}mb</td>
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
