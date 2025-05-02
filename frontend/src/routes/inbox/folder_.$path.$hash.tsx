import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { inboxFolderQueryOptions } from "@/api/inbox";
import { sessionQueryOptions } from "@/api/session";
import { LoadingWithFeedback } from "@/components/common/loading";
import { PageWrapper } from "@/components/common/page";
import { FolderCard } from "@/components/inbox/cards/folderCard";
import { ImportedCard } from "@/components/inbox/cards/importedCard";
import { TagCard } from "@/components/inbox/cards/tagCard";

export const Route = createFileRoute("/inbox/folder_/$path/$hash")({
    component: RouteComponent,
    loader: async ({ context: { queryClient }, params }) => {
        // we prefetch all data here but do not handle errors
        // here, this is done in the component using an error boundary
        const p1 = queryClient.prefetchQuery(
            sessionQueryOptions({
                folderPath: params.path,
                folderHash: params.hash,
            })
        );

        // try to get up do date folder information
        const p2 = queryClient.prefetchQuery(inboxFolderQueryOptions(params.path));
        await Promise.all([p1, p2]);
    },
    pendingComponent: () => (
        <PageWrapper
            sx={{
                display: "flex",
                alignItems: "center",
                height: "100%",
                justifyContent: "center",
                flexDirection: "column",
            }}
        >
            <LoadingWithFeedback
                feedback="Looking for your session"
                color="secondary"
            />
        </PageWrapper>
    ),
});

function RouteComponent() {
    const { path, hash } = Route.useParams();
    const { data: folder } = useSuspenseQuery(inboxFolderQueryOptions(path));

    return (
        <PageWrapper
            sx={{
                display: "flex",
                flexDirection: "column",
                gap: 2,
                paddingBlock: 2,
                paddingInline: 1,
            }}
        >
            <FolderCard folder={folder} />
            <TagCard folderHash={hash} folderPath={path} />
            <ImportedCard folderHash={hash} folderPath={path} />
        </PageWrapper>
    );
}
