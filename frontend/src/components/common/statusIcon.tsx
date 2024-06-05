import {
    CircleCheck,
    CircleCheckBig,
    CircleDashed,
    CircleHelp,
    TriangleAlert,
} from "lucide-react";
import { Tooltip } from "@mui/material";
import { tagQueryOptions } from "@/lib/tag";
import { useQuery } from "@tanstack/react-query";

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
