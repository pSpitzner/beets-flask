import { FolderSync, Inbox, Recycle, Trash2 } from "lucide-react";
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
import { IconButtonWithMutation, IconButtonWithMutationAndFeedback } from "../common/buttons";
import { InboxStats, inboxStatsQueryOptions } from "@/lib/stats";
import { useQuery } from "@tanstack/react-query";
import { RelativeTime } from "../common/time";
import Grid from "@mui/material/Unstable_Grid2";
import { deleteInboxImportedMutation, deleteInboxMutation, retagInboxAllMutation, retagInboxMutation } from "@/lib/inbox";

export function InboxStatsGridItems() {
    const { data, isLoading, isPending, isError, error } = useQuery(
        inboxStatsQueryOptions()
    );

    if (isError) {
        return (
            <Card>
                <CardContent>Error: {error.message}</CardContent>
            </Card>
        );
    }
    if (isPending || isLoading) {
        return (
            <Card>
                <CardContent>Loading...</CardContent>
            </Card>
        );
    }

    return (
        <>
            {data.map((stats, i) => (
                <Grid xs={12} sm={8} md={8} lg={6} key={i} >
                    <InboxCardView stats={stats} />
                </Grid>
            ))}
        </>
    );
}

function InboxCardView({ stats }: { stats: InboxStats }) {
    return (
        <Card>
            <CardContent>
                {stats.lastTagged && (
                    <CardTopInfo>
                        <label>
                            Last tagged: <RelativeTime date={stats.lastTagged} />
                            Last tagged: <>{stats.lastTagged}</>
                        </label>
                    </CardTopInfo>
                )}
                <CardAvatar Icon={Inbox} title={stats.inboxName}>
                    <Box
                        component="code"
                        sx={{
                            fontSize: 14,
                            color: "grey.500",
                            marginBottom: "0.875em",
                        }}
                    >
                        {stats.mountPoint}
                    </Box>
                </CardAvatar>

                <div className="h-full flex flex-col justify-end">
                    <InboxTable stats={stats} />
                </div>
            </CardContent>
            <Divider className="mt-auto" />
            <CardActions>
                <div className="flex flex-row space-x-4">
                    <IconButtonWithMutationAndFeedback mutationOption={deleteInboxMutation} mutateArgs={stats.inboxName}
                        color="error" confirmTitle="Are you sure you want to delete all files?">
                        <Tooltip title="Delete all files in the inbox">
                            <Trash2 size="1em" />
                        </Tooltip>
                    </IconButtonWithMutationAndFeedback>
                    <IconButtonWithMutation mutationOption={deleteInboxImportedMutation} mutateArgs={stats.inboxName} color="warning">
                        <Tooltip title="Delete all already imported files in the inbox">
                            <Recycle size="1em" />
                        </Tooltip>
                    </IconButtonWithMutation>
                </div>
                <div className="flex flex-row space-x-4">
                    <IconButtonWithMutation mutationOption={retagInboxAllMutation} color="warning">
                        <Tooltip title="Scan the inbox folder for new files">
                            <FolderSync size="1em" />
                        </Tooltip>
                    </IconButtonWithMutation>
                    <IconButtonWithMutation mutationOption={retagInboxMutation} color="primary">
                        <Tooltip title="Scan the inbox folder for new files">
                            <FolderSync size="1em" />
                        </Tooltip>
                    </IconButtonWithMutation>
                </div>
            </CardActions>
        </Card >
    );
}

function InboxTable({ stats }: { stats: InboxStats }) {
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
                    <td>{stats?.nFiles}</td>
                    <td>files</td>
                </tr>
                <tr>
                    <td>?</td>
                    <td>?</td>
                    <td>{Math.round((stats?.size ?? 0) / 1024 / 1024)} </td>
                    <td>mb</td>
                </tr>
            </tbody>
        </table>
    );
}

