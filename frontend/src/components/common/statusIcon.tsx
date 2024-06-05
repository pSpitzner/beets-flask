import { CircleCheck, CircleDashed, CircleHelp } from "lucide-react";
import { Tooltip } from "@mui/material";
import { tagQueryOptions } from "@/lib/tag";
import { useQuery } from "@tanstack/react-query";
import { useContext, useEffect } from "react";
import { sseContext } from "@/lib/fetch";

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
        const messageHandler = (event: MessageEvent) => {
            console.log("messageHandler", event);
        };
        sseSource.addEventListener("tag", messageHandler);

        return () => {
            sseSource.removeEventListener("tag", messageHandler);
        };
    }, [sseSource]);

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
        console.log("matched/tagged");
        icon = <CircleCheck size={12} />;
    } else if (status.toLocaleLowerCase() === "unmatched") {
        icon = <CircleHelp size={12} />;
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
