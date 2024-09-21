import Box from "@mui/material/Box";
import { createFileRoute } from "@tanstack/react-router";

import { ImportContextProvider } from "@/components/import/context";
import { AvailableSelections } from "@/components/import/selection";
import { ApplySelection, ImportTargetSelector } from "@/components/import/selector";

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
