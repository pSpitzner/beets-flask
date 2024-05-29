import { queryOptions } from "@tanstack/react-query";

// these guys can be infinetely nested and represent a file path on disk.
export interface FsPath {
    full_path: string;
    is_album: boolean;
    type: "directory" | "file";
    children: Record<string, FsPath>;
}

export async function fetchInbox(): Promise<FsPath> {
    const response = await fetch(`/inbox`);
    if (!response.ok) {
        throw new Error("Network response was not ok");
    }
    try {
        return (await response.json()) as FsPath;
    } catch (e) {
        throw new Error("Failed to parse response as JSON in fetchInbox()");
    }
}

export const inboxQueryOptions = () =>
    queryOptions({
        queryKey: ["inbox"],
        queryFn: () => fetchInbox(),
    });

export async function fetchFsPath(folderPath: string): Promise<FsPath> {
    const response = await fetch(`/inbox/path/${folderPath}`);
    if (!response.ok) {
        throw new Error("Network response was not ok");
    }
    try {
        return (await response.json()) as FsPath;
    } catch (e) {
        throw new Error("Failed to parse response as JSON in fetchFsPath()");
    }
}

export const fsPathQueryOptions = (path: string) =>
    queryOptions({
        queryKey: ["inbox", "path", path],
        queryFn: () => fetchFsPath(path),
    });
