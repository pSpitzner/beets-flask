import { GridIcon, ListIcon } from 'lucide-react';
import {
    ToggleButton,
    ToggleButtonGroup,
    ToggleButtonGroupProps,
    useTheme,
} from '@mui/material';

export interface ViewToggleProps extends ToggleButtonGroupProps {
    view: 'list' | 'grid';
    setView: (view: 'list' | 'grid') => void;
}

/**
 * A toggle button group to switch between list and grid view.
 */
export function ViewToggle({ view, setView, ...props }: ViewToggleProps) {
    const theme = useTheme();
    return (
        <ToggleButtonGroup
            value={view}
            onChange={(
                _e: React.MouseEvent<HTMLElement>,
                v: 'list' | 'grid' | null
            ) => {
                if (v) {
                    setView(v);
                }
            }}
            exclusive
            color="primary"
            aria-label="View type"
            {...props}
        >
            <ToggleButton value="list">
                <ListIcon size={theme.iconSize.lg} />
            </ToggleButton>
            <ToggleButton value="grid">
                <GridIcon size={theme.iconSize.lg} />
            </ToggleButton>
        </ToggleButtonGroup>
    );
}
