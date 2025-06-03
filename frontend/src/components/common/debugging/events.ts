/** Allows to add a function to trigger on any event of an
 * given target.
 * * @param target - The target object to listen to events on.
 * * @param listener - The function to call when an event is triggered.
 *
 * Example usage:
 * ```javascript
 * import { addAllEvent } from './events';
 * * const myElement = document.getElementById('myElement');
 * * addAllEvent(myElement, (event) => {
 * *     console.log(`Event ${event.type} triggered on myElement`);
 * * });
 * ```
 */
export function addAllEvent(target: EventTarget, listener: EventListener) {
    for (const key in target) {
        if (/^on/.test(key)) {
            const eventType = key.substr(2);
            target.addEventListener(eventType, listener);
        }
    }
}
