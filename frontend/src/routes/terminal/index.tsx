import { createFileRoute } from "@tanstack/react-router";

import { PageWrapper } from "@/components/common/page";
import { Terminal } from "@/components/frontpage/terminal";

export const Route = createFileRoute("/terminal/")({
    component: TerminalPage,
});

function TerminalPage() {
    return (
        <PageWrapper sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
            <Terminal style={{ height: "100%" }} />
        </PageWrapper>
    );
}
