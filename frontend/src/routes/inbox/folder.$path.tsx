import { createFileRoute, redirect } from '@tanstack/react-router';

import { inboxFolderQueryOptions } from '@/api/inbox';
import { LoadingWithFeedback } from '@/components/common/loading';
import { PageWrapper } from '@/components/common/page';

export const Route = createFileRoute('/inbox/folder/$path')({
    loader: async ({ context: { queryClient }, params }) => {
        // Redirect to the hash route
        const data = await queryClient.ensureQueryData(
            inboxFolderQueryOptions(params.path)
        );

        redirect({
            to: `/inbox/folder/$path/$hash`,
            params: {
                hash: data.hash,
                path: params.path,
            },
            mask: { to: '/inbox/folder/$path', params: { path: params.path } },
            throw: true,
        });
    },
    pendingComponent: () => (
        <PageWrapper
            sx={{
                display: 'flex',
                alignItems: 'center',
                height: '100%',
                justifyContent: 'center',
                flexDirection: 'column',
            }}
        >
            <LoadingWithFeedback
                feedback="Looking for your session"
                color="secondary"
            />
        </PageWrapper>
    ),
});
