import { FileSystemUpdate, FolderStatusUpdate, JobStatusUpdate } from "@/pythonTypes";

import type { Socket } from "socket.io-client";

interface Status_ServerToClientEvents {
    // This types our socket events, i.e. we can only use
    // the events defined here should help with type safety :)
    folder_status_update: (data: FolderStatusUpdate) => void;
    job_status_update: (data: JobStatusUpdate) => void;
    file_system_update: (data: FileSystemUpdate) => void;
}

interface Status_ClientToServerEvents {
    // none for now
    [key: string]: unknown;
}

export type StatusSocket = Socket<
    Status_ServerToClientEvents,
    Status_ClientToServerEvents
>;

interface Terminal_ServerToClientEvents {
    ptyOutput: (data: {
        output: string[];
        x: number;
        y: number;
        history: string[];
    }) => void;
    ptyCursorPosition: (data: { x: number; y: number }) => void;
}

interface Terminal_ClientToServerEvents {
    ptyInput: (data: { input: string }) => void;
    ptyResize: (data: { cols: number; rows: number }) => void;
    ptyResendOutput: () => void;
}

export type SocketEvents = {
    terminal: {
        ServerToClientEvents: Terminal_ServerToClientEvents;
        ClientToServerEvents: Terminal_ClientToServerEvents;
    };
    status: {
        ServerToClientEvents: Status_ServerToClientEvents;
        ClientToServerEvents: Status_ClientToServerEvents;
    };
};

export type TerminalSocket = Socket<
    Terminal_ServerToClientEvents,
    Terminal_ClientToServerEvents
>;
