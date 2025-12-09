interface DBFolder {
    full_path: string;
    is_album: boolean | null;
    id: string;
    created_at: Date;
    updated_at: Date;
}

export const folderByTaskId = (taskId: string) => ({
    queryKey: ['dbfolder', taskId],
    queryFn: async () => {
        const response = await fetch(`/dbfolder/by_task/${taskId}`);
        const res = (await response.json()) as DBFolder;
        res.created_at = new Date(res.created_at);
        res.updated_at = new Date(res.updated_at);
        return res;
    },
});
