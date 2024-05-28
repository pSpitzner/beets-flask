// these guys can be infinetely nested and represent a file path on disk.
export interface FsPath {
    full_path: string;
    is_album: boolean;
    type: "directory" | "file";
    children: Record<string, FsPath>;
}

const apiPrefix = import.meta.env.MODE === "development" ? "http://0.0.0.0:5001" : "";

export async function fetchInbox(): Promise<FsPath> {
    console.log(`fetchInbox from ${apiPrefix}`);
    const response = await fetch(`${apiPrefix}/api_v1/inbox`);
    if (!response.ok) {
        throw new Error("Network response was not ok");
    }
    try {
        return (await response.json()) as FsPath;
    } catch (e) {
        throw new Error("Failed to parse response as JSON in fetchInbox()");
    }
}
export async function fetchFsPath(folderPath:string): Promise<FsPath> {
    const response = await fetch(`${apiPrefix}/api_v1/inbox/[ath/${folderPath}`);
    if (!response.ok) {
        throw new Error("Network response was not ok");
    }
    try {
        return (await response.json()) as FsPath;
    } catch (e) {
        throw new Error("Failed to parse response as JSON in fetchFsPath()");
    }
}
