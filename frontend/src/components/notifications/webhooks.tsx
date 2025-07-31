/** This file includes all components for creating
 * and managing webhooks in the notification system.
 *
 * Main Components:
 * - WebhookList: Displays a list of existing webhooks. [exported]
 *   - AddButton: Button to add a new webhook.
 *    - *
 *   - DeleteIconButton: Button to delete a webhook.
 *   - ConfigIconButton: Button to configure a webhook.
 *    - *
 *
 *  * - Editor: Component to edit or create a webhook.
 */

import {
    PlusIcon,
    SaveIcon,
    SettingsIcon,
    Trash2Icon,
    WebhookIcon,
} from "lucide-react";
import test from "node:test";
import { useEffect, useState } from "react";
import {
    Box,
    BoxProps,
    Button,
    ButtonProps,
    DialogContent,
    FormControl,
    FormHelperText,
    IconButton,
    InputLabel,
    MenuItem,
    Select,
    TextField,
    TextFieldProps,
    Typography,
    useTheme,
} from "@mui/material";
import { useInfiniteQuery, useMutation } from "@tanstack/react-query";

import {
    deleteWebhookMutationOptions,
    testWebhookMutationOptions,
    upsertWebhookMutationOptions,
    webhooksInfiniteQueryOptions,
    WebhookSubscribeRequest,
} from "@/api/notifications";
import { WebhookSubscription } from "@/pythonTypes/notifications";

import { Dialog } from "../common/dialogs";
import { isValidUrl } from "../common/strings";

export function WebHookList() {
    // In theory we support paging, but in practice it is very unlikely that
    // there will be more than a few webhooks, so we use an infinite query
    const { data: webhooks } = useInfiniteQuery(webhooksInfiniteQueryOptions());

    return (
        <Box
            sx={{
                display: "grid",
                gridTemplateColumns: "auto 1fr auto",
                padding: 1,
                columnGap: 2,
                alignItems: "center",

                // Add zebra striping
                "> div:nth-of-type(odd)": {
                    background: `linear-gradient(
                        90deg,
                        rgba(0, 0, 0, 0.01) 0%,
                        rgba(0, 0, 0, 0.2) 50%,
                        rgba(0, 0, 0, 0.01) 100%
                    )`,
                },
            }}
        >
            <Box
                sx={{
                    display: "grid",
                    gridColumn: "1 / -1",
                    gridTemplateColumns: "subgrid",
                    gridAutoFlow: "column dense",
                    alignItems: "center",
                    paddingBlock: 1,
                }}
            >
                {webhooks && webhooks.length > 0 ? (
                    <>
                        <Typography variant="caption" sx={{ color: "text.secondary" }}>
                            Method
                        </Typography>
                        <Typography variant="caption" sx={{ color: "text.secondary" }}>
                            URL
                        </Typography>
                        <Typography
                            variant="caption"
                            sx={{
                                color: "text.secondary",
                                gridColumn: "3 / -1",
                                textAlign: "center",
                            }}
                        >
                            Actions
                        </Typography>
                    </>
                ) : (
                    <Typography variant="body2" sx={{ gridColumn: "1 / -1" }}>
                        No webhooks configured.
                    </Typography>
                )}
            </Box>

            {webhooks?.map((hook) => (
                <Box
                    key={hook.id}
                    sx={{
                        display: "grid",
                        gridColumn: "1 / -1",
                        gridTemplateColumns: "subgrid",
                        gridAutoFlow: "column dense",
                        alignItems: "center",
                        paddingBlock: 0.25,
                    }}
                >
                    <Typography
                        variant="caption"
                        sx={{
                            color: "text.secondary",
                        }}
                    >
                        {hook.method}
                    </Typography>
                    <Typography
                        variant="body1"
                        sx={{
                            color: "text.primary",
                            textTransform: "lowercase",
                            lineHeight: 1,
                            overflowWrap: "break-all",
                            wordBreak: "break-all",
                        }}
                    >
                        {hook.url}
                    </Typography>
                    <Box>
                        <SettingsIconButton webhook={hook} />
                        <DeleteIconButton webhookId={hook.id} />
                    </Box>
                </Box>
            ))}

            <AddButton
                variant="text"
                sx={{
                    gridColumn: "1 / -1",
                    display: "flex",
                    justifyContent: "flex-end",
                    marginTop: 1,
                    ml: "auto",
                }}
            />
        </Box>
    );
}

