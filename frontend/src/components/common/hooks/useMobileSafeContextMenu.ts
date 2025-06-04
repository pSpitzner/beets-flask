import { useRef } from "react";

/**
 * A custom hook to handle context menu events in a mobile-friendly way.
 * It triggers a custom context menu callback after a long press on touch devices
 * or a right-click on desktop devices.
 *
 * Taken from my snip lab book project ;)
 *
 * @param onContextMenu - The callback function to execute when the context menu is triggered.
 * @param duration - The duration (in milliseconds) to wait before triggering the context menu on touch devices. Default is 500ms.
 * @returns An object containing event handlers to be spread onto the target element.
 *
 * @example
 * const elemProps = useMobileSafeContextMenu((event) => {
 *   console.log("Context menu triggered", event);
 * });
 *
 * return (
 *   <div
 *     {...elemProps}
 *   >
 *     Right-click or long-press me
 *   </div>
 * );
 */
export const useMobileSafeContextMenu = (
    onContextMenu: (event: React.PointerEvent) => void,
    duration = 500
) => {
    const pressTimer = useRef<number | null>(null);

    const start = (event: React.PointerEvent) => {
        if (event.pointerType === "touch" || event.pointerType === "pen") {
            pressTimer.current = window.setTimeout(() => {
                onContextMenu(event); // Trigger the context menu callback
            }, duration);
        } else if (event.pointerType === "mouse" && event.button === 2) {
            // Right-click on desktop
            onContextMenu(event);
        }
    };

    const stop = () => {
        if (pressTimer.current !== null) {
            window.clearTimeout(pressTimer.current);
        }
    };

    return {
        onPointerDown: start,
        onPointerUp: stop,
        onPointerLeave: stop,
        onPointerCancel: stop,
        onContextMenu: (event: React.MouseEvent) => {
            event.preventDefault(); // Prevent the default context menu from appearing
        },
    };
};
