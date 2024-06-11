// SSE stream is used to push updates of tag statuses from the server

import { createContext, useContext, useEffect } from "react";
import { SseInvalidationI, SseSource } from "@/lib/fetch";

import { QueryClient } from "@tanstack/react-query";
import { TagI } from "@/lib/tag";

const sseContext = createContext<null>(null);

export const useSSEStream = () => {
    const c = useContext(sseContext);
    if (!sseContext) {
        throw new Error("useSSEStream must be used within a SSEStreamProvider");
    }
    return c;
};

export function SSEStreamProvider({
    children,
    client: queryClient,
}: {
    children: React.ReactNode;
    client: QueryClient;
}) {
    useEffect(() => {
        const s = new SseSource();
        console.log("SSEStreamProvider mounted", s);

        /** At the moment the only reason
         * we use the sse stream is for tag invalidation
         * so we only listen for tag events
         */
        function handleEvent(event: MessageEvent<string>) {
            const data = JSON.parse(event.data) as SseInvalidationI;

            console.debug(`SSE event for ${data.tagPath}`, data);

            if (data.attributes === "all") {
                if (data.tagId)
                    queryClient.invalidateQueries({ queryKey: ["tag", data.tagId] });
                if (data.tagPath)
                    queryClient.invalidateQueries({ queryKey: ["tag", data.tagPath] });
            } else {
                const attrs = data.attributes;
                if (data.tagId)
                    queryClient.setQueryData(["tag", data.tagId], (old: TagI) => {
                        return { ...old, ...attrs };
                    });
                if (data.tagPath)
                    queryClient.setQueryData(["tag", data.tagPath], (old: TagI) => {
                        return { ...old, ...attrs };
                    });
            }
        }
        s.addEventListener("tag", handleEvent);

        /** In theory we can add more events
         * here
         */
        return () => {
            s.removeEventListener("tag", handleEvent);
        };
    }, [queryClient]);

    /** We could also return some state if
     * we wanted to expose some sse stream
     * data here
     */
    return <sseContext.Provider value={null}>{children}</sseContext.Provider>;
}
