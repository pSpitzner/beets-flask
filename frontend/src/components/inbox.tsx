import { FileScan, Inbox, Recycle, Trash2 } from "lucide-react";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import { Button, CardActions, Divider } from "@mui/material";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
export function InboxOverview() {
    return (
        <Card
            sx={{
                borderRadius: "12px",
                minWidth: 256,
                textAlign: "center",
                boxShadow:
                    "0 2px 4px -2px rgba(0,0,0,0.24), 0 4px 24px -2px rgba(0, 0, 0, 0.2)",
            }}
        >
            <CardContent className="flex flex-row space-x-4 justify-center relative">
                <label className="absolute top-0 right-0 text-xs p-1 text-main">
                    Last scan: 2 days ago
                </label>
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
                <div className="flex flex-col justify-center items-center pt-4">
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
                <div>
                    <Button color="error">
                        <Trash2 size="1.5em" />
                    </Button>
                </div>
                <div className="flex flex-row space-x-4">
                    <Button color="warning">
                        <Recycle size="1.5em" />
                    </Button>
                    <Button>
                        <FileScan size="1.5em" />
                    </Button>
                </div>
            </CardActions>
        </Card>
    );
}
