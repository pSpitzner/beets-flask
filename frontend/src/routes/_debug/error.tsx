import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";

import { PageWrapper } from "@/components/common/page";

export const Route = createFileRoute("/_debug/error")({
    component: RouteComponent,
});

function RouteComponent() {
    const [throwError, setThrowError] = useState(false);

    if (throwError) {
        // This is a test error to check the default error component!
        throw new Error("This is a test error to check the default error component!");
    }

    return (
        <PageWrapper>
            <h1>Debug Error Page</h1>
            <p>
                This page is used to test the error handling of the application. It will
                throw an error when the button is clicked.
            </p>
            <button onClick={() => setThrowError(true)}>Throw Error</button>
        </PageWrapper>
    );
}
