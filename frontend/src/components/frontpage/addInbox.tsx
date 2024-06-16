import { Card, CardContent, CardActions } from "@/components/common/card";
import { Plus } from "lucide-react";
import { IconButtonWithMutation } from "../common/buttons";

export function AddInbox() {
    return (
        <Card
            sx={{
                padding: 0,
                backgroundColor: "transparent",
                boxShadow: "none",
                backgroundImage: "none",
            }}
        >
            <CardContent className="p-4">
                <IconButtonWithMutation
                    sx={{
                        color: "primary.muted",
                    }}
                >
                    <Plus size="3rem" strokeWidth={1} />
                </IconButtonWithMutation>
            </CardContent>
        </Card>
    );
}
