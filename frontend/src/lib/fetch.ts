// thin wrapper around fetch so that we can use the vite dev server with our backend

const originalFetch = window.fetch;

window.fetch = async (
    input: RequestInfo | URL,
    init?: RequestInit
): Promise<Response> => {
    const apiPrefix =
        import.meta.env.MODE === "development"
            ? "http://0.0.0.0:5001/api_v1"
            : "/api_v1";

    if (input instanceof URL) {
        input = input.pathname;
    } else if (!(typeof input === "string")) {
        input = input.url;
    }

    console.log("fetching", apiPrefix + input);
    return originalFetch(apiPrefix + input, init);
};
