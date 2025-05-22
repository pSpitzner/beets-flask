import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/library/(browse)/albums")({
    component: RouteComponent,
});

function RouteComponent() {
    return (
        <div>
            Show list of all albums.
            <div>TODOS</div>
            <ul>
                <li>Infinite scroll loader</li>
                <li>Backend pagination</li>
            </ul>
        </div>
    );
}
