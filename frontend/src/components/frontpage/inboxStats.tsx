import { Inbox } from "lucide-react";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import Grid from "@mui/material/Grid2";
import { useQuery } from "@tanstack/react-query";

import { inboxStatsQueryOptions } from "@/api/inbox";
import { Card, CardAvatar, CardContent } from "@/components/frontpage/card";
import { InboxStats } from "@/pythonTypes";

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
                <Grid
                    size={{
                        mobile: 12,
                        tablet: 8,
                        laptop: 8,
                        desktop: 6,
                    }}
                    key={i}
                >
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
        </Card>
    );
}

function InboxTable({ stats }: { stats: InboxStats }) {
    const size = stats.size ?? 0;
    const files = stats.nFiles ?? 0;

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
                    <td>{files}</td>
                    <td>files</td>
                </tr>
                <tr>
                    <td>{_to_mb(size)} </td>
                    <td>mb</td>
                </tr>
            </tbody>
        </table>
    );
}

function _to_mb(bytes: number) {
    return Math.round(bytes / 1024 / 1024);
}
