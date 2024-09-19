import {
    CircleCheckBig,
    CircleDashed,
    Copy,
    RectangleEllipsis,
    Tag,
    TriangleAlert,
} from "lucide-react";
import { Tooltip } from "@mui/material";
import { useQuery } from "@tanstack/react-query";

import { tagQueryOptions } from "@/components/common/_query";

import styles from "./statusIcon.module.scss";

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
    const status = data?.status ?? "untagged";

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
        icon = <Tag size={12} />;
    } else if (status.toLocaleLowerCase() === "imported") {
        icon = <CircleCheckBig size={12} />;
    } else if (status.toLocaleLowerCase() === "unmatched") {
        icon = <RectangleEllipsis size={12} />;
    } else if (status.toLocaleLowerCase() === "duplicate") {
        icon = <Copy size={12} />;
    } else if (status.toLocaleLowerCase() === "failed") {
        icon = <TriangleAlert size={12} />;
    } else if (["tagging", "importing"].includes(status.toLocaleLowerCase())) {
        icon = (
            // could not make the mui spinner smaller, so used custom css.
            // the extra divs are needed.
            (<div className={styles.spinner}>
                <div></div>
                <div></div>
                <div></div>
                <div></div>
            </div>)
        );
    } else if (status.toLocaleLowerCase() === "pending") {
        icon = (
            <div className={styles.ripple}>
                <div></div>
                <div></div>
            </div>
        );
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
