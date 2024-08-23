import { createFileRoute } from "@tanstack/react-router";

import { ImportContextProvider } from "@/components/import/context";
import { ImportView } from "@/components/import/selection";

export const Route = createFileRoute("/playground")({
    component: () => (
        <div>
            <ImportContextProvider>
                <ImportPage />
            </ImportContextProvider>
        </div>
    ),
});

function ImportPage() {
    return <ImportView />;
}
