import { createLazyFileRoute } from "@tanstack/react-router";
import { InboxStatsOverview } from "../components/inboxStats";

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
            <div className="flex flex-row space-x-4">
                <InboxStatsOverview />
            </div>
        </div>
    );
}
