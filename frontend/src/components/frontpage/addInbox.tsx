import { Plus } from "lucide-react";

import { Card, CardContent, } from "@/components/frontpage/card";

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
                        minHeight: "3rem",
                        minWidth: "3rem"
                    }}
                >
                    <Plus strokeWidth={1} className="w-full h-full" />
                </IconButtonWithMutation>
            </CardContent>
        </Card>
    );
}
