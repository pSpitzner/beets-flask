import { FileScan, Inbox, Recycle, Trash2 } from "lucide-react";
import {
    Card,
    CardContent,
    CardActions,
    CardAvatar,
    CardTopInfo,
} from "@/components/common/card";
import Divider from "@mui/material/Divider";
import Tooltip from "@mui/material/Tooltip";
import Box from "@mui/material/Box";
import { IconButtonWithMutation } from "../common/buttons";
import { inboxStatsQueryOptions } from "@/lib/stats";
import { useQuery } from "@tanstack/react-query";
import { RelativeTime } from "../common/time";
import { JSONPretty } from "../json";

export function InboxStatsOverview() {
    return (
        <Card>
            <CardContent>
                <LastScanned />
                <CardAvatar Icon={Inbox} title="Inbox">
                    <Box
                        component="code"
                        sx={{
                            fontSize: 14,
                            color: "grey.500",
                            marginBottom: "0.875em",
                        }}
                    >
                        /my/mount/point
                    </Box>
                </CardAvatar>

                <div className="h-full flex flex-col justify-end">
                    <InboxTable />
                </div>
            </CardContent>
            <Divider className="mt-auto" />
            <CardActions>
                <Tooltip title="Delete all files in the inbox">
                    <div>
                        <IconButtonWithMutation color="error">
                            <Trash2 size="1em" />
                        </IconButtonWithMutation>
                    </div>
                </Tooltip>
                <div className="flex flex-row space-x-4">
                    <Tooltip title="Delete all already tagged files in the inbox">
                        <div>
                            <IconButtonWithMutation color="warning">
                                <Recycle size="1em" />
                            </IconButtonWithMutation>
                        </div>
                    </Tooltip>
                    <Tooltip title="Scan the inbox folder for new files">
                        <div>
                            <IconButtonWithMutation color="primary">
                                <FileScan size="1em" />
                            </IconButtonWithMutation>
                        </div>
                    </Tooltip>
                </div>
            </CardActions>
        </Card>
    );
}

function InboxTable() {
    const { data, isLoading, isPending, isError, error } = useQuery(
        inboxStatsQueryOptions()
    );

    if (isError) {
        return <JSONPretty json={error} />;
    }
    if (isPending || isLoading) {
        return <div>Loading...</div>;
    }

    return (
        <table className="table-info text-gray-100 text-sm">
            <thead>
                <tr>
                    <th>
                        <span>New</span>
                    </th>
                    <th>
                        <span>Tagged</span>
                    </th>
                    <th>Total</th>
                    <th></th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>?</td>
                    <td>?</td>
                    <td>{data?.nFiles}</td>
                    <td>files</td>
                </tr>
                <tr>
                    <td>?</td>
                    <td>?</td>
                    <td>{Math.round((data?.size ?? 0) / 1024 / 1024)} </td>
                    <td>mb</td>
                </tr>
            </tbody>
        </table>
    );
}

function LastScanned() {
    const { data, isLoading, isPending, isError } = useQuery(inboxStatsQueryOptions());

    if (isPending || isLoading) {
        return <div>Loading...</div>;
    }
    if (isError) {
        return null;
    }

    return (
        <CardTopInfo>
            <label>
                Last scanned: <RelativeTime date={new Date()} />
            </label>
        </CardTopInfo>
    );
}
