import { createLazyFileRoute } from "@tanstack/react-router";
import Button from "@mui/material/Button";

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
            <div className="flex flex-col space-y-4">Test</div>
            <Button variant="outlined">Test</Button>
        </div>
    );
}
