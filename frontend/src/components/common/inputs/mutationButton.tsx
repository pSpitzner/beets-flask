import { useEffect, useState } from "react";
import { Button, ButtonProps, DialogContent } from "@mui/material";
import { useMutation, UseMutationOptions } from "@tanstack/react-query";

import { JSONPretty } from "../debugging/json";
import { Dialog } from "../dialogs";

// data, error, variables
interface MutationActionProps<D, E, V, C> {
    mutateArgs: V;
    mutationOptions: UseMutationOptions<D, E, V, C>;
}

export function MutationButton<D, E, V, C>({
    mutateArgs,
    mutationOptions,
    onClick,
    ...props
}: MutationActionProps<D, E, V, C> & ButtonProps) {
    const { isPending, mutate, isError, error } = useMutation(mutationOptions);
    const [errorIsShown, setErrorShown] = useState(false);

    useEffect(() => {
        if (isError && !errorIsShown) {
            setErrorShown(true);
        }
    }, [isError, errorIsShown]);

    return (
        <>
            <Button
                onClick={(e) => {
                    mutate(mutateArgs);
                    onClick?.(e);
                }}
                loading={isPending}
                loadingPosition="start"
                {...props}
            />
            {isError && (
                <Dialog
                    title="Error"
                    open={isError}
                    onClose={() => {
                        setErrorShown(false);
                    }}
                >
                    <DialogContent>
                        <JSONPretty data={error} />
                    </DialogContent>
                </Dialog>
            )}
        </>
    );
}
