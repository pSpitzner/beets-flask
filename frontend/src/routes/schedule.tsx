import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/schedule")({
    component: () => <Schedule />,
});

/** Schedule a scan */
export function Schedule() {
    return (
        <div>
            <h1>Schedule a scan</h1>
            <p>TODO: Implement this page</p>
        </div>
    );
}
