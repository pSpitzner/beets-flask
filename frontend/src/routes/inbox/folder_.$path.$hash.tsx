import { Box } from "@mui/material";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { inboxFolderQueryOptions } from "@/api/inbox";
import { sessionQueryOptions } from "@/api/session";
import { LoadingWithFeedback } from "@/components/common/loading";
import { PageWrapper } from "@/components/common/page";
import { FolderCard } from "@/components/inbox/cards/folderCard";
import { ImportedCard } from "@/components/inbox/cards/importedCard";
import { TagCard } from "@/components/inbox/cards/tagCard";
import { GenericErrorCard } from "@/errors";

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
    errorComponent: ({ error }) => (
        <PageWrapper
            sx={{
                height: "100%",
            }}
        >
            <Box
                sx={{
                    display: "flex",
                    marginTop: "5rem",
                    height: "100%",
                    justifyContent: "center",
                    alignItems: "center",
                }}
            >
                <GenericErrorCard
                    title="Unexpected Error"
                    subtitle="Oh no! Seems like we dropped a beat!"
                    exc={{
                        type: error.name,
                        message: error.message,
                        description: error.message,
                        trace: error.stack,
                    }}
                    showSocials={true}
                    color="secondary"
                />
            </Box>
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
