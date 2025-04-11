import { AudioLinesIcon } from "lucide-react";
import { useMemo } from "react";
import z from "zod";
import { Typography, useMediaQuery } from "@mui/material";
import { createFileRoute, Link, Outlet, useParams } from "@tanstack/react-router";

import { albumQueryOptions } from "@/api/library";

import { LibraryList, Selection } from "./browse";

import styles from "./library.module.scss";

export const Route = createFileRoute(`/library/browse/$artist/$albumId`)({
    parseParams: (params) => ({
        albumId: z.number().int().parse(parseInt(params.albumId)),
    }),
    loader: async (opts) =>
        await opts.context.queryClient.ensureQueryData(
            albumQueryOptions(
                opts.params.albumId,
                true, // expand
                true // minimal
            )
        ),
    component: ItemsRoute,
});

function ItemsRoute() {
    return (
        <>
            <Selection sx={{ gridColumn: "items" }}>
                <Items />
            </Selection>
            <Outlet />
        </>
    );
}

/** A list of all items (for the current album).
 *
 * On mobile if an item is selected the
 * current item is shown as a breadcrumb instead.
 */
function Items() {
    const album = Route.useLoaderData();
    const params = useParams({ strict: false });
    const isMobile = useMediaQuery((theme) => theme.breakpoints.down("laptop"));

    const data = useMemo(() => {
        return album.items.map((item) => ({
            to:
                params.itemId == item.id
                    ? `/library/browse/$artist/$albumId`
                    : `/library/browse/$artist/$albumId/$itemId`,
            params: { artist: params.artist, albumId: params.albumId, itemId: item.id },
            label: item.name,
            className: styles.item,
            "data-selected": params.itemId && params.itemId == item.id,
        }));
    }, [album, params]);

    const selectedData = data.find((item) => item["data-selected"]);

    if (isMobile && selectedData) {
        return (
            <Link
                to={selectedData.to}
                params={selectedData.params}
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    paddingInline: 4,
                }}
            >
                <AudioLinesIcon size={18} color={"gray"} />
                <Typography variant="body2" color="text.secondary">
                    {selectedData.label}
                </Typography>
            </Link>
        );
    }

    return (
        <LibraryList
            data={data}
            selected={selectedData}
            label="Items"
            labelIcon={<AudioLinesIcon />}
        />
    );
}
