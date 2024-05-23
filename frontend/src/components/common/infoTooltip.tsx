import { Tooltip } from "@radix-ui/themes";

export function InfoTooltip({
    children,
    content,
}: {
    children: React.ReactNode;
    content: React.ReactNode;
}) {
    return <Tooltip content={content}>{children}</Tooltip>;
}
