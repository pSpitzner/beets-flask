import { queryOptions } from "@tanstack/react-query";

import { fetchInbox } from "./inbox";

export const inboxQueryOptions = () =>
    queryOptions({
        queryKey: ["inbox"],
        queryFn: () => fetchInbox(),
    });
