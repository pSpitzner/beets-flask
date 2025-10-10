import { XIcon } from "lucide-react";
import { useImperativeHandle, useRef, useState } from "react";
import { Button, ButtonProps } from "@mui/material";

export interface CancelButtonRef {
    triggerCancel: (skipAnimation: boolean) => void;
}

/** Cancel button
 *
 * Advanced usage:
 *
 * Allows to set a timeout which shown an animation
 * on the button before calling the onCancel function.
 * This can be triggered using the CancelButtonRef. This
 * does not trigger on the button click, only when the
 * triggerCancel function is called.
 *
 * Example:
 * const cancelButtonRef = useRef<CancelButtonRef>(null);
 * <CancelButton ref={cancelButtonRef} onCancel={() => { ... }} />
 * cancelButtonRef.current?.triggerCancel();
 *
 */
export function CancelButton({
    ref,
    onCancel,
    timeout = 3000,
    ...props
}: {
    ref?: React.Ref<CancelButtonRef>;
    onCancel: () => void;
    timeout?: number;
} & Omit<ButtonProps, "onClick" | "ref">) {
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const [isCancelling, setIsCancelling] = useState(false);

    useImperativeHandle(ref, () => ({
        triggerCancel: (skipAnimation) => {
            if (skipAnimation) {
                onCancel();
            } else {
                setIsCancelling(true);

                timeoutRef.current = setTimeout(() => {
                    onCancel();
                    setIsCancelling(false);
                }, timeout);
            }
        },
    }));

    return (
        <Button
            onClick={() => {
                if (isCancelling && timeoutRef.current) {
                    clearTimeout(timeoutRef.current);
                } else {
                    setIsCancelling(false);
                    onCancel();
                }
            }}
            startIcon={<XIcon />}
            disabled={isCancelling}
            {...props}
        >
            {isCancelling ? "Cancelling..." : "Cancel"}
        </Button>
    );
}
