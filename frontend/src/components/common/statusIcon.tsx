import {
    CircleIcon,
    QuestionMarkCircledIcon,
    CheckCircledIcon,
} from "@radix-ui/react-icons";

export function StatusIcon({ status, className }: { status: string, className?: string}) {
    switch (status) {
        case "imported":
            return (
                <div title={status} className={className}>
                    <CheckCircledIcon />
                </div>
            );
        case "unmatched":
            return (
                <div title={status} className={className}>
                    <QuestionMarkCircledIcon />
                </div>
            );
        default:
            return (
                <div title={status} className={className}>
                    <CircleIcon />
                </div>
            );
    }
}
