import { RowComponentProps } from 'react-window';
import { Box, Typography, useTheme } from '@mui/material';
import { Link } from '@tanstack/react-router';

import { CoverArt } from '@/components/library/coverArt';
import { AlbumResponseMinimal } from '@/pythonTypes';

import { LoadingCell, LoadingRow } from './loading';

import { AlbumIcon } from '../icons';

/** Props for the album browser components */
export interface AlbumBrowserProps {
    albums: Array<AlbumResponseMinimal>;
    showArt?: boolean;
    showArtist?: boolean;
    showYear?: boolean;
}

/** Row component for album list view */
export function AlbumListRow({
    albums,
    index,
    style,
    showArt = false,
    showArtist = true,
    showYear = true,
}: RowComponentProps<AlbumBrowserProps>) {
    const theme = useTheme();
    const album = albums.at(index);
    if (!album) {
        return <LoadingRow style={style} icon="album" />;
    }

    return (
        <Link
            to={`/library/album/$albumId`}
            key={album.id}
            params={{ albumId: album.id }}
            style={style}
        >
            <Box
                sx={(theme) => ({
                    height: style.height,
                    display: 'flex',
                    alignItems: 'center',
                    paddingInline: 1,
                    justifyContent: 'space-between',
                    ':hover': {
                        background: `linear-gradient(to left, transparent 0%, ${theme.palette.primary.muted} 100%)`,
                        color: 'primary.contrastText',
                    },
                })}
            >
                {showArt && (
                    <CoverArt
                        type="album"
                        beetsId={album.id}
                        size="small"
                        sx={{
                            display: 'block',
                            width: '50px',
                            height: '50px',
                            padding: 0.5,
                        }}
                    />
                )}

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
                        {album.name || 'Unknown Title'}{' '}
                        {showYear && !showArtist ? `(${album.year})` : ''}
                    </Typography>
                    {showArtist && (
                        <Typography variant="body2" color="text.secondary">
                            {album.albumartist}{' '}
                            {showYear ? `(${album.year})` : ''}
                        </Typography>
                    )}
                </Box>
                <AlbumIcon color={theme.palette.background.paper} />
            </Box>
        </Link>
    );
}

/** Grid cell component for album grid view */
export function AlbumGridCell({
    albums,
    index,
    style,
}: RowComponentProps<AlbumBrowserProps>) {
    const album = albums.at(index);
    if (!album) {
        return <LoadingCell style={style} />;
    }
    return (
        <Link
            to={`/library/album/$albumId`}
            key={album.id}
            params={{ albumId: album.id }}
            style={style}
        >
            <Box
                sx={{
                    width: style.width,
                    height: style.height,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 1,
                    textAlign: 'center',
                    ':hover': {
                        backgroundColor: 'primary.muted',
                        color: 'primary.contrastText',
                    },
                }}
            >
                <CoverArt
                    type="album"
                    beetsId={album.id}
                    sx={{
                        maxWidth: '100%',
                        maxHeight: '100%',
                        width: '200px',
                        height: '200px',
                        m: 0,
                    }}
                />
            </Box>
        </Link>
    );
}
