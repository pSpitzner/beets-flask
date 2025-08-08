import { Checkbox, FormControl, FormControlLabel, FormHelperText } from "@mui/material";

import { SubscriptionSettings } from "@/pythonTypes/notifications";

/** Shared settings form for push and webhooks */
export const NotificationsSettings = ({
    settings,
    setSettings,
}: {
    settings: SubscriptionSettings;
    setSettings: (settings: SubscriptionSettings) => void;
}) => {
    return (
        <>
            <FormControl>
                <FormControlLabel
                    control={
                        <Checkbox
                            sx={{ marginInline: 1, p: 0 }}
                            checked={settings.is_active}
                            onChange={(e) => {
                                setSettings({
                                    ...settings,
                                    is_active: e.target.checked,
                                });
                            }}
                        />
                    }
                    label="Enabled"
                />
                <FormHelperText>
                    If enabled, the server will send notifications to your device.
                </FormHelperText>
            </FormControl>
        </>
    );
};
