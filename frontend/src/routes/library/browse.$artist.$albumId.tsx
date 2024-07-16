import List from "@/components/common/list";
import { Album, albumQueryOptions } from "@/lib/library";
import { Outlet, createFileRoute } from "@tanstack/react-router";
import z from "zod";
import styles from "./browse.module.scss";
import { BASE_ROUTE } from "./browse";
import { useMemo } from "react";
import { Paper } from "@mui/material";

export const Route = createFileRoute(`${BASE_ROUTE}/$artist/$albumId`)({
    parseParams: (params) => ({
        albumId: z.number().int().parse(parseInt(params.albumId)),
    }),
    loader: (opts) =>
        opts.context.queryClient.ensureQueryData(
            albumQueryOptions({
                id: opts.params.albumId,
                expand: true,
                minimal: true,
            })
        ),
    component: AlbumOverview,
});

interface RouteParams {
    artist: string;
    albumId: number;
    itemId?: number;
}

function AlbumOverview() {
    const album = Route.useLoaderData();
    const params = Route.useParams<RouteParams>();

    const data = useMemo(() => {
        return (album as Album).items.map((item) => ({
            to: `${BASE_ROUTE}/$artist/$albumId/$itemId`,
            params: { artist: params.artist, albumId: params.albumId, itemId: item.id },
            label: item.name,
            className: styles.listItem,
            "data-selected": params.itemId && params.itemId == item.id
        }));
    }, [album, params]);

    return (
        <>
            <Paper className={styles.listBox}>
                <List data={data}>{List.Item}</List>
            </Paper>
            <Outlet />
        </>
    );
}
