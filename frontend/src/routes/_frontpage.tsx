import { Outlet, createFileRoute } from "@tanstack/react-router";
import { InboxOverview } from "../components/inbox";

export const Route = createFileRoute("/_frontpage")({
    component: Index,
});

/** The frontpage is layout which adds an overview
 * of the current inbox and database.
 *
 * It also gives an outlet to render other relevant content
 * underneath. This may also be used to render a modal.
 */
function Index() {
    return (
        <div>
            <Outlet />
            <div className="flex flex-row space-x-4">
                <InboxOverview />
            </div>
        </div>
    );
}
