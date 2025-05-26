import { User2Icon } from "lucide-react";
import { useMemo, useState } from "react";
import { Box, BoxProps, Typography } from "@mui/material";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { artistsQueryOptions } from "@/api/library";
import List from "@/components/library/list";

export const Route = createFileRoute("/library/(browse)/artists/")({
    loader: async (opts) => {
        await opts.context.queryClient.ensureQueryData(artistsQueryOptions());
    },
    component: RouteComponent,
});

function RouteComponent() {
    const { data: artists } = useSuspenseQuery(artistsQueryOptions());
    return (
        <>
            <ArtistsHeader />
            <ArtistsList />
        </>
    );
}

function ArtistsHeader({ sx, ...props }: BoxProps) {
    return (
        <Box
            sx={[
                {
                    display: "flex",
                    gap: 2,
                    alignItems: "center",
                    padding: 2,
                },
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                ...(Array.isArray(sx) ? sx : [sx]),
            ]}
            {...props}
        >
            <Box sx={{ display: "flex", alignItems: "center", height: "100%" }}>
                <User2Icon size={40} color={"gray"} />
            </Box>
            <Typography variant="h5" fontWeight="bold" lineHeight={1.2}>
                Artists
            </Typography>
        </Box>
    );
}

function ArtistsList() {
    const { data } = useSuspenseQuery(artistsQueryOptions());
    const [filter, setFilter] = useState<string>("");

    const filteredData = useMemo(() => {
        if (!filter) {
            return data;
        }
        return data.filter((item) => {
            //filtered or selected
            return item.name?.toLowerCase().includes(filter.toLowerCase());
        });
    }, [data, filter]);

    return (
        <Box sx={{ padding: 2, overflow: "auto", height: "100%" }}>
            <List
                data={filteredData.map((d) => ({
                    label: d.name,
                }))}
            >
                {List.Item}
            </List>
        </Box>
    );
}
