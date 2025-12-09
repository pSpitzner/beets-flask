import { PauseIcon, PlayIcon } from 'lucide-react';
import { Badge, IconButton, useTheme } from '@mui/material';

import { ItemResponse } from '@/pythonTypes';

import { useAudioContext } from './context';

/** Button to add an item to the audio queue or play it if
 * nothing is currently playing.
 */
export function PlayOrAddItemToQueueButton({ item }: { item: ItemResponse }) {
    const theme = useTheme();
    const { addToQueue, currentItem, togglePlaying, playing } =
        useAudioContext();

    const isCurrentItem = currentItem?.id === item.id;

    return (
        <IconButton
            sx={{
                marginRight: 1,
                color: isCurrentItem ? theme.palette.primary.main : 'inherit',
            }}
            onClick={() => {
                if (isCurrentItem) {
                    togglePlaying();
                    return;
                }

                addToQueue(item, true, true);
            }}
        >
            <Badge
                badgeContent="+"
                color="primary"
                overlap="circular"
                sx={{
                    '& .MuiBadge-badge': {
                        backgroundColor: 'transparent',
                        color: 'inherit',
                    },
                }}
                invisible={!currentItem || isCurrentItem}
            >
                {playing && isCurrentItem ? (
                    <PauseIcon size={theme.iconSize.xl} fill="currentColor" />
                ) : (
                    <PlayIcon size={theme.iconSize.xl} />
                )}
            </Badge>
        </IconButton>
    );
}
