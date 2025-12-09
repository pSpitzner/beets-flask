import { RowComponentProps } from 'react-window';
import { Box, Typography, useTheme } from '@mui/material';
import { Link } from '@tanstack/react-router';

import { ItemResponseMinimal } from '@/pythonTypes';

import { LoadingRow } from './loading';

import { TrackIcon } from '../icons';

export interface ItemListRowProps {
    items: Array<ItemResponseMinimal>;
    showAlbum?: boolean;
    showArtist?: boolean;
}

export function ItemListRow({
    items,
    index,
    style,
    showAlbum = true,
    showArtist = true,
}: RowComponentProps<ItemListRowProps>) {
    const theme = useTheme();
    const item = items.at(index);
    if (!item) {
        return <LoadingRow style={style} icon="item" />;
    }

    return (
        <Link
            to="/library/item/$itemId"
            key={item.id}
            params={{ itemId: item.id }}
            preloadDelay={2000}
            style={style}
        >
            <Box
                sx={(theme) => ({
                    height: style.height,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingInline: 1,
                    ':hover': {
                        background: `linear-gradient(to left, transparent 0%, ${theme.palette.primary.muted} 100%)`,
                        color: 'primary.contrastText',
                    },
                })}
            >
                <Box
                    sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        mr: 'auto',
                    }}
                >
                    <Typography
                        variant="body1"
                        fontWeight="bold"
                        color="text.primary"
                    >
                        {item.name || 'Unknown Title'}
                    </Typography>
                    <Box
                        sx={{
                            display: 'flex',
                            flexDirection: 'row',
                            color: 'text.secondary',
                            alignItems: 'center',
                        }}
                    >
                        {showArtist && (
                            <Typography variant="body2">
                                {item.artist || 'Unknown Artist'}
                            </Typography>
                        )}
                        {showAlbum && showArtist && (
                            <span style={{ margin: '0 4px' }}>•</span>
                        )}
                        {showAlbum && (
                            <Typography variant="body2">
                                {item.album || 'Unknown Album'}
                            </Typography>
                        )}
                    </Box>
                </Box>
                <TrackIcon color={theme.palette.background.paper} />
            </Box>
        </Link>
    );
}
