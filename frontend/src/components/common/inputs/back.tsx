/** Simple Button to go back one page
 * if there is no history, it will do to the home page.
 *
 */

import { ArrowLeftIcon, LucideProps } from "lucide-react";
import Button from "@mui/material/Button";
import { useTheme } from "@mui/material/styles";
import { useRouter } from "@tanstack/react-router";

export function BackButton({
    label = "Go Back",
    icon_props,
    ...props
}: {
    label?: string;
    icon_props?: LucideProps;
} & React.ComponentProps<typeof Button>) {
    const theme = useTheme();
    const router = useRouter();

    return (
        <Button
            startIcon={<ArrowLeftIcon size={theme.iconSize.sm} {...icon_props} />}
            onClick={async () => {
                if (router.history.canGoBack()) {
                    router.history.back();
                } else {
                    await router.navigate({ to: "/" });
                }
            }}
            size="small"
            {...props}
        >
            {label}
        </Button>
    );
}
