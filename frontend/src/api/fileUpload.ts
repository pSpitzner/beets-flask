import { Dispatch, SetStateAction, useEffect, useState } from "react";
import { useMutation, UseMutationOptions } from "@tanstack/react-query";

import { SerializedException } from "@/pythonTypes";

import { APIError } from "./common";

export interface FileUploadProgress {
    // currently uploading file
    currentIndex: number;
    name: string;
    total: number; // bytes
    loaded: number;
    files: {
        // overall progress
        names: string[];
        nTotal: number;
        total: number; // bytes
        loaded: number;
        started: number;
        finished?: number;
    };
}

export const fileUploadMutationOptions: UseMutationOptions<
    { status: string },
    APIError,
    {
        files: File[] | FileList;
        targetDir: string;
        onProgress?: Dispatch<SetStateAction<FileUploadProgress | null>>;
    }
> = {
    mutationFn: async ({ files, targetDir, onProgress }) => {
        let uploadedBytesTotal = 0;
        const startTotal = performance.now();
        const totalBytes = Array.from(files).reduce((acc, file) => acc + file.size, 0);

        console.log(`Uploading ${files.length} files, total size ${totalBytes} bytes`);

        // We opted to upload files sequentially
        // TODO: what happens if one of the files fails?
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            let uploadedBytesFile = 0;
            await uploadFile(file, targetDir, (fileProgress) => {
                uploadedBytesTotal += fileProgress.loaded - uploadedBytesFile;
                uploadedBytesFile = fileProgress.loaded;
                onProgress?.({
                    currentIndex: i,
                    name: file.name,
                    total: fileProgress.total,
                    loaded: uploadedBytesFile,
                    files: {
                        names: Array.from(files).map((f) => f.name),
                        nTotal: files.length,
                        total: totalBytes,
                        loaded: uploadedBytesTotal,
                        started: startTotal,
                    },
                });
            });
            console.debug(`Uploaded file ${i + 1}/${files.length}: ${file.name}`);
        }

        const finishTotal = performance.now();
        onProgress?.((prev) => {
            if (!prev) return prev;
            return {
                ...prev,
                files: {
                    ...prev?.files,
                    finished: finishTotal,
                },
            };
        });

        console.log(
            `Uploaded ${files.length} files, total size ${totalBytes} bytes in ${
                (finishTotal - startTotal) / 1000
            } seconds`
        );

        return { status: "ok" };
    },
};

/** File level upload
 * @param file The file to upload
 * @param targetDir The target directory on the server
 * @param onProgress Optional callback for progress updates
 */
async function uploadFile(
    file: File,
    targetDir: string,
    onProgress?: (progress: { total: number; loaded: number }) => void
): Promise<{ status: string }> {
    // Validate headers (filename and target dir) before uploading
    // Raises if invalid
    await fetch("/file_upload/validate", {
        method: "POST",
        headers: {
            "X-Filename": encodeURIComponent(file.name),
            "X-File-Target-Dir": targetDir,
        },
    });

    return new Promise<{ status: string }>((resolve, reject) => {
        const req = new XMLHttpRequest();
        req.responseType = "json";
        req.open("POST", "/api_v1/file_upload", true);
        req.setRequestHeader("X-Filename", encodeURIComponent(file.name));
        req.setRequestHeader("X-File-Target-Dir", targetDir);
        // req.setRequestHeader("Content-Length", String(file.size));

        req.upload.onprogress = (event) => {
            if (event.lengthComputable && onProgress) {
                onProgress({ total: event.total, loaded: event.loaded });
            }
        };

        req.onload = () => {
            if (req.status >= 200 && req.status < 300) {
                // onprogress is not called automatically when finally done
                // onProgress?.({ total: file.size, loaded: file.size });
                console.log("File upload resolve");
                resolve({ status: "ok" });
            } else {
                const json_error = req.response as SerializedException;
                console.error("File upload error:", json_error);
                reject(new APIError(json_error, req.status));
            }
        };

        req.onerror = () => {
            const json_error = req.response as SerializedException;
            console.error("File upload error:", req);
            reject(new APIError(json_error, req.status));
        };
        req.send(file);
    });
}

export function useFileUpload() {
    const [uploadProgress, setProgress] = useState<FileUploadProgress | null>(null);
    const { mutate, mutateAsync, ...props } = useMutation(fileUploadMutationOptions);

    useEffect(() => {
        console.log("Upload progress:", uploadProgress);
    }, [uploadProgress]);

    return {
        uploadProgress,
        mutate: (files: FileList | File[], targetDir: string) => {
            mutate({ files, targetDir, onProgress: setProgress });
        },
        mutateAsync: (files: FileList | File[], targetDir: string) =>
            mutateAsync({ files, targetDir, onProgress: setProgress }),
        ...props,
    };
}
