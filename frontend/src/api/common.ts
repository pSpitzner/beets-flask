import { QueryClient } from "@tanstack/react-query";

import { SerializedException } from "@/pythonTypes";

// Global query client instance
export const queryClient = new QueryClient({});

// thin wrapper around fetch so that we can use the vite dev server with our backend
export function customizeFetch() {
    const originalFetch = window.fetch;
    const apiPrefix = "/api_v1";

    window.fetch = async (
        input: RequestInfo | URL,
        init?: RequestInit
    ): Promise<Response> => {
        if (input instanceof URL) {
            input = input.pathname;
        } else if (!(typeof input === "string")) {
            input = input.url;
        }

        // Local requests get a prefix
        if (!input.startsWith("/")) {
            return originalFetch(input, init);
        }

        // console.log("fetching", apiPrefix + input);
        const response = await originalFetch(apiPrefix + input, init);
        if (!response.ok) {
            const data = (await response.json()) as SerializedException;
            throw new APIError(data);
        }

        if (response.headers.get("Content-Type") == "application/json") {
            try {
                await response.clone().json();
            } catch (e) {
                console.error("Failed to parse response as JSON in fetch()", e);
                throw new Error("Failed to parse response as JSON in fetch()");
            }
        }

        return response;
    };
}

export class APIError extends Error {
    description?: string;
    trace?: string;

    constructor(public data: SerializedException) {
        super(data.message ?? data.description);
        this.name = data.type;
        this.message = data.message;
        this.description = data.description ?? undefined;
        this.trace = data.trace ?? undefined;
    }
}