/** Button to add a new webhook
 *
 * This button opens a dialog to create a new webhook.
 */
function AddButton(props: ButtonProps) {
    const theme = useTheme();
    const [open, setOpen] = useState(false);
    const { mutateAsync: addWebhook } = useMutation(upsertWebhookMutationOptions);

    const [newHook, setNewHook] = useState<WebhookSubscribeRequest>({
        method: "POST",
        url: "",
        settings: null,
        body: null,
        headers: null,
        params: null,
    });

    function resetNewHook() {
        setNewHook({
            method: "POST",
            url: "",
            settings: null,
            body: null,
            headers: null,
            params: null,
        });
    }

    return (
        <>
            <Button
                {...props}
                onClick={() => setOpen(true)}
                startIcon={<PlusIcon size={theme.iconSize.md} />}
            >
                Add
            </Button>

            <Dialog
                open={open}
                onClose={(e, reason) => {
                    if (reason === "backdropClick") return;
                    setOpen(false);
                }}
                title="New Webhook"
                title_icon={<WebhookIcon size={theme.iconSize.lg} />}
            >
                <DialogContent
                    sx={{ display: "flex", flexDirection: "column", gap: 2 }}
                >
                    <Editor webhook={newHook} setWebhook={setNewHook} />
                    <Box
                        sx={{
                            display: "flex",
                            gap: 1,
                            marginTop: 2,
                            justifyContent: "space-between",
                        }}
                    >
                        <TestWebhookButton webhook={newHook} />
                        <Button
                            variant="contained"
                            startIcon={<PlusIcon size={theme.iconSize.md} />}
                            disabled={isValidUrl(newHook.url) === false}
                            onClick={async () => {
                                await addWebhook(newHook);
                                resetNewHook();
                                setOpen(false);
                            }}
                        >
                            Add
                        </Button>
                    </Box>
                </DialogContent>
            </Dialog>
        </>
    );
}

/** Button to delete a webhook
 *
 * This button opens a confirmation dialog to delete the webhook.
 */
function DeleteIconButton({ webhookId }: { webhookId: string }) {
    const theme = useTheme();
    const [open, setOpen] = useState(false);
    const { mutateAsync: deleteWebhook, isPending } = useMutation(
        deleteWebhookMutationOptions
    );

    const handleClick = async (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
        if (!e.shiftKey) {
            e.preventDefault();
            setOpen(true);
            return;
        }
        await deleteWebhook(webhookId);
        setOpen(false);
    };

    return (
        <>
            <IconButton
                color="error"
                onClick={handleClick}
                title="Delete Webhook"
                loading={isPending}
            >
                <Trash2Icon size={theme.iconSize.md} />
            </IconButton>
            <Dialog
                open={open}
                onClose={() => setOpen(false)}
                title="Delete webhook? "
                title_icon={<Trash2Icon size={theme.iconSize.lg} />}
                color="secondary"
            >
                <DialogContent>
                    <Typography variant="body2" color="text.secondary">
                        Are you sure you want to delete this webhook? This action cannot
                        be undone.
                    </Typography>
                    <Box
                        sx={{
                            display: "flex",
                            justifyContent: "flex-end",
                            marginTop: 2,
                        }}
                    >
                        <Button
                            variant="contained"
                            color="error"
                            onClick={async () => {
                                await deleteWebhook(webhookId);
                                setOpen(false);
                            }}
                        >
                            Delete
                        </Button>
                    </Box>
                </DialogContent>
            </Dialog>
        </>
    );
}

