/** Simple Button to go back one page
 * if there is no history, it will do to the home page.
 *
 */

import { ArrowLeftIcon, LucideProps } from 'lucide-react';
import { useMemo } from 'react';
import { Fab, Zoom } from '@mui/material';
import Button from '@mui/material/Button';
import { useTheme } from '@mui/material/styles';
import { useRouter } from '@tanstack/react-router';

export function BackButton({
    label = 'Go Back',
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
            startIcon={
                <ArrowLeftIcon size={theme.iconSize.sm} {...icon_props} />
            }
            onClick={async () => {
                if (router.history.canGoBack()) {
                    router.history.back();
                } else {
                    await router.navigate({ to: '/' });
                }
            }}
            size="small"
            {...props}
        >
            {label}
        </Button>
    );
}

export function BackIconButton({
    icon_props,
    ...props
}: {
    icon_props?: LucideProps;
} & React.ComponentProps<typeof Fab>) {
    const theme = useTheme();
    const router = useRouter();

    const canGoBack = useMemo(
        () => router.history.canGoBack(),
        [router.history]
    );

    return (
        <Zoom
            in={canGoBack}
            timeout={100}
            style={{
                transitionDelay: `100ms`,
            }}
            unmountOnExit
        >
            <Fab
                onClick={async () => {
                    if (router.history.canGoBack()) {
                        router.history.back();
                    } else {
                        await router.navigate({ to: '/' });
                    }
                }}
                aria-label="Go Back"
                {...props}
            >
                <ArrowLeftIcon size={theme.iconSize.md} {...icon_props} />
            </Fab>
        </Zoom>
    );
}
