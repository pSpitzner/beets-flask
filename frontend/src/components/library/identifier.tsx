import { useMemo } from 'react';
import { Fragment } from 'react/jsx-runtime';
import { Box, BoxProps, Link } from '@mui/material';

import { AlbumSource, ItemSource } from '@/pythonTypes';

import { isItemSource, sourceHref, sourceName } from './sources';

import { SourceTypeIcon } from '../common/icons';

/** Component that shows the identifier/sources of an album or item
 * * @param {source} sources
 */
export function Identifiers({
    sources,
    children,
    ...props
}: {
    sources: Array<AlbumSource> | Array<ItemSource>;
} & BoxProps) {
    return (
        <Box {...props}>
            {sources.map((source) => {
                return (
                    <Box>
                        <Box
                            sx={{
                                display: 'flex',
                                flexDirection: 'row',
                                gap: 1,
                                alignItems: 'center',
                                fontWeight: 'bold',
                            }}
                        >
                            <SourceTypeIcon type={source.source} size={20} />
                            {sourceName(source)}
                        </Box>
                        <Identifier source={source} />
                    </Box>
                );
            })}
            {children}
        </Box>
    );
}

type Idents = {
    label: string;
    id: string | Array<string>;
    href: string | Array<string> | undefined;
};

function Identifier({ source }: { source: ItemSource | AlbumSource }) {
    const idents: Array<Idents> = useMemo(() => {
        const idents: Array<Idents> = [];
        if (isItemSource(source)) {
            idents.push({
                label: 'track_id',
                id: source.track_id,
                href: sourceHref(source.source, source.track_id, 'track'),
            });
        }

        if (source.album_id) {
            idents.push({
                label: 'album_id',
                id: source.album_id,
                href: sourceHref(source.source, source.album_id, 'album'),
            });
        }
        if (source.artist_id) {
            idents.push({
                label: 'artist_id',
                id: source.artist_id,
                href: sourceHref(source.source, source.artist_id, 'artist'),
            });
        }
        if (source.extra) {
            for (const [key, value] of Object.entries(source.extra)) {
                idents.push({
                    label: key,
                    id: value,
                    href: sourceHref(
                        source.source,
                        value,
                        key.replace(/_ids?/, '')
                    ),
                });
            }
        }
        return idents;
    }, [source]);

    return (
        <Box
            sx={{
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
                alignItems: 'flex-start',
                paddingLeft: 1,
            }}
        >
            {idents.map((ident) => {
                return (
                    <Fragment key={ident.label}>
                        <label>{ident.label}</label>
                        {Array.isArray(ident.href) &&
                        Array.isArray(ident.id) ? (
                            ident.href.map((href, i) => (
                                <Link key={href} href={href} target="_blank">
                                    {ident.id[i]}
                                </Link>
                            ))
                        ) : (
                            <Link
                                href={(ident.href as string) || ''}
                                target="_blank"
                            >
                                {ident.id as string}
                            </Link>
                        )}
                    </Fragment>
                );
            })}
        </Box>
    );
}
