import { Box } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';

import { itemQueryOptions } from '@/api/library';
import { PageWrapper } from '@/components/common/page';
import {
    AudioContextProvider,
    useAudioContext,
} from '@/components/library/audio/context';
import { Player } from '@/components/library/audio/player';

export const Route = createFileRoute('/debug/audio')({
    component: RouteComponent,
});

function RouteComponent() {
    return (
        <AudioContextProvider>
            <PageWrapper
                sx={{
                    height: '100%',
                    display: 'flex',
                    justifyContent: 'flex-end',
                    alignItems: 'center',
                    flexDirection: 'column',
                    position: 'relative',
                }}
            >
                <AddButton />
                <Box
                    sx={(theme) => ({
                        bottom: 0,
                        width: '100%',
                        padding: 1,
                        [theme.breakpoints.down('tablet')]: {
                            padding: 0.5,
                        },
                    })}
                >
                    <Player />
                </Box>
            </PageWrapper>
        </AudioContextProvider>
    );
}

function AddButton() {
    const { addToQueue } = useAudioContext();
    const { data: item1 } = useQuery(itemQueryOptions(4101, false));
    const { data: item2 } = useQuery(itemQueryOptions(4166, false));

    return (
        <>
            <button
                onClick={() => {
                    if (!item1) {
                        console.error('Item is undefined');
                        return;
                    }
                    addToQueue(item1);
                }}
            >
                Add {item1?.name}
            </button>
            <button
                onClick={() => {
                    if (!item2) {
                        console.error('Item is undefined');
                        return;
                    }
                    addToQueue(item2);
                }}
            >
                Add {item2?.name}
            </button>
        </>
    );
}
