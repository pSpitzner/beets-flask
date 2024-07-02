import List from "@/components/common/list";
import { Album, albumQueryOptions } from "@/lib/library";
import Box from "@mui/material/Box";
import { Outlet, createFileRoute, useParams } from "@tanstack/react-router";
import z from "zod";
import styles from "./browse.module.scss";
import { useMemo } from "react";

export const Route = createFileRoute("/library/browse/$artist/$albumId")({
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

/** Shows all
 * albums of an artist
 */
function AlbumOverview() {
    const album = Route.useLoaderData() as Album;
    const params = useParams({ strict: false }) as { itemId?: number };


    const data = useMemo(()=>{
        return album.items.map((item,) => ({
            to:item.id.toString(),
            label:item.name,
            className:styles.listItem,
            "data-selected": item.id === params.itemId,
        }));
    }, [album, params]);


    return (
        <>
            <Box className={styles.listBox}>
                <List data={data}>
                    {List.Item}
                </List>
            </Box>
            <Outlet />
        </>
    );
}
