import { FileScan, FolderClock, Inbox, Recycle, Trash2 } from "lucide-react";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardActions from "@mui/material/CardActions";
import Divider from "@mui/material/Divider";
import Tooltip from "@mui/material/Tooltip";
import IconButton from "@mui/material/IconButton";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import { IconButtonWithMutation } from "./common/buttons";
import { Link } from "@tanstack/react-router";

export function InboxStatsOverview() {
    return (
        <Card
            sx={{
                borderRadius: "12px",
                minWidth: 256,
                textAlign: "center",
                boxShadow:
                    "0 2px 4px -2px rgba(0,0,0,0.24), 0 4px 24px -2px rgba(0, 0, 0, 0.2)",
                overflow: "visible",
            }}
        >
            <CardContent className="flex flex-row space-x-4 justify-center relative overflow-visible">
                <div
                    className="absolute top-0 right-0 flex flex-row space-x-1 overflow-visible justify-center items-center p-1
                "
                >
                    <label className="text-xs p-1">Last scan: 2 days ago</label>
                    <Tooltip title="Schedule inbox scans">
                        <div>
                            <Link to="/schedule">
                                <IconButton>
                                    <FolderClock size="1rem" strokeWidth={1} />
                                </IconButton>
                            </Link>
                        </div>
                    </Tooltip>
                </div>
                <div>
                    <Avatar
                        sx={{
                            width: 60,
                            height: 60,
                            margin: "auto",
                            backgroundColor: "transparent",
                            color: "primary.main",
                        }}
                        variant="rounded"
                    >
                        <Inbox size="100%" />
                    </Avatar>
                    <Box
                        component="h3"
                        sx={{
                            fontSize: 18,
                            fontWeight: "bold",
                            letterSpacing: "0.5px",
                            marginTop: 1,
                            marginBottom: 0,
                        }}
                    >
                        Inbox
                    </Box>
                    <Box
                        component="code"
                        sx={{
                            fontSize: 14,
                            color: "grey.500",
                            marginBottom: "0.875em",
                        }}
                    >
                        /my/mount/point
                    </Box>
                </div>
                <div className="flex flex-col justify-end">
                    <table className="table-info text-gray-100 text-sm">
                        <thead>
                            <tr>
                                <th>
                                    <span>New</span>
                                </th>
                                <th>
                                    <span>Tagged</span>
                                </th>
                                <th>Total</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>1000</td>
                                <td>50</td>
                                <td>1050</td>
                                <td>files</td>
                            </tr>
                            <tr>
                                <td>10 </td>
                                <td>0.5 </td>
                                <td>10.5 </td>
                                <td>gb</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </CardContent>
            <Divider />
            <CardActions className="flex justify-between items-center space-x-4 w-100">
                <Tooltip title="Delete all files in the inbox">
                    <div>
                        <IconButtonWithMutation color="error">
                            <Trash2 size="1em" />
                        </IconButtonWithMutation>
                    </div>
                </Tooltip>
                <div className="flex flex-row space-x-4">
                    <Tooltip title="Delete all already tagged files in the inbox">
                        <div>
                            <IconButtonWithMutation color="warning">
                                <Recycle size="1em" />
                            </IconButtonWithMutation>
                        </div>
                    </Tooltip>
                    <Tooltip title="Scan the inbox folder for new files">
                        <div>
                            <IconButtonWithMutation color="primary">
                                <FileScan size="1em" />
                            </IconButtonWithMutation>
                        </div>
                    </Tooltip>
                </div>
            </CardActions>
        </Card>
    );
}