function TestWebhookButton({
    webhook,
}: {
    webhook: WebhookSubscription | WebhookSubscribeRequest;
}) {
    const {
        mutateAsync: testWebhook,
        data,
        isPending,
    } = useMutation(testWebhookMutationOptions);

    useEffect(() => {
        // Am a bit lazy here we just alert the error
        // TODO: maybe show a snackbar instead?
        if (data?.status === "error") {
            alert(`Webhook notification test failed: ${data.error}`);
        }
    }, [data]);

    return (
        <Button
            variant="text"
            onClick={async () => {
                await testWebhook(webhook);
            }}
            loading={isPending}
        >
            {!data ? "Test" : null}
            {data?.status === "ok" ? (
                <span style={{ color: "green" }}>Test successful</span>
            ) : data?.status === "error" ? (
                <span style={{ color: "red" }}>Test failed</span>
            ) : null}
        </Button>
    );
}

function SettingsIconButton({ webhook }: { webhook: WebhookSubscription }) {
    const theme = useTheme();
    const [open, setOpen] = useState(false);

    const { mutateAsync: updateWebhook } = useMutation(upsertWebhookMutationOptions);

    const [webhookCopy, setWebhookCopy] = useState<
        WebhookSubscription | WebhookSubscribeRequest
    >(webhook);

    return (
        <>
            <IconButton title="Configure Webhook" onClick={() => setOpen(true)}>
                <SettingsIcon size={theme.iconSize.md} />
            </IconButton>

            <Dialog
                open={open}
                onClose={() => setOpen(false)}
                title="Configure Webhook"
                title_icon={<WebhookIcon size={theme.iconSize.lg} />}
            >
                <DialogContent
                    sx={{ display: "flex", flexDirection: "column", gap: 2 }}
                >
                    <Editor webhook={webhookCopy} setWebhook={setWebhookCopy} />
                    <Box
                        sx={{
                            display: "flex",
                            gap: 1,
                            marginTop: 2,
                            justifyContent: "space-between",
                        }}
                    >
                        <TestWebhookButton webhook={webhookCopy} />
                        <Button
                            variant="contained"
                            onClick={async () => {
                                await updateWebhook(webhookCopy);
                                setOpen(false);
                            }}
                        >
                            Save
                        </Button>
                    </Box>
                </DialogContent>
            </Dialog>
        </>
    );
}

/** Allows to edit a webhook
 * can also be used to create a new webhook.
 */
function Editor({
    webhook,
    setWebhook,
}: {
    webhook: WebhookSubscription | WebhookSubscribeRequest;
    setWebhook: (webhook: WebhookSubscription | WebhookSubscribeRequest) => void;
}) {
    const validUrl = isValidUrl(webhook.url);

    return (
        <>
            <Typography variant="body2" color="text.secondary">
                A webhook sends real-time data to a specified URL when an event occurs.
                Configure it by selecting an accessible URL, choosing an HTTP method
                (e.g., POST, GET), and adding optional headers for authentication or
                metadata. Most use POST with a JSON payload, but follow your server's
                API requirements.
            </Typography>
            <Box
                sx={{
                    display: "flex",
                    gap: 1,
                    flexDirection: "column",
                }}
            >
                <Typography variant="subtitle2" sx={{ marginBottom: 0.5 }}>
                    Endpoint
                </Typography>
                <FormControl fullWidth sx={{ marginBottom: 1 }}>
                    <TextField
                        error={!validUrl && webhook.url.length > 0}
                        label="URL"
                        value={webhook.url}
                        onChange={(e) =>
                            setWebhook({ ...webhook, url: e.target.value })
                        }
                        placeholder="localhost:4000"
                    />
                    <FormHelperText>
                        {!validUrl && webhook.url.length > 0
                            ? "Please enter a valid URL."
                            : "The URL to send the webhook to. This should be an accessible URL that your server can reach."}
                    </FormHelperText>
                </FormControl>
                <FormControl fullWidth>
                    <InputLabel id="method-label">Method</InputLabel>
                    <Select
                        variant="outlined"
                        value={webhook.method}
                        onChange={(e) =>
                            setWebhook({
                                ...webhook,
                                method: e.target.value,
                            })
                        }
                        label="Method"
                        labelId="method-label"
                    >
                        <MenuItem value="GET">GET</MenuItem>
                        <MenuItem value="POST">POST</MenuItem>
                        <MenuItem value="PUT">PUT</MenuItem>
                        <MenuItem value="PATCH">PATCH</MenuItem>
                        <MenuItem value="DELETE">DELETE</MenuItem>
                    </Select>
                    <FormHelperText>
                        The HTTP method to use for the webhook. Most webhooks use POST,
                        but you can use any method that your server supports.
                    </FormHelperText>
                </FormControl>
            </Box>
            <Box
                sx={{
                    display: "flex",
                    gap: 1,
                    flexDirection: "column",
                }}
            >
                <Typography variant="subtitle2" sx={{ marginBottom: 0.5 }}>
                    Headers
                </Typography>
                <RecordFieldsInput
                    value={webhook.headers}
                    onChange={(value) => setWebhook({ ...webhook, headers: value })}
                />
            </Box>
            <Box
                sx={{
                    display: "flex",
                    gap: 1,
                    flexDirection: "column",
                }}
            >
                <Typography variant="subtitle2" sx={{ marginBottom: 0.5 }}>
                    Settings
                </Typography>
                {webhook.settings?.is_active}
            </Box>
        </>
    );
}

