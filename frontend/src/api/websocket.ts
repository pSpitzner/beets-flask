import { FolderStatusUpdate, JobStatusUpdate } from "@/pythonTypes";

import type { Socket } from "socket.io-client";

interface Status_ServerToClientEvents {
    // This types our socket events, i.e. we can only use
    // the events defined here should help with type safety :)
    folder_status_update: (data: FolderStatusUpdate) => void;
    job_status_update: (data: JobStatusUpdate) => void;
    error: (error: unknown) => void;
}

interface Status_ClientToServerEvents {
    // none for now
    [key: string]: unknown;
}

export type StatusSocket = Socket<
    Status_ServerToClientEvents,
    Status_ClientToServerEvents
>;
