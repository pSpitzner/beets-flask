import { UseMutationOptions } from "@tanstack/react-query";

import { SerializedException } from "@/pythonTypes";

import { APIError } from "./common";

export const fileUploadMutationOptions: UseMutationOptions<
    { status: string },
    APIError,
    {
        file: File;
        targetDir: string;
        onProgress?: (percent: number) => void;
    }
> = {
    mutationFn: async ({ file, targetDir, onProgress }) => {
        console.debug("Uploading file", file.name, "to", targetDir, file.size);

        return new Promise<{ status: string }>((resolve, reject) => {
            const req = new XMLHttpRequest();
            req.open("POST", "/api_v1/file_upload");
            req.setRequestHeader("X-Filename", encodeURIComponent(file.name));
            req.setRequestHeader("X-File-Target-Dir", targetDir);
            // req.setRequestHeader("Content-Length", String(file.size));

            req.upload.onprogress = (event) => {
                if (event.lengthComputable && onProgress) {
                    const percent = (event.loaded / event.total) * 100;
                    onProgress(percent);
                }
            };

            req.onload = () => {
                if (req.status >= 200 && req.status < 300) {
                    resolve({ status: "ok" });
                } else {
                    const json_error = req.response as SerializedException;
                    reject(new APIError(json_error, req.status));
                }
            };

            req.onerror = () => {
                const json_error = req.response as SerializedException;
                reject(new APIError(json_error, req.status));
            };

            req.send(file);
        });
    },
};
