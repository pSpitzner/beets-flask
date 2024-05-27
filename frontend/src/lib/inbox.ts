export interface Inbox {
    __full_path: string;
    __is_album: boolean;
    __type: "directory" | "file";
}

export async function fetchInbox(): Promise<Inbox[]> {
    const response = await fetch("/api_v1/inbox");
    if (!response.ok) {
        throw new Error("Network response was not ok");
    }
    return (await response.json()) as Inbox[];
}
