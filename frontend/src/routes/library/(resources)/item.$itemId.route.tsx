import { Box } from '@mui/material';
import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, Outlet } from '@tanstack/react-router';

import { queryClient } from '@/api/common';
import { itemQueryOptions } from '@/api/library';
import { BackIconButton } from '@/components/common/inputs/back';
import { NavigationTabs } from '@/components/common/navigation';
import { PageWrapper } from '@/components/common/page';
import { ItemHeader } from '@/components/library/item';

export const Route = createFileRoute('/library/(resources)/item/$itemId')({
    parseParams: (params) => {
        const itemId = parseInt(params.itemId);
        if (isNaN(itemId)) {
            throw new Error(`Invalid itemId: ${params.itemId}`);
        }
        return { itemId };
    },
    component: RouteComponent,
    loader: async (opts) => {
        await queryClient.ensureQueryData(
            itemQueryOptions(opts.params.itemId, false)
        );
    },
});

function RouteComponent() {
    const params = Route.useParams();
    const { data: item } = useSuspenseQuery(
        itemQueryOptions(params.itemId, false)
    );

    return (
        <PageWrapper
            sx={(theme) => ({
                display: 'flex',
                flexDirection: 'column',
                minHeight: '100%',
                height: '100%',
                position: 'relative',
                overflow: 'hidden',
                [theme.breakpoints.up('laptop')]: {
                    padding: 2,
                },
            })}
        >
            <BackIconButton
                sx={{
                    // TODO: styling for mobile
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    zIndex: 2,
                    margin: 0.5,
                }}
                size="small"
                color="primary"
            />
            <Box
                sx={(theme) => ({
                    display: 'flex',
                    flexDirection: 'column',
                    height: '100%',
                    flex: '1 1 auto',
                    overflow: 'hidden',
                    [theme.breakpoints.up('laptop')]: {
                        backgroundColor: 'background.paper',
                        borderRadius: 2,
                    },
                })}
            >
                <Box>
                    <ItemHeader
                        item={item}
                        sx={(theme) => ({
                            // Background gradient from bottom to top
                            background: `linear-gradient(to bottom, transparent 0%, ${theme.palette.background.paper} 100%)`,
                            position: 'relative',
                            zIndex: 1,
                        })}
                    />
                    <NavigationTabs
                        items={[
                            {
                                to: '/library/item/$itemId',
                                label: 'Overview',
                                params,
                            },
                            {
                                to: '/library/item/$itemId/identifier',
                                label: 'Identifiers',
                                params,
                            },
                            {
                                to: '/library/item/$itemId/beetsdata',
                                label: 'Details',
                                params,
                            },
                        ]}
                    />
                </Box>
                <Box
                    sx={(theme) => ({
                        flex: '1 1 auto',
                        paddingInline: 2,
                        paddingBlock: 1,
                        height: '100%',
                        minHeight: 0,
                        //background: theme.palette.background.paper,
                        background: `linear-gradient(to bottom, ${theme.palette.background.paper} 0%, transparent 100%)`,
                    })}
                >
                    <Outlet />
                </Box>
            </Box>
        </PageWrapper>
    );
}
