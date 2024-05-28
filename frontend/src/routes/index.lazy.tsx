import { createLazyFileRoute } from "@tanstack/react-router";
import { InboxOverview } from "../components/inbox";

export const Route = createLazyFileRoute("/")({
    component: Index,
});

/** The index is basically a overview
 * of the current inbox and database.
 *
 * It also gives links to other relevant
 * pages.
 */
function Index() {
    return (
        <div>
            <h1>Index</h1>
            <div className="flex flex-col space-y-4 flex-shrink-1 justify-center items-center">
                <div className="flex flex-row space-x-4">
                    <InboxOverview />
                </div>
            </div>
        </div>
    );
}
