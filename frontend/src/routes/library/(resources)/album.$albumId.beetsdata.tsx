import { useMemo } from 'react';
import { Box } from '@mui/material';
import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';

import { albumQueryOptions } from '@/api/library';
import {
    PropertyValueTable,
    Serializable,
} from '@/components/common/propertyValueTable';

export const Route = createFileRoute(
    '/library/(resources)/album/$albumId/beetsdata'
)({
    component: RouteComponent,
});

function RouteComponent() {
    const params = Route.useParams();
    const { data: album } = useSuspenseQuery(
        albumQueryOptions(params.albumId, true, false)
    );

    // Create a flat list of all the properties without sources
    const albumNoSource = useMemo(() => {
        const n = structuredClone(album) as unknown as Record<
            string,
            Serializable
        >;
        delete n.sources;
        delete n.items;
        return n;
    }, [album]);

    return (
        <Box
            sx={{
                overflow: 'auto',
                height: '100%',
            }}
        >
            <PropertyValueTable
                data={albumNoSource}
                sx={{
                    overflow: 'hidden',
                    thead: {
                        th: {
                            backgroundColor: 'background.paper',
                        },
                    },
                }}
            />
        </Box>
    );
}
