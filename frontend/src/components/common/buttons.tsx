import { CheckIcon } from "lucide-react";
import { forwardRef, useState } from "react";
import { Button, ButtonProps, CircularProgress } from "@mui/material";
import IconButton from "@mui/material/IconButton";
import { useMutation, UseMutationOptions } from "@tanstack/react-query";

import { ConfirmDialog, ErrorDialog } from "./dialogs";

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
        mutateArgs,
        children,
        ...props
    }: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        mutationOption?: UseMutationOptions<unknown, Error, any, unknown>;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        mutateArgs?: any;
    } & ButtonProps,
    ref?: React.Ref<HTMLDivElement>
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
                        mutate(mutateArgs);
                    }
                }}
            >
                {isSuccess ? <CheckIcon /> : children}
            </IconButton>
            {isPending ? (
                <CircularProgress
                    color={props.color}
                    size={"100%"}
                    sx={{
                        position: "absolute",
                        top: "0",
                        left: "0",
                        padding: "2px",
                        zIndex: 1,
                    }}
                />
            ) : null}
            {<ErrorDialog open={isError} error={error} onClose={reset} />}
        </div>
    );
});

/** A Icon button which also requires a confirmation */
export const IconButtonWithMutationAndFeedback = forwardRef(
    function IconButtonWithMutationAndFeedback(
        {
            mutationOption,
            children,
            confirmTitle,
            mutateArgs,
            ...props
        }: {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            mutationOption: UseMutationOptions<unknown, Error, any, unknown>;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            mutateArgs: any;
            confirmTitle: string;
        } & ButtonProps,
        ref?: React.Ref<HTMLDivElement>
    ) {
        const { isSuccess, isPending, mutate, isError, error, reset } =
            useMutation(mutationOption);
        const [show, setShow] = useState(false); // show confirm state

        return (
            <div className="relative" ref={ref}>
                <IconButton {...props} onClick={() => setShow(true)}>
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
                {<ErrorDialog open={isError} error={error} onClose={reset} />}
                {
                    <ConfirmDialog
                        title={confirmTitle}
                        open={show}
                        onConfirm={() => {
                            setShow(false);
                            mutate(mutateArgs);
                        }}
                        onCancel={() => {
                            setShow(false);
                        }}
                    />
                }
            </div>
        );
    }
);

export const IconTextButtonWithMutation = forwardRef(
    function IconTextButtonWithMutation(
        {
            mutationOption,
            icon,
            text,
            ...props
        }: {
            mutationOption?: UseMutationOptions;
            icon: React.ReactNode;
            text: React.ReactNode;
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
            // PS 24-06-06 tailwind css did not seem to work, w-full had no effect for me.
            <div style={{ width: "100%" }} ref={ref}>
                <Button
                    {...props}
                    onClick={(event: React.MouseEvent) => {
                        event.stopPropagation();
                        if (isSuccess) {
                            reset();
                        } else {
                            mutate();
                        }
                    }}
                    variant="text"
                    sx={{
                        width: "100%",
                    }}
                >
                    {isSuccess ? <CheckIcon /> : icon}
                    <span style={{ marginLeft: "0.5rem" }}>{text}</span>
                </Button>
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
                {isError && (
                    <ErrorDialog open={isError} error={error} onClose={reset} />
                )}
            </div>
        );
    }
);
