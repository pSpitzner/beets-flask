import { createFileRoute } from "@tanstack/react-router";

// We just want to show the layout here
export const Route = createFileRoute("/_frontpage/")({
    component: () => <></>,
});
