import { CircleCheck, CircleDashed, CircleHelp } from "lucide-react";

export function StatusIcon({
    status,
    className,
}: {
    status: string;
    className?: string;
}) {
    switch (status) {
        case "imported":
            return (
                <div title={status} className={className}>
                    <CircleCheck />
                </div>
            );
        case "unmatched":
            return (
                <div title={status} className={className}>
                    <CircleHelp />
                </div>
            );
        default:
            return (
                <div title={status} className={className}>
                    <CircleDashed size={10} />
                </div>
            );
    }
}
