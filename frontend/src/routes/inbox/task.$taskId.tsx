import { createFileRoute, redirect } from '@tanstack/react-router';

import { folderByTaskId } from '@/api/dbfolder';
import { LoadingWithFeedback } from '@/components/common/loading';
import { PageWrapper } from '@/components/common/page';

export const Route = createFileRoute('/inbox/task/$taskId')({
    loader: async ({ context: { queryClient }, params }) => {
        // Redirect to the hash route
        const data = await queryClient.ensureQueryData(
            folderByTaskId(params.taskId)
        );

        redirect({
            to: `/inbox/folder/$path/$hash`,
            params: {
                hash: data.id,
                path: data.full_path,
            },
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
