import { queryOptions } from "@tanstack/react-query";

// these guys can be infinetely nested and represent a file path on disk.
export interface FsPath {
    full_path: string;
    is_album: boolean;
    type: "directory" | "file";
    children: Record<string, FsPath>;
}

export async function fetchInboxes(): Promise<FsPath[]> {
    const response = await fetch(`/inbox`);
    return (await response.json()) as [FsPath];
}

export const inboxQueryOptions = () =>
    queryOptions({
        queryKey: ["inbox"],
        queryFn: () => fetchInboxes(),
    });

export async function fetchFsPath(folderPath: string): Promise<FsPath> {
    if (folderPath.startsWith("/")) folderPath = folderPath.slice(1);
    const response = await fetch(`/inbox/path/${folderPath}`);
    return (await response.json()) as FsPath;
}

export const fsPathQueryOptions = (path: string) =>
    queryOptions({
        queryKey: ["inbox", "path", path],
        queryFn: () => fetchFsPath(path),
    });
