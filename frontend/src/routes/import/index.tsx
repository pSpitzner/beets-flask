import Box from "@mui/material/Box";
import { createFileRoute } from "@tanstack/react-router";

import { ImportContextProvider } from "@/components/import/context";
import { AvailableSelections } from "@/components/import/selection";
import { ImportTargetSelector } from "@/components/import/selector";

export const Route = createFileRoute("/import/")({
    component: ImportPage,
});

function ImportPage() {
    return (
        <ImportContextProvider>
            <ImportTargetSelector />
            <Box>
                <AvailableSelections />
            </Box>
        </ImportContextProvider>
    );
}
