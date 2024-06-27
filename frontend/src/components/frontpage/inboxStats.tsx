import { FolderSync, FolderSearch, Inbox, Recycle, Trash2 } from "lucide-react";
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
import {
    IconButtonWithMutation,
    IconButtonWithMutationAndFeedback,
} from "../common/buttons";
import { useQuery } from "@tanstack/react-query";
import { RelativeTime } from "../common/time";
import Grid from "@mui/material/Unstable_Grid2";
import {
    InboxStats,
    deleteInboxImportedMutation,
    deleteInboxMutation,
    inboxStatsQueryOptions,
    retagInboxAllMutation,
    retagInboxNewMutation,
} from "@/lib/inbox";

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
                <Grid xs={12} sm={8} md={8} lg={6} key={i}>
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
                        {stats.inboxPath}
                    </Box>
                </CardAvatar>

                <div className="h-full flex flex-col justify-end">
                    <InboxTable stats={stats} />
                </div>
            </CardContent>
            <Divider className="mt-auto" />
            <CardActions>
                <div className="flex flex-row space-x-4">
                    <IconButtonWithMutationAndFeedback
                        mutationOption={deleteInboxMutation}
                        mutateArgs={stats.inboxName}
                        color="error"
                        confirmTitle="Are you sure you want to delete all files?"
                    >
                        <Tooltip title="Delete all files in the inbox">
                            <Trash2 size="1em" />
                        </Tooltip>
                    </IconButtonWithMutationAndFeedback>
                    <IconButtonWithMutation
                        mutationOption={deleteInboxImportedMutation}
                        mutateArgs={stats.inboxName}
                        color="warning"
                    >
                        <Tooltip title="Delete files that have been imported">
                            <Recycle size="1em" />
                        </Tooltip>
                    </IconButtonWithMutation>
                </div>
                <div className="flex flex-row space-x-4">
                    <IconButtonWithMutation
                        mutationOption={retagInboxAllMutation}
                        mutateArgs={stats.inboxPath}
                        color="warning"
                    >
                        <Tooltip title="Re-tag all files in the inbox">
                            <FolderSync size="1em" />
                        </Tooltip>
                    </IconButtonWithMutation>
                    <IconButtonWithMutation
                        mutationOption={retagInboxNewMutation}
                        mutateArgs={stats.inboxPath}
                        color="primary"
                    >
                        <Tooltip title="Tag new files in the inbox">
                            <FolderSearch size="1em" />
                        </Tooltip>
                    </IconButtonWithMutation>
                </div>
            </CardActions>
        </Card>
    );
}

function InboxTable({ stats }: { stats: InboxStats }) {


    const size = stats?.size ?? 0;
    const sizeTagged = stats?.sizeTagged ?? 0;

    const files = stats?.nFiles ?? 0;
    const filesTagged = stats?.nTagged ?? 0;



    return (
        <table className="table-info text-gray-100 text-sm">
            <thead>
                <tr>
                    <th>
                        <span>Untagged</span>
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
                    <td>{files - filesTagged}</td>
                    <td>{filesTagged}</td>
                    <td>{files}</td>
                    <td>files</td>
                </tr>
                <tr>
                    <td>
                        {
                            _to_mb(size - sizeTagged)
                        }
                    </td>
                    <td>{
                        _to_mb(sizeTagged)
                    }
                    </td>
                    <td>{_to_mb(size)} </td>
                    <td>mb</td>
                </tr>
            </tbody>
        </table>
    );
}


function _to_mb(bytes: number) {
    return Math.round(bytes / 1024 / 1024)
}