/* --------------------------------- Helpers -------------------------------- */

/** Two textfields that allow to set key value pairs of a dictionary */
function RecordFieldsInput({
    value,
    onChange,
}: {
    value: Record<string, string> | null;
    onChange: (value: Record<string, string> | null) => void;
}) {
    const theme = useTheme();
    const [kv, setKv] = useState({ key: "", value: "" });

    return (
        <>
            {Object.entries(value || {}).map(([key, val], index) => (
                <JoinedTextInputs
                    key={index}
                    disabled
                    props1={{
                        value: key,
                        label: "",
                    }}
                    props2={{ value: val, label: "" }}
                >
                    <Button
                        sx={{ m: 0, p: 0, minWidth: "unset", aspectRatio: "1" }}
                        onClick={() => {
                            const newValue = { ...value };
                            delete newValue[key];
                            onChange(newValue);
                        }}
                    >
                        <Trash2Icon size={theme.iconSize.lg} />
                    </Button>
                </JoinedTextInputs>
            ))}
            <JoinedTextInputs
                props1={{
                    value: kv.key,
                    onChange: (e) => setKv({ ...kv, key: e.target.value }),
                }}
                props2={{
                    value: kv.value,
                    onChange: (e) => setKv({ ...kv, value: e.target.value }),
                }}
            >
                <Button
                    sx={{ m: 0, p: 0, minWidth: "unset", aspectRatio: "1" }}
                    onClick={() => {
                        if (kv.key && kv.value) {
                            const newValue = { ...value, [kv.key]: kv.value };
                            onChange(newValue);
                            setKv({ key: "", value: "" });
                        }
                    }}
                >
                    <SaveIcon size={theme.iconSize.lg} />
                </Button>
            </JoinedTextInputs>
        </>
    );
}

function JoinedTextInputs({
    props1,
    props2,
    children,
    disabled = false,
    ...props
}: {
    props1?: TextFieldProps;
    props2?: TextFieldProps;
    disabled?: boolean;
} & BoxProps) {
    return (
        <Box sx={{ display: "flex", gap: 0.5, width: "100%" }} {...props}>
            <TextField
                sx={{
                    ".MuiOutlinedInput-notchedOutline": {
                        borderTopRightRadius: 0,
                        borderBottomRightRadius: 0,
                    },
                }}
                autoComplete="false"
                type="text"
                label="Key"
                id={"key" + Math.random().toString(36).substring(2, 15)}
                placeholder="Authorization"
                disabled={disabled}
                {...props1}
            />
            <TextField
                sx={{
                    ".MuiOutlinedInput-notchedOutline": {
                        borderTopLeftRadius: 0,
                        borderBottomLeftRadius: 0,
                    },
                    width: "100%",
                }}
                autoComplete="false"
                type="text"
                label="Value"
                id={"value" + Math.random().toString(36).substring(2, 15)}
                placeholder="Bearer <token>"
                disabled={disabled}
                {...props2}
            />
            {children}
        </Box>
    );
}
