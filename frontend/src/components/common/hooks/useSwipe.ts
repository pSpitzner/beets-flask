import { useEffect, useRef } from "react";

/**
 * A custom React hook that detects swipe-up gestures on a DOM element.
 *
 * @param onSwipe - Callback function that gets executed when a swipe-up gesture is detected
 * @param threshold - Minimum vertical distance (in pixels) required to trigger the swipe gesture. Defaults to 50px.
 *
 * @returns A ref object that should be attached to the target DOM element you want to monitor for swipe gestures
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const swipeRef = useSwipeUp(() => {
 *     console.log('Swipe up detected!');
 *     // Handle swipe up action
 *   }, 75);
 *
 *   return <div ref={swipeRef}>Swipe up on me!</div>;
 * }
 * ```
 */
export function useSwipeUp(onSwipe: () => void, threshold = 50) {
    const touchStartY = useRef<number | null>(null);

    useEffect(() => {
        const handleTouchStart = (e: TouchEvent) => {
            touchStartY.current = e.touches[0].clientY;
        };

        const handleTouchEnd = (e: TouchEvent) => {
            if (touchStartY.current === null) return;
            const deltaY = touchStartY.current - e.changedTouches[0].clientY;
            if (deltaY > threshold) onSwipe?.();
            touchStartY.current = null;
        };

        const target = ref.current;
        if (!target) return;

        target.addEventListener("touchstart", handleTouchStart, { passive: true });
        target.addEventListener("touchend", handleTouchEnd, { passive: true });

        return () => {
            target.removeEventListener("touchstart", handleTouchStart);
            target.removeEventListener("touchend", handleTouchEnd);
        };
    }, [onSwipe, threshold]);

    const ref = useRef<HTMLDivElement | null>(null);
    return ref;
}
