import { ImportContextProvider, useImportContext } from "@/components/import/context";
import { Importer, ImportView } from "@/components/import/selection";
import Button from "@mui/material/Button";
import { createFileRoute } from "@tanstack/react-router";

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
