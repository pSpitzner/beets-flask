import { Box, Paper, Typography } from '@mui/material';

import { useConfig } from '@/api/config';
import { Folder } from '@/pythonTypes';

export function FolderComponent({ folder }: { folder: Folder }) {
    console.log(folder);

    const pathHeader = (
        <Box
            sx={{
                display: 'flex',
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                width: '100%',
                padding: '0.5rem',
                position: 'sticky',
                top: '0',
                zIndex: 1,
            }}
            className="DefaultBlurBg"
        >
            <PathBreadcrumbs folder={folder} />
        </Box>
    );

    const dummyContent = (
        <Box
            sx={{
                // scrollSnapAlign: "start", // Ensure each section snaps to the start
                padding: '0.5rem',
            }}
        >
            <Paper>
                <Typography variant="body1" sx={{ padding: '1rem' }}>
                    Lorem ipsum dolor sit amet, consectetur adipisicing elit.
                    Consequuntur totam cumque quaerat, quos quia maxime corporis
                    dignissimos tenetur natus consectetur repellat provident
                    ipsa nam accusamus et labore sequi praesentium expedita
                    nobis, dicta cum voluptate. Nam necessitatibus aliquid
                    laboriosam, cum accusantium recusandae eveniet aspernatur
                    blanditiis deserunt maxime adipisci natus praesentium
                    obcaecati.
                </Typography>
            </Paper>
        </Box>
    );

    return (
        <Box
            sx={{
                scrollSnapAlign: 'start',
            }}
        >
            {pathHeader}
            {dummyContent}
        </Box>
    );
}

export function PathBreadcrumbs({ folder }: { folder: Folder }) {
    const config = useConfig();

    const inboxes = config.gui.inbox.folders;

    let full_path = folder.full_path;
    full_path = full_path.startsWith('/') ? full_path.slice(1) : full_path;

    // do we want to start at the inbox?
    let root_name = '';
    let root_path = '';
    for (const inbox of Object.values(inboxes)) {
        let i_path = inbox.path;
        i_path = i_path.startsWith('/') ? i_path.slice(1) : i_path;
        if (folder.full_path.startsWith(i_path)) {
            root_name = inbox.name;
            root_path = inbox.path;
            break;
        }
    }

    const path = full_path.slice(root_path.length).split('/');
    if (path.length > 0 && path[0] === '') {
        path.shift();
    }
    console.log('Breadcrump path', path);

    // start with inbox name
    const items = [
        <BreadCrumbItem
            key="inbox"
            name={root_name}
            isFirst={true}
            isLast={path.length === 0}
        />,
        ...path.map((name, i) => (
            <BreadCrumbItem
                key={i}
                name={name}
                isLast={i === path.length - 1}
            />
        )),
    ];

    return (
        <Box
            sx={{
                display: 'flex',
                gap: 0.0,
                rowGap: 0.8,
                flexWrap: 'wrap',
                // we want every row except the first to be indented,
                // -> negative margin on first item
                marginLeft: '1.0rem',
            }}
        >
            {items}
        </Box>
    );
}

function BreadCrumbItem({
    name,
    isFirst,
    isLast,
}: {
    name: string;
    isFirst?: boolean;
    isLast?: boolean;
}) {
    return (
        <Box
            sx={{
                background: isLast ? '#7FFFD5' : '#444',
                flexShrink: 0,
                color: isLast ? '#000' : '#FFF',
                outline: 'none',
                position: 'relative',
                marginLeft: isFirst ? '-1.0rem' : 0,
                textDecoration: 'none',
                // polygon coordinates clockwise, starting top right
                clipPath: isFirst
                    ? `polygon(
                    calc(100% - 8px) 0%,
                    100% 50%,
                    calc(100% - 8px) 100%,
                    0% 100%,
                    0% 0%
                )`
                    : `polygon(
                    calc(100% - 8px) 0%,
                    100% 50%,
                    calc(100% - 8px) 100%,
                    0% 100%,
                    calc(0% + 8px) 50%,
                    0% 0%
                )`,
            }}
        >
            <Box
                sx={{
                    paddingX: 1.5,
                    paddingY: 0.1,
                }}
            >
                <Typography variant="body1">{name}</Typography>
            </Box>
        </Box>
    );
}
