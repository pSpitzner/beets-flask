import * as Diff from "diff";
import { useEffect, useState } from "react";

import styles from "./candidates.module.scss";

/**
 * Custom hook that calculates (and color codes) the difference between two strings.

 * @returns An object containing the left and right parts (old, new) as react componenents, and two booleans indicating if something was removed or added.
 */
export function useDiff(
    one?: string,
    other?: string,
    method?: "chars" | "words" | "wordsWithSpace" | "full"
) {
    const [left, setLeft] = useState<React.ReactNode[]>([]);
    const [right, setRight] = useState<React.ReactNode[]>([]);
    const [didRemove, setRemoved] = useState<boolean>(false);
    const [didAdd, setAdded] = useState<boolean>(false);

    one = one ?? "";
    other = other ?? "";

    useEffect(() => {
        let diff: Diff.Change[] = [];

        if (method === undefined) {
            diff = Diff.diffChars(one, other);
            // simple heuristics: if we have a lot to replaceme, maybe a word diff is better
            if (diff.length > one.length / 2) {
                const wordDiff = Diff.diffWords(one, other);
                if (0.75 * wordDiff.length < diff.length) {
                    diff = wordDiff;
                }
            }
        } else if (method === "words") {
            diff = Diff.diffWords(one, other);
        } else if (method === "wordsWithSpace") {
            diff = Diff.diffWordsWithSpace(one, other);
        } else if (method === "chars") {
            diff = Diff.diffChars(one, other);
        } else if (method === "full") {
            if (one === other) {
                diff = [{ value: one, count: one.length }];
            } else {
                diff = [
                    { value: one, count: one.length, removed: true },
                    { value: other, count: other.length, added: true },
                ];
            }
        }

        const leftParts: React.ReactNode[] = [];
        const rightParts: React.ReactNode[] = [];
        let wasAdded = false;
        let wasRemoved = false;

        diff.forEach((part, index) => {
            const className = part.added
                ? styles.added
                : part.removed
                  ? styles.removed
                  : "";
            const span = (
                <span key={index} className={className}>
                    {part.value}
                </span>
            );

            if (part.added) {
                rightParts.push(span);
                wasAdded = true;
            } else if (part.removed) {
                leftParts.push(span);
                wasRemoved = true;
            } else {
                leftParts.push(span);
                rightParts.push(span);
            }
        });

        setLeft(leftParts);
        setRight(rightParts);
        setAdded(wasAdded);
        setRemoved(wasRemoved);
    }, [one, other, method]);

    return { left, right, didRemove, didAdd };
}
