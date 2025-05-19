import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/library/(resources)/album/$albumId/beetsdata")({
    component: RouteComponent,
});

function RouteComponent() {
    return <div>Hello "/library/(resources)/album/$albumId/beetsdata"!</div>;
}
