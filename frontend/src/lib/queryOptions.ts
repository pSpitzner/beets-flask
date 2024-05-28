import { queryOptions } from "@tanstack/react-query";

import { fetchInbox, fetchFsPath } from "./inbox";

export const inboxQueryOptions = () =>
    queryOptions({
        queryKey: ["inbox"],
        queryFn: () => fetchInbox(),
    });

// PS 24-05-28: what do we gain from encapsulating this another time via Options?
// Fair enough, we have the query key for hashing.
// but why do we separate options and fetch into two files :P ?
// SBM 24-05-28: For now it does not matter too much, but
// think about a fetch with options and pagination, etc.
// this blows up the fetch functions alot
// additionally I like to keep all the options in one place
// to have an overview of all the queries in the app
export const fsPathQueryOptions = (path: string) =>
    queryOptions({
        queryKey: ["inbox", "path", path],
        queryFn: () => fetchFsPath(path),
    });
