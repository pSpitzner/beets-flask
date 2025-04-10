import { Box, Button } from "@mui/material";
import { createFileRoute } from "@tanstack/react-router";

import { Loading, LoadingSmall } from "@/components/common/loading";

export const Route = createFileRoute("/_debug/design/loading")({
    component: RouteComponent,
});

function RouteComponent() {
    return (
        <div>
            Full loading:
            <Box
                sx={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "1rem",
                    justifyContent: "center",
                    alignItems: "center",
                    padding: "5rem",
                }}
            >
                <Loading noteColor="red" shadowColor="green" />
            </Box>
            Small loading btns:
            <Box
                sx={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "1rem",
                    justifyContent: "center",
                    alignItems: "center",
                }}
            >
                <Button variant="contained" disabled>
                    <LoadingSmall />
                </Button>
                <Button variant="outlined" disabled>
                    <LoadingSmall noteColor="green" shadowColor="red" />
                </Button>
                <Button variant="text" disabled>
                    <LoadingSmall />
                </Button>
            </Box>
        </div>
    );
}
