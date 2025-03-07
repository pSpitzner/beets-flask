import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/candidates/$folderHash")({
    component: RouteComponent,
    loader: async ({ context, params }) => {
        //TODO: Get data from backend (needs new backend route)
        // await context.queryClient.ensureQueryData(todo);
    },
});

function RouteComponent() {
    const { folderHash } = Route.useParams();

    // should show all candidates by folder hash

    return <div>Hello "/candidates/{folderHash}!</div>;
}
