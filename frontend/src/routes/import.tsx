import { createFileRoute } from '@tanstack/react-router'

import { useImportSocket } from '@/components/common/useSocket'
import { Button, Typography } from '@mui/material';

export const Route = createFileRoute('/import')({
  component: ImportView,
})

function ImportView() {

    const { socket, isConnected } = useImportSocket();

    return (
        <>
            <Typography>{isConnected}</Typography>
            <Button>1</Button>
        </>
    );
}
