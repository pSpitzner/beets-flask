import { ClipboardCheckIcon, ClipboardIcon, LucideProps } from "lucide-react";
import { useState } from "react";
import { Tooltip } from "@mui/material";
import IconButton from "@mui/material/IconButton";

/** Minimal copy button/icon
 *
 * On copy click, the text is copied to the clipboard and
 * a small feedback on the icon is shown.
 */
export function ClipboardCopyButton({
    text,
    label,
    children,
    icon_props,
    ...props
}: { text: string; label?: string; icon_props?: LucideProps } & React.ComponentProps<
    typeof IconButton
>) {
    const [copied, setCopied] = useState(false);

    return (
        <Tooltip title={label ?? "Copy to clipboard"} arrow>
            <IconButton
                onClick={() => {
                    navigator.clipboard.writeText(text).catch(console.error);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 5000);
                }}
                disableRipple
                {...props}
            >
                {!copied ? (
                    <ClipboardIcon {...icon_props} />
                ) : (
                    <ClipboardCheckIcon {...icon_props} />
                )}
                {children}
            </IconButton>
        </Tooltip>
    );
}
