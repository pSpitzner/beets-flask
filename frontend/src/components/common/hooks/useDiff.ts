import { type Change, diffChars, diffWords, diffWordsWithSpace } from "diff";
import { useMemo } from "react";

/**
 * Custom hook that calculates the difference between two strings using the `diff` library.
 * Supports multiple comparison methods with automatic fallback heuristics.
 *
 * @param {string | null} from - The original string (default: "")
 * @param {string | null} to - The modified string (default: "")
 * @param {"chars" | "words" | "wordsWithSpace" | "full" | "auto"} method - Comparison method:
 *    - "chars": Character-level diff
 *    - "words": Word-level diff (ignores whitespace)
 *    - "wordsWithSpace": Word-level diff (preserves whitespace)
 *    - "full": Returns full before/after strings as changes
 *    - "auto": Automatically chooses between char/word diff (default)
 * @returns {Change[]} Array of change objects containing:
 *    - value: The substring content
 *    - count: Length of the substring
 *    - added/removed: Change type flags (when applicable)
 * @example
 * const changes = useDiff("Hello world", "Hello there");
 * // Returns diff segments showing removed "world" and added "there"
 * @note Uses memoization to prevent unnecessary recalculations
 * @see https://www.npmjs.com/package/diff for underlying library documentation
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

    return useMemo(() => {
        let diff: Change[] = [];

        if (from.length === 0 && to.length === 0) {
            return [];
        }

        switch (method) {
            case "auto":
                diff = diffChars(from, to);
                // simple heuristics: if we have a lot to replaceme, maybe a word diff is better
                if (diff.length > from.length / 2) {
                    const wordDiff = diffWords(from, to);
                    if (0.75 * wordDiff.length < diff.length) {
                        diff = wordDiff;
                    }
                }
                break;
            case "words":
                diff = diffWords(from, to);
                break;
            case "wordsWithSpace":
                diff = diffWordsWithSpace(from, to);
                break;
            case "chars":
                diff = diffChars(from, to);
                break;
            case "full":
                if (from === to) {
                    diff = [
                        {
                            value: from,
                            count: from.length,
                            added: false,
                            removed: false,
                        },
                    ];
                } else {
                    diff = [
                        {
                            value: from,
                            count: from.length,
                            removed: true,
                            added: false,
                        },
                        {
                            value: to,
                            count: to.length,
                            added: true,
                            removed: false,
                        },
                    ];
                }
                break;
        }
        return diff;
    }, [from, to, method]);
}
