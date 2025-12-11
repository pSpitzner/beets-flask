import { Avatar, Box, Typography } from '@mui/material';

export function CardHeader({
    icon,
    title,
    subtitle,
    children,
}: {
    icon: React.ReactNode;
    title: string;
    subtitle?: string;
    children?: React.ReactNode;
}) {
    return (
        <Box
            sx={{
                display: 'flex',
                gap: 2,
                alignItems: 'center',
            }}
        >
            <Avatar
                sx={{
                    color: 'black',
                    bgcolor: 'secondary.main',
                }}
            >
                {icon}
            </Avatar>
            <Box>
                <Typography
                    variant="body1"
                    component="div"
                    sx={{
                        fontWeight: 600,
                    }}
                >
                    {title}
                </Typography>
                <Typography variant="body2" component="div">
                    {subtitle}
                </Typography>
            </Box>
            {children}
        </Box>
    );
}
