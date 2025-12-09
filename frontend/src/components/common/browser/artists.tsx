import { RowComponentProps } from 'react-window';
import { Box, Typography, useTheme } from '@mui/material';
import { Link } from '@tanstack/react-router';

import { Artist } from '@/api/library';

import { LoadingRow } from './loading';

import { ArtistIcon } from '../icons';

export interface ArtistBrowserProps {
    artists: Array<Artist>;
}

export function ArtistListRow({
    artists,
    index,
    style,
}: RowComponentProps<ArtistBrowserProps>) {
    const theme = useTheme();
    const artist = artists.at(index);
    if (!artist) {
        return <LoadingRow style={style} icon="artist" />;
    }

    return (
        <Link
            to="/library/browse/artists/$artist"
            params={{ artist: artist.artist }}
            style={style}
        >
            <Box
                sx={(theme) => ({
                    height: '35px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: 1,
                    gap: 2,
                    ':hover': {
                        background: `linear-gradient(to left, transparent 0%, ${theme.palette.primary.muted} 100%)`,
                        color: 'primary.contrastText',
                    },
                })}
            >
                <Typography variant="body1">
                    {artist.artist || 'Unknown Artist'}
                </Typography>
                <ArtistIcon
                    color={theme.palette.background.paper}
                    style={{
                        marginRight: '2rem',
                    }}
                />
            </Box>
        </Link>
    );
}
