import { HistoryIcon, ImportIcon, TagIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { Box, Button, ButtonProps, useTheme } from "@mui/material";

import { Action, ActionButtonConfig, InboxFolderFrontendConfig } from "@/api/config";
import { assertUnreachable } from "@/components/common/debugging/typing";
import { BootlegIcon } from "@/components/common/icons";
import {
    SplitButtonOptionProps,
    SplitButtonOptions,
} from "@/components/common/inputs/splitButton";

import { ActionDialog } from "./dialogs";
import { useActionMutation } from "./mutations";

/**
 * Create the actions component from the InboxFolderFrontendConfig
 */
export function InboxActions({
    actionButtons,
}: {
    actionButtons: InboxFolderFrontendConfig["actionButtons"];
}) {
    return (
        <>
            <Box
                sx={{
                    display: "flex",
                    gap: 1,
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexDirection: "row-reverse",
                    width: "100%",
                }}
            >
                <ActionButton
                    variant={actionButtons.primary.variant}
                    actions={actionButtons.primary.actions}
                />
                <ActionButton
                    variant={actionButtons.secondary.variant}
                    actions={actionButtons.secondary.actions}
                />
            </Box>
            <Box
                sx={{
                    width: "100%",
                    marginTop: actionButtons.extra.actions.length > 0 ? 2 : 0,
                    marginLeft: "0 !important",
                }}
            >
                {actionButtons.extra.actions.map((action, index) => (
                    <ActionButton
                        key={index}
                        variant={actionButtons.extra.variant}
                        actions={[action]} // Wrap in an array to match the expected type
                    />
                ))}
            </Box>
        </>
    );
}

function ActionButton({ variant, actions }: ActionButtonConfig) {
    // This is a placeholder for the actual button implementation

    if (!actions || actions.length === 0) {
        return null; // No actions to display
    }

    if (actions.length === 1) {
        // If there's only one action, we can render it directly
        return <ActionButtonSingle action={actions[0]} variant={variant} />;
    }

    if (actions.length > 1) {
        return <ActionButtonMultiple variant={variant} actions={actions} />;
    }
}

function ActionButtonSingle({
    action,
    ...props
}: Omit<ButtonProps, "action"> & {
    action: Action;
}) {
    const [open, setOpen] = useState(false);
    const { mutate, isPending } = useActionMutation(action);

    // Some actions might have a confirmation dialog, so we need to handle that
    // note: we need to call this without jsx to check if it returns a dialog or not
    const Dialog = ActionDialog({ action, open, setOpen });

    const handleClick = (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
        if (Dialog !== null && !e.shiftKey) {
            e.preventDefault();
            setOpen(true);
            return;
        }
        // If no dialog or shift key is pressed, execute the action immediately
        mutate();
    };

    return (
        <>
            <Button
                onClick={handleClick}
                startIcon={<ActionIcon action={action} />}
                loading={isPending}
                color="secondary"
                {...props}
            >
                {action.label || action.name.replace(/_/g, " ")}
            </Button>
            {Dialog}
        </>
    );
}

function ActionButtonMultiple({
    actions,
    ...props
}: {
    actions: ActionButtonConfig["actions"];
} & Omit<SplitButtonOptionProps, "options">) {
    const [open, setOpen] = useState(false);
    const [selectedActionIdx, setSelectedActionIdx] = useState(0);
    const selectedAction = actions[selectedActionIdx];

    const { mutate, isPending } = useActionMutation(selectedAction);

    // Some actions might have a confirmation dialog, so we need to handle that
    // note: we need to call this without jsx to check if it returns a dialog or not
    const Dialog = ActionDialog({ action: selectedAction, open, setOpen });
    const handleClick = (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
        if (Dialog !== null && !e.shiftKey) {
            e.preventDefault();
            setOpen(true);
            return;
        }
        // If no dialog or shift key is pressed, execute the action immediately
        mutate();
    };

    // map actions to options for the split button
    const options = actions.map((action) => ({
        label:
            action.label ||
            action.name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        key: action.name,
        buttonProps: {
            startIcon: <ActionIcon action={action} />,
        },
    }));

    return (
        <SplitButtonOptions
            color="secondary"
            options={options}
            onClick={(option, event) => {
                handleClick(event);
            }}
            onMenuItemClick={(option, index) => {
                setSelectedActionIdx(index);
            }}
            loading={isPending}
            {...props}
        />
    );
}

// TODO move into icons
export function ActionIcon({ action }: { action: ActionButtonConfig["actions"][0] }) {
    const theme = useTheme();

    const size = theme.iconSize.md; // Adjust size as needed

    const name = action.name;
    switch (name) {
        case "retag":
            return <TagIcon size={size} />;
        case "undo":
            return <HistoryIcon size={size} />;
        case "import_bootleg":
            return <BootlegIcon size={size} />;
        case "import_best":
            return <ImportIcon size={size} />;
        case "delete":
            return <Trash2Icon size={size} />;
        case "delete_imported_folders":
            return <Trash2Icon size={size} />;
        default:
            return assertUnreachable(name);
    }
}
