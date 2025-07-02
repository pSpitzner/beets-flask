import { useMutation, UseMutationOptions } from "@tanstack/react-query";

import { APIError } from "@/api/common";
import { Action } from "@/api/config";
import { deleteFoldersMutationOptions } from "@/api/inbox";
import { enqueueMutationOptions } from "@/api/session";
import { StatusSocket } from "@/api/websocket";
import { assertUnreachable } from "@/components/common/debugging/typing";
import { useStatusSocket } from "@/components/common/websocket/status";
import { EnqueueKind } from "@/pythonTypes";

import { InboxCardContext, useInboxCardContext } from "../cards/inboxCard";
import {
    FolderSelectionContext,
    useFolderSelectionContext,
} from "../folderSelectionContext";

export function useActionMutation(action: Action) {
    const { socket } = useStatusSocket();
    const selectionContext = useFolderSelectionContext();
    const inboxContext = useInboxCardContext();

    const [options, mutationArgs] = actionMutationOptionsAndArgs(
        action,
        socket,
        selectionContext,
        inboxContext
    );
    const { mutate, mutateAsync, ...mutations } = useMutation({
        ...options,
    });

    return {
        ...mutations,
        mutate: () => {
            mutate(mutationArgs);
        },
        mutateAsync: () => {
            return mutateAsync(mutationArgs);
        },
    };
}

function actionMutationOptionsAndArgs<T = unknown>(
    action: Action,
    socket: StatusSocket | null,
    selectionContext: FolderSelectionContext,
    inboxContext: InboxCardContext
): [UseMutationOptions<unknown, APIError, T>, T] {
    const { name, options } = action;
    switch (name) {
        case "retag":
            return [
                enqueueMutationOptions as UseMutationOptions<unknown, APIError, T>,
                {
                    socket,
                    kind: EnqueueKind.PREVIEW,
                    group_albums: options?.group_albums ?? false,
                    autotag: options?.autotag ?? true,
                    selected: selectionContext.selected,
                } as T,
            ];
        case "undo":
            return [
                enqueueMutationOptions as UseMutationOptions<unknown, APIError, T>,
                {
                    socket,
                    kind: EnqueueKind.IMPORT_UNDO,
                    delete_files: options?.delete_files ?? true,
                } as T,
            ];
        case "import_best":
            return [
                enqueueMutationOptions as UseMutationOptions<unknown, APIError, T>,
                {
                    socket,
                    kind: EnqueueKind.IMPORT_CANDIDATE,
                    selected: selectionContext.selected,
                } as T,
            ];
        case "import_bootleg":
            return [
                enqueueMutationOptions as UseMutationOptions<unknown, APIError, T>,
                {
                    socket,
                    kind: EnqueueKind.IMPORT_CANDIDATE,
                    selected: selectionContext.selected,
                } as T,
            ];
        case "delete":
            return [
                deleteFoldersMutationOptions as UseMutationOptions<
                    unknown,
                    APIError,
                    T
                >,
                {
                    // TODO: This is a bit inconsistent, to the other actions
                    folderPaths: selectionContext.selected.paths,
                    folderHashes: selectionContext.selected.hashes,
                } as T,
            ];
        case "delete_imported_folders":
            return [
                deleteFoldersMutationOptions as UseMutationOptions<
                    unknown,
                    APIError,
                    T
                >,
                {
                    folderPaths: inboxContext.importedFolders.map((f) => f.full_path),
                    folderHashes: inboxContext.importedFolders.map((f) => f.hash),
                } as T,
            ];
        default:
            return assertUnreachable(name);
    }
}
