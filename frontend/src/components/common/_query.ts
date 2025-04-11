import { QueryClient } from "@tanstack/react-query";

// we re-export all query options here, to have easy imports elsewhere
export * from "@/components/inbox/_query";
export * from "@/components/library/_query";
export * from "@/components/tags_old/_query";

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
            const data = (await response.json()) as ErrorData;
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

export interface ErrorData {
    error: string;
    message: string;
    description?: string;
    trace?: string;
}

export class APIError extends Error {
    trace?: string;

    constructor(public data: ErrorData) {
        super(data.message ?? data.description);
        this.name = data.error;
        this.trace = data.trace ?? undefined;
    }
}
