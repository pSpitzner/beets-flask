import { CircleCheck, CircleCheckBig, CircleDashed, CircleHelp, TriangleAlert } from "lucide-react";
import { Tooltip } from "@mui/material";
import { tagQueryOptions } from "@/lib/tag";
import { useQuery } from "@tanstack/react-query";
import { useContext, useEffect } from "react";
import { SseInvalidationI, sseContext } from "@/lib/fetch";
import { queryClient } from "@/main";

export function TagStatusIcon({
    tagId,
    tagPath,
    className,
}: {
    tagId?: string;
    tagPath?: string;
    className?: string;
}) {
    const { data } = useQuery(tagQueryOptions(tagId, tagPath));
    const status = data?.status ?? "frontend waiting";

    // subscribe to SSE for invalidation
    const sseSource = useContext(sseContext);
    useEffect(() => {
        const handler = (event: MessageEvent) => {
            const newData = JSON.parse(event.data as string) as SseInvalidationI;

            if (newData.tagPath !== tagPath) {
                return;
            }

            console.log(`SSE event for ${tagPath}`, newData);

            if (newData.attributes === "all") {
                void queryClient.invalidateQueries({ queryKey: newData.queryKey });
            } else {
                queryClient.setQueryData(newData.queryKey, newData.attributes);
            }
        };
        sseSource.addEventListener("tag", handler);

        return () => {
            sseSource.removeEventListener("tag", handler);
        };
    }, [sseSource, tagId, tagPath]);

    return <StatusIcon status={status} className={className} />;
}

export function StatusIcon({
    status,
    className,
}: {
    status: string;
    className?: string;
}) {
    let icon = <CircleDashed size={12} />;

    if (["matched", "tagged"].includes(status.toLocaleLowerCase())) {
        icon = <CircleCheck size={12} />;
    } else if (status.toLocaleLowerCase() === "imported") {
        icon = <CircleCheckBig size={12} />;
    } else if (status.toLocaleLowerCase() === "unmatched") {
        icon = <CircleHelp size={12} />;
    } else if (status.toLocaleLowerCase() === "failed") {
        icon = <TriangleAlert size={12} />;
    }

    return (
        <Tooltip
            placement="bottom-start"
            title={`Status: ${status.charAt(0).toUpperCase() + status.slice(1)}`}
            className={className}
        >
            {icon}
        </Tooltip>
    );
}
