import { useMemo } from "react";
import Box from "@mui/material/Box";
import { createFileRoute, Link, Outlet, useParams } from "@tanstack/react-router";

import { artistsQueryOptions, LIB_BROWSE_ROUTE } from "@/components/common/_query";
import List from "@/components/library/list";

import styles from "./library.module.scss";
import { styled, useMediaQuery, useTheme } from "@mui/material";

export const Route = createFileRoute(LIB_BROWSE_ROUTE)({
    loader: (opts) => opts.context.queryClient.ensureQueryData(artistsQueryOptions()),
    component: () => <ArtistRoute />,
});

function ArtistRoute() {
    return (
        <>
            <Wrapper>
                <Selection sx={{ gridColumn: "artists" }}>
                    <Artists />
                </Selection>
                <Outlet />
            </Wrapper>
        </>
    );
}

/** A list of all artists.
 *
 * On mobile if an artist is selected the
 * current artist is shown as a breadcrumb instead.
 */
function Artists() {
    const artists = Route.useLoaderData();
    const params = useParams({ strict: false });
    const isMobile = useMediaQuery(useTheme().breakpoints.down("laptop"));

    const data = useMemo(() => {
        return artists.map((artist) => ({
            // Allow to deselect the artist
            to:
                params.artist == artist.name
                    ? `${LIB_BROWSE_ROUTE}`
                    : `${LIB_BROWSE_ROUTE}/$artist`,
            params: { artist: artist.name },
            label: artist.name,
            className: styles.item,
            "data-selected": params.artist && params.artist == artist.name,
        }));
    }, [artists, params]);

    const selectedData = data.find((item) => item["data-selected"]);

    if (isMobile && selectedData) {
        return (
            <Link to={selectedData.to} params={selectedData.params}>
                {selectedData.label}
            </Link>
        );
    }

    // full list
    return (
        <Box
            sx={(theme) => ({
                display: "flex",
                flexDirection: "column",
                gap: theme.spacing(1),
                maxWidth: theme.breakpoints.values.laptop,
                width: "100%",
                height: "100%",
            })}
            data-has-selection={selectedData ? "true" : "false"}
        >
            <Box className={styles.label}>Artists</Box>
            <Box className={styles.list}>
                <List data={data}>{List.Item}</List>
            </Box>
        </Box>
    );
}

export const Wrapper = styled(Box)(({ theme }) => ({
    display: "grid",
    gridTemplateColumns: "[artists] 1fr [albums] 1fr [items] 1fr",
    gridTemplateRows: "[selection] auto [content] auto",
    gap: theme.spacing(1),
    height: "100%",
    width: "100%",
    overflow: "hidden",
    padding: theme.spacing(1),
    maxWidth: theme.breakpoints.values.laptop * 3,
    alignItems: "center",
    [theme.breakpoints.down("laptop")]: {
        display: "flex",
        flexWrap: "wrap",
        flexDirection: "row",
    },

    // Adjust grid columns based on content
    ":has(> *:nth-last-child(1))": {
        // one child
        gridTemplateColumns: "[artists] 1fr",
    },

    ":has(> *:nth-last-child(2))": {
        // two children
        gridTemplateColumns: "auto [artists] 1fr [albums] 1fr auto",
    },

    ":has(> *:nth-last-child(3))": {
        // three children
        gridTemplateColumns: "[artists] 1fr [albums] 1fr [items] 1fr",
    },
}));

export const Selection = styled(Box)(({ theme }) => ({
    display: "flex",
    flexDirection: "column",
    width: "100%",
    gridRow: "selection",
    gap: theme.spacing(1),
    minHeight: "200px",
    height: "100%",

    ":nth-last-child(1) > *": {
        // one child
        alignSelf: "center",
    },

    // two children
    ":nth-last-child(2) ~ div > *": {
        alignSelf: "flex-start",
    },
    ":nth-last-child(2) > *": {
        alignSelf: "flex-end",
    },
    ":nth-last-child(3) ~ div > *": {
        // three children
        alignSelf: "flex-start",
    },

    [theme.breakpoints.down("laptop")]: {
        ":has(> a)": {
            display: "block",
            width: "unset",
            height: "auto",
            minHeight: "unset",
            backgroundColor: theme.palette.background.paper,
        },
    },
}));

export const Content = styled(Box)(({ theme }) => ({
    display: "flex",
    flexDirection: "column",
    gridColumn: "1 / -1",
    width: "100%",
    height: "100%",
    gridRow: "content",
    overflow: "hidden",
    gap: theme.spacing(1),
}));
