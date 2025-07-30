import {
    EyeIcon,
    EyeOffIcon,
    InfoIcon,
    RotateCcwIcon,
    SquareChartGanttIcon,
} from "lucide-react";
import { useCallback, useState } from "react";
import {
    closestCenter,
    DndContext,
    DragCancelEvent,
    DragEndEvent,
    DragOverEvent,
    DragOverlay,
    KeyboardSensor,
    PointerSensor,
    UniqueIdentifier,
    useSensor,
    useSensors,
} from "@dnd-kit/core";
import {
    arrayMove,
    horizontalListSortingStrategy,
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
} from "@dnd-kit/sortable";
import {
    Box,
    BoxProps,
    Checkbox,
    IconButton,
    Typography,
    useTheme,
} from "@mui/material";

import {
    DEFAULT_INBOX_FOLDER_FRONTEND_CONFIG,
    GridColumn,
    type InboxFolderFrontendConfig,
} from "@/api/config";
import { File, Folder } from "@/pythonTypes";

import { StyledChip } from "../../common/chips";
import { FileComponent, FolderTreeRow } from "../fileTree";

/** Use drag and drop to
 * sort the columns in the grid template.
 *
 * Uses dnd-kit for drag and drop functionality as creating
 * the full capability from scratch is quite much work.
 */
export function GridTemplateSettings({
    gridTemplateColumns,
    setGridTemplateColumns,
}: {
    gridTemplateColumns: InboxFolderFrontendConfig["gridTemplateColumns"];
    setGridTemplateColumns: (
        cols: InboxFolderFrontendConfig["gridTemplateColumns"]
    ) => void;
}) {
    const items = gridTemplateColumns.map((col) => col.name) as string[];
    const [active, setActive] = useState<UniqueIdentifier | null>(null);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 5, // Minimum distance to start dragging
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragEnd = useCallback(
        ({ active, over }: DragEndEvent) => {
            const activeId = active.id as string;
            const overId = over?.id as string;

            setActive(null);

            if (!overId) return;

            if (activeId !== overId) {
                setGridTemplateColumns(
                    arrayMove(
                        gridTemplateColumns,
                        items.indexOf(activeId),
                        items.indexOf(overId)
                    )
                );
            }
        },
        [gridTemplateColumns, items, setGridTemplateColumns]
    );
    const handleDragStart = useCallback(({ active }: DragOverEvent) => {
        setActive(active.id);
    }, []);
    const handleDragCancel = useCallback((e: DragCancelEvent) => {
        setActive(null);
        console.debug("Drag cancelled", e);
    }, []);

    return (
        <Box
            sx={{
                width: "100%",
                display: "flex",
                flexDirection: "column",
            }}
        >
            <Typography
                variant="h6"
                sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                }}
                gutterBottom
            >
                Grid template columns
                <IconButton>
                    <RotateCcwIcon
                        size={16}
                        onClick={() =>
                            setGridTemplateColumns(
                                DEFAULT_INBOX_FOLDER_FRONTEND_CONFIG.gridTemplateColumns
                            )
                        }
                    />
                </IconButton>
            </Typography>
            <Typography variant="body2" color="text.secondary">
                Change the order of the columns in the grid. The first column is always
                the selector, the last one is the actions.
            </Typography>

            <Box
                display="flex"
                gap={1}
                width="100%"
                sx={(theme) => ({
                    paddingBlock: 1,
                    [theme.breakpoints.down("tablet")]: {
                        flexWrap: "wrap",
                    },
                })}
            >
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                    onDragStart={handleDragStart}
                    onDragCancel={handleDragCancel}
                >
                    <SortableContext
                        items={items}
                        strategy={horizontalListSortingStrategy}
                    >
                        {gridTemplateColumns.map((col) => (
                            <SortableItem
                                id={col.name}
                                key={col.name}
                                sx={{
                                    display: "flex",
                                    paddingBlock: 1,
                                    paddingInline: 1,
                                    border: "2px dashed gray",
                                    flexDirection: "row",
                                    flexGrow: col.name === "tree" ? 1 : 0,
                                    justifyContent: "center",
                                    alignItems: "center",
                                    gap: 1,
                                }}
                            >
                                <Box sx={{ flexGrow: 1 }} color="gray">
                                    <ExampleCol key={col.name} name={col.name} />
                                </Box>
                                <IconButton
                                    size="small"
                                    sx={{
                                        color: "default",
                                        m: 0,
                                        p: 0,
                                    }}
                                    onClick={() => {
                                        setGridTemplateColumns(
                                            gridTemplateColumns.map((c) =>
                                                c.name === col.name
                                                    ? {
                                                          ...c,
                                                          hidden: !c.hidden,
                                                      }
                                                    : c
                                            )
                                        );
                                    }}
                                    title="Toggle visibility of this column"
                                >
                                    {col.hidden ? (
                                        <EyeOffIcon size={18} />
                                    ) : (
                                        <EyeIcon size={18} />
                                    )}
                                </IconButton>
                            </SortableItem>
                        ))}
                    </SortableContext>
                    <DragOverlay>
                        {active && (
                            <Box
                                sx={{
                                    border: "2px dashed",
                                    borderColor: "secondary.muted",
                                    padding: 1,
                                    display: "flex",
                                    flexDirection: "column",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    minHeight: 52, // A bit of a hack to ensure the overlay has the same height as the items
                                    position: "relative",
                                }}
                            >
                                <ExampleCol name={active as GridColumn["name"]} />
                            </Box>
                        )}
                    </DragOverlay>
                </DndContext>
            </Box>
        </Box>
    );
}

function SortableItem({
    id,
    children,
    sx,
    ...props
}: { id: UniqueIdentifier } & BoxProps) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
        useSortable({
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
        <Box
            ref={setNodeRef}
            sx={[
                style,
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                ...(Array.isArray(sx) ? sx : [sx]),
            ]}
            {...attributes}
            {...listeners}
            {...props}
        >
            {children}
        </Box>
    );
}

const dummyFolder = {
    full_path: "Folder",
    hash: "",
    is_album: false,
    children: [
        {
            type: "file",
            full_path: "legally acquired bootleg.mp3",
        } as File,
    ],
    type: "directory",
} as Folder;

// This shows an example of how to render a column in the grid template.
function ExampleCol({ name }: { name: GridColumn["name"] }) {
    const theme = useTheme();
    const [expanded, setExpanded] = useState(false);

    switch (name) {
        case "selector":
            return (
                <Checkbox
                    size="medium"
                    checked={expanded}
                    onChange={() => setExpanded(!expanded)}
                    sx={{ m: 0, p: 0 }}
                    disabled
                />
            );
        case "tree":
            return (
                <>
                    <FolderTreeRow
                        folder={dummyFolder}
                        isOpen={expanded}
                        setIsOpen={setExpanded}
                        sx={{
                            width: "100%",
                            display: "flex",
                            alignItems: "center",
                        }}
                    />
                    {expanded && (
                        <FileComponent
                            file={dummyFolder.children[0]}
                            level={1}
                        />
                    )}
                </>
            );
        case "chip":
            return (
                <StyledChip
                    icon={<InfoIcon size={theme.iconSize.sm} />}
                    label="chip"
                    size="small"
                    variant="outlined"
                    color="info"
                />
            );
        case "actions":
            return (
                <IconButton
                    sx={{
                        color: "text.secondary",
                    }}
                >
                    <SquareChartGanttIcon size={16} />
                </IconButton>
            );
    }

    return null;
}
