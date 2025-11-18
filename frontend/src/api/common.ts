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
            const data: SerializedException | string = await response
                .json()
                .then((json) => json as SerializedException)
                .catch(async () => {
                    return await response
                        .text()
                        .catch(
                            () =>
                                `Failed to parse response: ${response.status} ${response.statusText}`
                        );
                });
            const statusCode = response.status;
            if (typeof data === "string") {
                throw new HTTPError(data, statusCode);
            } else {
                throw new APIError(data, statusCode);
            }
        }

        if (response.headers.get("Content-Type") == "application/json") {
            try {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                const data = await response.json();
                // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/require-await
                response.json = async () => data;
            } catch (e) {
                console.error("Failed to parse response as JSON in fetch()", e);
                throw new HTTPError(
                    "Failed to parse response as JSON",
                    response.status
                );
            }
        }

        return response;
    };
}

export class BeetsFlaskError extends Error {}

export class HTTPError extends BeetsFlaskError {
    // Contained in base:
    // name: string;
    // message: string;
    // stack?: string | undefined;

    statusCode?: number;

    constructor(message: string, statusCode?: number) {
        super(message);
        this.name = "HTTPError";
        this.statusCode = statusCode;
    }
}

export class APIError extends HTTPError {
    description?: string;
    // Trace from the backend, if available
    trace?: string;

    constructor(data: SerializedException, statusCode?: number) {
        super(data.message, statusCode);
        this.name = data.type;
        this.message = data.message;
        this.description = data.description ?? undefined;
        this.trace = data.trace ?? undefined;
    }
}

/* ------------ Override DefaultError type ------------ */
declare module "@tanstack/react-query" {
    interface Register {
        defaultError: BeetsFlaskError;
    }
}
