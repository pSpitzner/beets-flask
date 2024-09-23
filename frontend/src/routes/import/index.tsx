import Box from "@mui/material/Box";
import { createFileRoute } from "@tanstack/react-router";

import { AvailableSelections } from "@/components/import/candidateSelection";
import { ImportContextProvider } from "@/components/import/context";
import {
    ApplySelection,
    ImportTargetSelector,
} from "@/components/import/targetSelector";

export const Route = createFileRoute("/import/")({
    component: ImportPage,
});

function ImportPage() {
    return (
        <ImportContextProvider>
            <Box sx={{ gap: "1rem", display: "flex", flexDirection: "column" }}>
                <ImportTargetSelector />
                <AvailableSelections />
                <ApplySelection />
            </Box>
        </ImportContextProvider>
    );
}
