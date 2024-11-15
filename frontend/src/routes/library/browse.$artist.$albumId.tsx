import { useMemo } from "react";
import z from "zod";
import { Box, Paper } from "@mui/material";
import { createFileRoute, Outlet, useParams } from "@tanstack/react-router";

import { Album, albumQueryOptions, LIB_BROWSE_ROUTE } from "@/components/common/_query";
import LoadingIndicator from "@/components/common/loadingIndicator";
import { BrowserHeader } from "@/components/library/browserHeader";
import List from "@/components/library/list";

import styles from "@/components/library/library.module.scss";

export const Route = createFileRoute(`${LIB_BROWSE_ROUTE}/$artist/$albumId`)({
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

function AlbumOverview() {
    const album = Route.useLoaderData();
    const params = useParams({ from: "/library/browse/$artist/$albumId/$itemId" });

    const data = useMemo(() => {
        return (album as Album).items?.map((item) => ({
            to: `${LIB_BROWSE_ROUTE}/$artist/$albumId/$itemId`,
            params: { artist: params.artist, albumId: params.albumId, itemId: item.id },
            label: item.name,
            className: styles.listItem,
            "data-selected": params.itemId && params.itemId == item.id,
        }));
    }, [album, params]);

    // for mobile, we only want to show one central column.
    const isSecondary = Boolean(params.itemId);

    return (
        <>
            <Paper className={`${styles.column} ${isSecondary ? styles.isSecondary : ""}`}>
                <Box className={styles.columnLabel}>Item</Box>
                <BrowserHeader className={styles.browserHeader} />
                {album && data ? (
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
