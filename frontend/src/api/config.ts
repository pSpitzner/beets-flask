import { useMemo } from "react";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";

import { useLocalStorage } from "@/components/common/hooks/useLocalStorage";

export interface MinimalConfig {
    gui: {
        inbox: {
            concat_nested_folders: boolean;
            expand_files: boolean;
            folders: Record<
                string,
                {
                    autotag: false | "preview" | "auto" | "bootleg";
                    auto_threshold?: number;
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

export const configQueryOptions = () =>
    queryOptions({
        queryKey: ["config"],
        queryFn: async () => {
            const response = await fetch(`/config`);
            return (await response.json()) as MinimalConfig;
        },
    });

export const useConfig = () => {
    const { data } = useSuspenseQuery(configQueryOptions());
    return data;
};

// This is kinda intertwined with the fileTree
export interface InboxFolderGridConfig {
    gridTemplateColumns: Array<{
        name: "selector" | "tree" | "chip" | "actions";
        size: "1fr" | "auto";
        hidden?: boolean;
    }>;
    primaryActions: string[];
    secondaryActions: string[];
}

export const DEFAULT_INBOX_FOLDER_GRID_CONFIG: InboxFolderGridConfig = {
    gridTemplateColumns: [
        { name: "selector", size: "auto" },
        { name: "tree", size: "1fr" },
        { name: "chip", size: "auto" },
        { name: "actions", size: "auto" },
    ],
    primaryActions: ["import", "delete"],
    secondaryActions: ["retag"],
};

export const useInboxFolderGridConfig = (fullpath: string) => {
    const [config, setConfig] = useLocalStorage<InboxFolderGridConfig>(
        "inbox_folder_grid_config_" + fullpath,
        DEFAULT_INBOX_FOLDER_GRID_CONFIG
    );

    const setGridTemplateColumns = (
        columns: Array<{
            name: "selector" | "tree" | "chip" | "actions";
            size: "1fr" | "auto";
            hidden?: boolean;
        }>
    ) => {
        setConfig({
            ...config,
            gridTemplateColumns: columns,
        });
    };

    return {
        config,
        setConfig,
        setGridTemplateColumns,
    };
};

/** Inbox folder config
 *
 * This hook retrieves the configuration for a specific inbox folder,
 * if the folder is not found in the configuration,
 * an error is thrown!
 *
 * Also add the config of the grid to the returned object.
 */
export const useInboxFolderConfig = (full_path: string) => {
    const config = useConfig();

    return useMemo(() => {
        const fc = Object.entries(config.gui.inbox.folders).find(
            ([_k, v]) => v.path === full_path
        );
        if (!fc) {
            throw new Error(`No configuration found for inbox folder: ${full_path}`);
        }

        return {
            ...fc[1],
            auto_threshold: fc[1].auto_threshold ?? config.match.strong_rec_thresh,
        };
    }, [config, full_path]);
};
