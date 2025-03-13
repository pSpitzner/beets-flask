import { useMemo, useState } from "react";
import Box from "@mui/material/Box";
import { createFileRoute, Link, Outlet, useParams } from "@tanstack/react-router";

import { artistsQueryOptions, LIB_BROWSE_ROUTE } from "@/components/common/_query";
import List, { ListItemData } from "@/components/library/list";

import { styled, Typography, useMediaQuery, useTheme } from "@mui/material";
import { Search } from "@/components/common/inputs/search";

import styles from "./library.module.scss";

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
            <Link
                to={selectedData.to}
                params={selectedData.params}
                style={{ padding: "1rem" }}
            >
                {selectedData.label}
            </Link>
        );
    }

    // full list
    return <LibraryList data={data} selected={selectedData} label="Artists" />;
}

export const Wrapper = styled(Box)(({ theme }) => ({
    display: "grid",
    gridTemplateColumns: "[artists] 1fr [albums] 1fr [items] 1fr",
    gridTemplateRows: "[selection] auto",
    height: "100%",
    width: "100%",
    overflow: "hidden",
    padding: theme.spacing(1),
    rowGap: theme.spacing(1),
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

    ":has(> *:nth-last-child(4))": {
        // four children (content)
        gridTemplateRows: "[selection] 1fr [content] 2.5fr",
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

    borderLeft: `1px solid ${theme.palette.divider}`,
    ":first-child": {
        borderLeft: "none",
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
    background: theme.palette.background.paper,
    padding: theme.spacing(1),
}));

/** A generic list component with a label and a list of items.
 *
 * Also allow to search for items.
 */
export function LibraryList({
    data,
    selected,
    label,
}: {
    data: (ListItemData & { label: string })[];
    selected?: ListItemData & { label: string };
    label: string;
}) {
    const [filter, setFilter] = useState<string | null>(null);

    const filteredData = useMemo(() => {
        if (!filter) {
            return data;
        }
        return data.filter((item) => {
            //filtered or selected
            return (
                item.label?.toLowerCase().includes(filter.toLowerCase()) ||
                item === selected
            );
        });
    }, [data, filter]);

    return (
        <Box
            sx={(theme) => ({
                display: "flex",
                flexDirection: "column",
                gap: theme.spacing(1),
                maxWidth: theme.breakpoints.values.laptop,
                width: "100%",
                height: "100%",
                background: theme.palette.background.paper,
                paddingInline: theme.spacing(1.5),
                paddingBlock: theme.spacing(0.5),
            })}
            data-has-selection={selected ? "true" : "false"}
        >
            <Box
                sx={(theme) => ({
                    display: "flex",
                    gap: theme.spacing(1),
                    alignItems: "center",
                    justifyContent: "space-between",
                })}
            >
                <Box className={styles.label}>{label}</Box>
                {filter && filter.length > 0 && (
                    <Typography
                        sx={{
                            display: "flex",
                            alignSelf: "flex-end",
                            marginLeft: "auto",
                            fontSize: "0.8rem",
                        }}
                        variant="body2"
                        color="text.secondary"
                    >
                        Excluded {data.length - filteredData.length}{" "}
                        {label.toLowerCase()}
                    </Typography>
                )}
                <Search
                    value={filter}
                    setValue={setFilter}
                    size="small"
                    variant="outlined"
                />
            </Box>
            <Box className={styles.list}>
                <List data={filteredData}>{List.Item}</List>
            </Box>
        </Box>
    );
}
