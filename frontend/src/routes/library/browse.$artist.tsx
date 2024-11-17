import { useMemo } from "react";
import z from "zod";
import { Box, Paper } from "@mui/material";
import { createFileRoute, Outlet, useParams } from "@tanstack/react-router";

import { artistQueryOptions, LIB_BROWSE_ROUTE } from "@/components/common/_query";
import LoadingIndicator from "@/components/common/loadingIndicator";
import { BrowserHeader } from "@/components/library/browserHeader";
import List from "@/components/library/list";

import styles from "@/components/library/library.module.scss";

export const Route = createFileRoute(`${LIB_BROWSE_ROUTE}/$artist`)({
    loader: (opts) =>
        opts.context.queryClient.ensureQueryData(
            artistQueryOptions({
                name: opts.params.artist,
                minimal: true,
                expand: true,
            })
        ),
    component: ArtistOverview,
    params: {
        parse: (params) => ({
            artist: z.string().parse(params.artist),
        }),
    },
});

function ArtistOverview() {
    const artist = Route.useLoaderData();
    const params = useParams({ strict: false });

    const data = useMemo(() => {
        return artist.albums.map((album) => ({
            to: `${LIB_BROWSE_ROUTE}/$artist/$albumId`,
            params: { artist: params.artist, albumId: album.id },
            label: album.name,
            className: styles.listItem,
            "data-selected": params.albumId && params.albumId == album.id,
        }));
    }, [artist, params]);

    console.log("browse.$artist ", artist, data);

    // for mobile, we only want to show one central column.
    const isSecondary = Boolean(params.albumId);

    return (
        <>
            <Paper
                className={`${styles.column} ${isSecondary ? styles.isSecondary : ""}`}
            >
                <Box className={styles.columnLabel}>Album</Box>
                <BrowserHeader className={styles.browserHeader} />
                {artist && data ? (
                    <Box className={styles.listBox}>
                        <List data={data}>{List.Item}</List>
                    </Box>
                ) : (
                    <LoadingIndicator />
                )}
            </Paper>
            <Outlet />
        </>
    );
}
