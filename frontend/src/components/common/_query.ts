import { QueryClient } from "@tanstack/react-query";

// we re-export all query options here, to have easy imports elsewhere
export * from "@/components/inbox/_query";
export * from "@/components/library/_query";
export * from "@/components/tags/_query";

// Global query client instance
export const queryClient = new QueryClient({});

// thin wrapper around fetch so that we can use the vite dev server with our backend
export function customizeFetch() {
    const originalFetch = window.fetch;
    const devMode = import.meta.env.MODE === "development";
    const apiPrefix = devMode ? "http://0.0.0.0:5001/api_v1" : "/api_v1";

    window.fetch = async (
        input: RequestInfo | URL,
        init?: RequestInit
    ): Promise<Response> => {
        if (input instanceof URL) {
            input = input.pathname;
        } else if (!(typeof input === "string")) {
            input = input.url;
        }

        // console.log("fetching", apiPrefix + input);
        const response = await originalFetch(apiPrefix + input, init);
        if (!response.ok) {
            const data = (await response.json()) as ErrorData;
            throw new APIError(data);
        }

        if (devMode && response.headers.get("Content-Type") == "application/json") {
            try {
                await response.clone().json();
            } catch (e) {
                throw new Error("Failed to parse response as JSON in fetch()");
            }
        }

        return response;
    };
}

interface ErrorData {
    error: string; //name
    messages: string;
    trace?: string;
}

export class APIError extends Error {
    trace?: string;

    constructor(public data: ErrorData) {
        super(data.messages);
        this.name = data.error;
        this.trace = data.trace ?? undefined;
    }
}
