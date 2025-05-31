import { useInfiniteQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { albumsInfiniteQueryOptions } from "@/api/library";
import { JSONPretty } from "@/components/common/debugging/json";
import { useDebounce } from "@/components/common/hooks/useDebounce";
import {
    getStorageValue,
    useLocalStorage,
} from "@/components/common/hooks/useLocalStorage";

const STORAGE_KEY = "library.browse.albums.search";
const DEFAULT_STORAGE_VALUE = {
    query: "",
    orderBy: "album" as const,
    orderDirection: "ASC" as const,
};

export const Route = createFileRoute("/library/(browse)/albums")({
    component: RouteComponent,
    loader: async ({ context }) => {
        const val = getStorageValue(STORAGE_KEY, DEFAULT_STORAGE_VALUE);

        await context.queryClient.ensureInfiniteQueryData(
            albumsInfiniteQueryOptions(val)
        );
    },
});

function RouteComponent() {
    const [state, setState] = useLocalStorage<{
        query: string;
        orderBy: "album" | "albumartist" | "year";
        orderDirection: "ASC" | "DESC";
    }>(STORAGE_KEY, DEFAULT_STORAGE_VALUE);

    const debounceSearch = useDebounce(state.query, 500);

    const { data, fetchNextPage } = useInfiniteQuery(
        albumsInfiniteQueryOptions({
            query: debounceSearch,
            orderBy: state.orderBy,
            orderDirection: state.orderDirection,
        })
    );

    return <JSONPretty data={data} />;
}
