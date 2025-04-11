import * as Diff from "diff";
import { useEffect, useState } from "react";
import Box from "@mui/material/Box";

/**
 * Custom hook that calculates the difference between two strings.
 * Uses the (diff)[https://www.npmjs.com/package/diff] library.
 * @returns An diff object containing the changes.
 */
export function useDiff(
    from: string | null = "",
    to: string | null = "",
    method: "chars" | "words" | "wordsWithSpace" | "full" | "auto" = "auto"
) {
    if (from === null) {
        from = "";
    }
    if (to === null) {
        to = "";
    }
    const [diff, setDiff] = useState<Diff.Change[]>([]);

    useEffect(() => {
        let diff: Diff.Change[] = [];

        if (from.length === 0 && to.length === 0) {
            setDiff([]);
            return;
        }

        switch (method) {
            case "auto":
                diff = Diff.diffChars(from, to);
                // simple heuristics: if we have a lot to replaceme, maybe a word diff is better
                if (diff.length > from.length / 2) {
                    const wordDiff = Diff.diffWords(from, to);
                    if (0.75 * wordDiff.length < diff.length) {
                        diff = wordDiff;
                    }
                }
                break;
            case "words":
                diff = Diff.diffWords(from, to);
                break;
            case "wordsWithSpace":
                diff = Diff.diffWordsWithSpace(from, to);
                break;
            case "chars":
                diff = Diff.diffChars(from, to);
                break;
            case "full":
                if (from === to) {
                    diff = [{ value: from, count: from.length }];
                } else {
                    diff = [
                        { value: from, count: from.length, removed: true },
                        { value: to, count: to.length, added: true },
                    ];
                }
                break;
        }
        setDiff(diff);
    }, [from, to, method]);

    return diff;
}

/** Old use diff hook
 *
 * @deprecated
 */
export function useDiffOld(
    from: string = "",
    to: string = "",
    method: "chars" | "words" | "wordsWithSpace" | "full" | "auto" = "auto"
) {
    const diff = useDiff(from, to, method);

    const leftParts: React.ReactNode[] = [];
    const rightParts: React.ReactNode[] = [];
    let wasAdded = false;
    let wasRemoved = false;

    diff.forEach((part, index) => {
        const span = (
            <Box
                key={index}
                sx={(theme) => ({
                    color: part.added
                        ? theme.palette.diffs.added
                        : part.removed
                          ? theme.palette.diffs.removed
                          : theme.palette.text.primary,
                })}
                component="span"
            >
                {part.value}
            </Box>
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

    return {
        left: leftParts,
        right: rightParts,
        didRemove: wasRemoved,
        didAdd: wasAdded,
        didChange: wasRemoved || wasAdded,
    };
}
