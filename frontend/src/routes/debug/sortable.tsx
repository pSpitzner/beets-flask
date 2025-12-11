import { useState } from 'react';
import {
    closestCenter,
    DndContext,
    DragEndEvent,
    DragOverlay,
    KeyboardSensor,
    PointerSensor,
    UniqueIdentifier,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import {
    arrayMove,
    horizontalListSortingStrategy,
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
} from '@dnd-kit/sortable';
import { Box, Typography } from '@mui/material';
import { createFileRoute } from '@tanstack/react-router';

import { PageWrapper } from '@/components/common/page';

export const Route = createFileRoute('/debug/sortable')({
    component: RouteComponent,
});

function RouteComponent() {
    const [items, setItems] = useState(['A', 'B', 'C', 'D', 'E']);
    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    return (
        <PageWrapper>
            <Typography variant="h4" component="h1">
                An example of a sortable list
            </Typography>
            <Box
                sx={{
                    display: 'flex',
                    gap: 2,
                    border: '1px solid green',
                    '> *': {
                        padding: 2,
                        border: '1px solid red',
                    },
                }}
            >
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                >
                    <SortableContext
                        items={items}
                        strategy={horizontalListSortingStrategy}
                    >
                        {items.map((id) => (
                            <SortableItem key={id} id={id} />
                        ))}
                    </SortableContext>
                    <DragOverlay>Hover</DragOverlay>
                </DndContext>
            </Box>
        </PageWrapper>
    );

    function handleDragEnd(event: DragEndEvent) {
        const { active, over } = event;

        if (!over) {
            return;
        }

        if (active.id !== over?.id) {
            setItems((items) => {
                const oldIndex = items.indexOf(active.id as string);
                const newIndex = items.indexOf(over.id as string);

                return arrayMove(items, oldIndex, newIndex);
            });
        }
    }
}

function SortableItem({ id }: { id: UniqueIdentifier }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({
        id,
    });

    const style = transform
        ? {
              transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
              transition,
              opacity: isDragging ? 0.5 : 1,
          }
        : undefined;

    return (
        <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
            Item {id}
        </div>
    );
}
