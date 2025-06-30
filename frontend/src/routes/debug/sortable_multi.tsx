import { useCallback, useRef, useState } from "react";
import {
    closestCenter,
    DndContext,
    DragEndEvent,
    DragOverEvent,
    DragOverlay,
    KeyboardSensor,
    PointerSensor,
    UniqueIdentifier,
    useDroppable,
    useSensor,
    useSensors,
} from "@dnd-kit/core";
import {
    AnimateLayoutChanges,
    arrayMove,
    defaultAnimateLayoutChanges,
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Box, BoxProps, Typography } from "@mui/material";
import { createFileRoute } from "@tanstack/react-router";

import { PageWrapper } from "@/components/common/page";

export const Route = createFileRoute("/debug/sortable_multi")({
    component: RouteComponent,
});

function RouteComponent() {
    const [items, setItems] = useState<Record<string, UniqueIdentifier[]>>({
        all: ["foo"],
        primary: ["item-1", "item-2", "item-3", "item-4"],
        secondary: ["item-5", "item-6", "item-7"],
    });
    // Keep track of items after move to a new container
    const itemsBeforeDrag = useRef<null | Record<string, UniqueIdentifier[]>>(null);
    // State to keep track of currently active (being dragged) item
    const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);

    // Function to find which container an item belongs to
    const findContainer = useCallback(
        (id: UniqueIdentifier) => {
            // if the id is a container id itself
            if (id in items) return id;

            // find the container by looking into each of them
            return Object.keys(items).find((containerId) =>
                items[containerId].includes(id)
            );
        },
        [items]
    );

    // Allto use pointers and keyboard sensors for drag and drop
    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    // Function called when an item is dragged over another container
    // allows to move items between containers (e.g. between primary and secondary)
    const handleDragOver = useCallback(
        ({ active, over }: DragOverEvent) => {
            if (!over || active.id in items) {
                // Early return if no over item or if the active item is a container
                return;
            }

            const { id: activeId } = active;
            const { id: overId } = over;

            const activeContainer = findContainer(activeId);
            const overContainer = findContainer(overId);

            if (!overContainer || !activeContainer) {
                // No valid container found, do nothing
                return;
            }

            if (activeContainer !== overContainer) {
                setItems((pItems) => {
                    const activeItems = pItems[activeContainer];
                    const overItems = pItems[overContainer];
                    const overIndex = overItems.indexOf(overId);
                    const activeIndex = activeItems.indexOf(activeId);

                    const isBelowOverItem =
                        over &&
                        active.rect.current.translated &&
                        active.rect.current.translated.top >
                            over.rect.top + over.rect.height;

                    const modifier = isBelowOverItem ? 1 : 0;

                    const newIndex =
                        overIndex >= 0 ? overIndex + modifier : overItems.length + 1;

                    //recentlyMovedToNewContainer.current = true;

                    return {
                        ...pItems,
                        [activeContainer]: pItems[activeContainer].filter(
                            (item) => item !== active.id
                        ),
                        [overContainer]: [
                            ...pItems[overContainer].slice(0, newIndex),
                            pItems[activeContainer][activeIndex],
                            ...pItems[overContainer].slice(
                                newIndex,
                                pItems[overContainer].length
                            ),
                        ],
                    };
                });
            }
        },
        [findContainer, items]
    );

    const handleDragStart = useCallback(
        ({ active }: { active: { id: UniqueIdentifier } }) => {
            // Store the items before the drag starts
            itemsBeforeDrag.current = structuredClone(items);
            setActiveId(active.id);
        },
        [items]
    );

    const handleDragEnd = useCallback(
        ({ active, over }: DragEndEvent) => {
            const activeContainer = findContainer(active.id);
            if (!over || !activeContainer) {
                setActiveId(null);
                return;
            }

            const { id: activeId } = active;
            const { id: overId } = over;

            const overContainer = findContainer(overId);

            if (!overContainer) {
                setActiveId(null);
                return;
            }

            const activeIndex = items[activeContainer].indexOf(activeId);
            const overIndex = items[overContainer].indexOf(overId);

            if (activeIndex !== overIndex) {
                setItems((pItems) => ({
                    ...pItems,
                    [overContainer]: arrayMove(
                        pItems[overContainer],
                        activeIndex,
                        overIndex
                    ),
                }));
            }
            setActiveId(null);
        },
        [items, findContainer]
    );

    const handleDragCancel = useCallback(() => {
        // Reset items to their state before the drag started
        if (itemsBeforeDrag.current) {
            setItems(itemsBeforeDrag.current);
        }
        setActiveId(null);
    }, []);

    return (
        <PageWrapper>
            <Typography variant="h4" component="h1">
                Drag and Drop / Sortable List Playground
            </Typography>
            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
                onDragOver={handleDragOver}
                onDragStart={handleDragStart}
                onDragCancel={handleDragCancel}
            >
                {Object.entries(items).map(([containerId, containerItems]) => (
                    <DroppableContainer
                        key={containerId}
                        id={containerId}
                        sx={{
                            borderColor: "red",
                        }}
                    >
                        <SortableContext
                            items={containerItems}
                            strategy={verticalListSortingStrategy}
                        >
                            {containerItems.map((id) => (
                                <SortableItem key={id} id={id} />
                            ))}
                        </SortableContext>
                    </DroppableContainer>
                ))}
                <DragOverlay>
                    {activeId ? <SortableItem id={String(activeId)} /> : null}
                </DragOverlay>
            </DndContext>
        </PageWrapper>
    );
}

function SortableItem({ id }: { id: UniqueIdentifier }) {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
        id,
    });

    const style = transform
        ? {
              transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
              transition,
          }
        : undefined;

    return (
        <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
            Item {id}
        </div>
    );
}

const animateLayoutChanges: AnimateLayoutChanges = (args) =>
    defaultAnimateLayoutChanges({ ...args, wasDragging: true });

function DroppableContainer({ id, children, sx }: BoxProps & { id: UniqueIdentifier }) {
    const { setNodeRef } = useDroppable({
        id,
    });

    return (
        <Box
            ref={setNodeRef}
            sx={[
                {
                    display: "flex",
                    flexDirection: "column",
                    gap: 2,
                    padding: 2,
                    border: "1px solid black",
                },
                // @ts-expect-error asd
                ...(Array.isArray(sx) ? sx : ([sx] as BoxProps["sx"])),
            ]}
        >
            {children}
        </Box>
    );
}
