import { artistsQueryOptions } from "@/lib/library";
import { Outlet, createFileRoute } from "@tanstack/react-router";

import List from "@/components/common/list";
import Box from "@mui/material/Box";

export const Route = createFileRoute("/library/browse")({
    loader: (opts) => opts.context.queryClient.ensureQueryData(artistsQueryOptions()),
    component: () => <AllArtists />,
});

function AllArtists() {
    const artists = Route.useLoaderData();

    return (
        <>
            <Box
                height="80vh"
                width="33%"
                my={2}
                display="flex"
                alignItems="start"
                gap={4}
                p={2}
                sx={{
                    border: "1px solid grey",
                    borderRadius: "0.3rem",
                }}
            >
                <List.Wrapper>
                    {artists.map((artist, i) => {
                        return (
                            <List.Item key={i} to={artist.name} label={artist.name} />
                        );
                    })}
                </List.Wrapper>
            </Box>
            <Box>
                <Outlet />
            </Box>
        </>
    );
}
