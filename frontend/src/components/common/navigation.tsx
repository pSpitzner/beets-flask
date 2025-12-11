import { ComponentProps, ReactNode } from 'react';
import {
    Box,
    styled,
    Tab as MuiTab,
    Tabs as MuiTabs,
    Typography,
    useTheme,
} from '@mui/material';
import { createLink, LinkProps, useMatches } from '@tanstack/react-router';

type NavItem = {
    label: ReactNode;
    icon?: ReactNode;
} & LinkProps;

export function NavigationTabs({ items }: { items: NavItem[] }) {
    const theme = useTheme();
    const matches = useMatches();

    let currentIdx = -1;
    for (let i = items.length - 1; i >= 0; i--) {
        const item = items[i];
        const match = matches.some((match) => match.fullPath === item.to);
        if (match) {
            currentIdx = i;
            break;
        }
    }

    return (
        <MuiTabs
            value={currentIdx === -1 ? false : currentIdx}
            role="navigation"
            sx={{
                width: '100%',
                background: theme.palette.background.paper,
                display: 'flex',
                position: 'relative',
                boxSing: 'border-box',
                borderBottom: `1px solid ${theme.palette.primary.muted}`,
            }}
            centered
        >
            {items.map(({ label, icon, ...props }, index) => (
                <TabA
                    key={index}
                    sx={{ maxWidth: 'unset', flex: '1 1 auto' }}
                    label={
                        <Box
                            sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1,
                            }}
                        >
                            {icon}
                            <Typography variant="body1">{label}</Typography>
                        </Box>
                    }
                    activeOptions={{ exact: true }}
                    replace
                    {...(props as ComponentProps<typeof TabA>)}
                />
            ))}
        </MuiTabs>
    );
}

const TabA = createLink(
    styled(MuiTab)(({ theme }) => ({
        display: 'flex',
        alignItems: 'center',
        gap: theme.spacing(1),
        width: '100%',
        padding: theme.spacing(1),
        justifyContent: 'center',
        position: 'relative',

        "&[data-status='active']": {
            color: theme.palette.primary.main,

            ':after': {
                content: '""',
                position: 'absolute',
                bottom: 0,
                left: 0,
                height: '100%',
                width: '100%',
                background: `radial-gradient(ellipse farthest-side at bottom, #ffffff15 0%, transparent 100%)`,
            },
        },
    }))
);
