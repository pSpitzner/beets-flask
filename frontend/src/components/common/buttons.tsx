import IconButton from "@mui/material/IconButton";
import { UseMutationOptions, useMutation } from "@tanstack/react-query";
import { CheckIcon } from "lucide-react";
import ErrorDialog from "./dialogs";
import { ButtonProps, CircularProgress } from "@mui/material";
import { forwardRef } from "react";

/**
 * Renders an icon button with a mutation option.
 *
 * This will handle the mutation state and display a loader when the mutation is pending.
 * It will also display an error dialog when the mutation fails.
 *
 * We might want to change to a throbber instead of a spinner.
 *
 * @param mutationOption - The mutation option to be used.
 * @param children - The content of the icon button.
 * @param props - Additional props for the icon button component.
 * @returns The rendered icon button with mutation functionality.
 */
export const IconButtonWithMutation = forwardRef(function IconButtonWithMutation(
    {
        mutationOption,
        children,
        ...props
    }: {
        mutationOption?: UseMutationOptions;
    } & ButtonProps,
    ref: React.Ref<HTMLDivElement>
) {
    const { isSuccess, isPending, mutate, isError, error, reset } = useMutation(
        mutationOption ?? {
            mutationFn: async () => {
                return new Promise((resolve, reject) => {
                    setTimeout(() => {
                        Math.random() > 0.5
                            ? reject(new Error("Random error occurred."))
                            : resolve("success");
                    }, 1000);
                });
            },
        }
    );

    return (
        <div className="relative" ref={ref}>
            <IconButton
                {...props}
                onClick={() => {
                    if (isSuccess) {
                        reset();
                    } else {
                        mutate();
                    }
                }}
            >
                {isSuccess ? <CheckIcon /> : children}
            </IconButton>
            {isPending ? (
                <CircularProgress
                    color={props.color}
                    sx={{
                        position: "absolute",
                        top: "0",
                        left: "0",
                        padding: "2px",
                        zIndex: 1,
                    }}
                />
            ) : null}
            {isError && <ErrorDialog open={isError} error={error} onClose={reset} />}
        </div>
    );
});