import {
    QueryClient,
    QueryClientProvider,
    queryOptions,
    useSuspenseQuery,
} from "@tanstack/react-query";
import { ReactNode } from "@tanstack/react-router";
import { useEffect } from "react";

interface MinimalConfig {
    gui: {
        inbox: {
            concat_nested_folders: boolean;
            expand_files: boolean;
            folders: Record<
                string,
                {
                    autotag: boolean;
                    last_tagged: string | null;
                    name: string;
                    path: string;
                }
            >;
        };
        library: {
            include_paths: boolean;
            readonly: boolean;
        };
        num_workers_preview: number;
        tags: {
            recent_days: number;
            expand_tags: boolean;
        };
    };
    match: {
        medium_rec_thresh: number;
        strong_rec_thresh: number;
    };
}

const configQueryOptions = () =>
    queryOptions({
        queryKey: ["config"],
        queryFn: async function fetchInboxes() {
            const response = await fetch(`/config`);
            return (await response.json()) as MinimalConfig;
        },
    });

export const useConfig = () => {
    const { data } = useSuspenseQuery(configQueryOptions());
    return data;
};

export function PrefetchConfigQueryClientProvider({
    client,
    children,
}: {
    client: QueryClient;
    children: ReactNode;
}) {
    useEffect(() => {
        client.prefetchQuery(configQueryOptions());
    }, []);

    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}