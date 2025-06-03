import { ImportIcon } from "lucide-react";
import { Box, Typography } from "@mui/material";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { albumQueryOptions } from "@/api/library";
import { Link } from "@/components/common/link";
import { Identifiers } from "@/components/library/identifier";

export const Route = createFileRoute("/library/(resources)/album/$albumId/identifier")({
    component: RouteComponent,
});

function RouteComponent() {
    const params = Route.useParams();
    const { data: album } = useSuspenseQuery(
        albumQueryOptions(params.albumId, true, false)
    );

    return (
        <Box>
            <Typography variant="h6" component="h3">
                Identifier
            </Typography>
            <Box>
                <Identifiers sources={album.sources}>
                    {/* Our custom identifier needs a bit of special handling */}
                    {album.gui_import_id && (
                        <Box>
                            <Box
                                sx={{
                                    display: "flex",
                                    flexDirection: "row",
                                    gap: 1,
                                    alignItems: "center",
                                    fontWeight: "bold",
                                }}
                            >
                                <ImportIcon size={20} /> BeetsFlask
                            </Box>
                            <Box
                                sx={{
                                    display: "flex",
                                    flexDirection: "column",
                                    position: "relative",
                                    alignItems: "flex-start",
                                    paddingLeft: 1,
                                }}
                            >
                                <label>gui_import_id</label>
                                <Link
                                    to="/inbox/task/$taskId"
                                    params={{
                                        taskId: album.gui_import_id,
                                    }}
                                >
                                    {album.gui_import_id}
                                </Link>
                            </Box>
                        </Box>
                    )}
                </Identifiers>
            </Box>
        </Box>
    );
}
