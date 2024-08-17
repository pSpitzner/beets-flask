import Button from "@mui/material/Button";
import { createFileRoute } from "@tanstack/react-router";

import { ImportContextProvider, useImportContext } from "@/components/import/context";
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
    const { generateDummySelections } = useImportContext();
    return (
        <>
            <div>
                <Button onClick={generateDummySelections}>
                    Generate dummy selections
                </Button>
            </div>
            <ImportView />
        </>
    );
}
