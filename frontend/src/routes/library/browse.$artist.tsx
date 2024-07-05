import List from "@/components/common/list";
import { artistQueryOptions } from "@/lib/library";
import Box from "@mui/material/Box";
import { Outlet, createFileRoute } from "@tanstack/react-router";
import z from "zod";
import styles from "./browse.module.scss";
import { BASE_ROUTE } from "./browse";
import { useMemo } from "react";

export const Route = createFileRoute(`${BASE_ROUTE}/$artist`)({
    parseParams: (params) => ({
        artist: z.string().parse(params.artist),
    }),
    loader: (opts) =>
        opts.context.queryClient.ensureQueryData(
            artistQueryOptions({
                name: opts.params.artist,
                minimal: true,
                expand: true,
            })
        ),
    component: ArtistOverview,
});

function ArtistOverview() {
    const artist = Route.useLoaderData();
    const params = Route.useParams() as {
        artist: string;
        albumId?: number;
    };

    const data = useMemo(() => {
        return artist.albums.map((album) => ({
            to: `${BASE_ROUTE}/$artist/$albumId`,
            params: { artist: params.artist, albumId: album.id },
            label: album.name,
            className: styles.listItem,
            "data-selected": params.albumId == album.id,
        }));
    }, [artist, params]);

    return (
        <>
            <Box className={styles.listBox}>
                <List data={data}>{List.Item}</List>
            </Box>
            <Outlet />
        </>
    );
}
