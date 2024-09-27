import { createFileRoute } from "@tanstack/react-router";

import { Terminal, TerminalContextProvider } from "@/components/frontpage/terminal";

export const Route = createFileRoute("/terminal/")({
    component: TerminalPage,
});

function TerminalPage() {
    return (
        <TerminalContextProvider>
            <Terminal style={{ height: "100%" }} />
        </TerminalContextProvider>
    );
}
