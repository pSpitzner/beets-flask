import { useEffect } from "react";
import {
    QueryClient,
    QueryClientProvider,
    queryOptions,
    useSuspenseQuery,
} from "@tanstack/react-query";
import { ReactNode } from "@tanstack/react-router";

export interface MinimalConfig {
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
            order_by: string;
            show_unchanged_tracks: boolean;
        };
    };
    import: {
        duplicate_action: string;
    };
    match: {
        medium_rec_thresh: number;
        strong_rec_thresh: number;
        album_disambig_fields: string[];
        singleton_disambig_fields: string[];
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
        client.prefetchQuery(configQueryOptions()).catch(console.error);
    }, [client]);

    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
