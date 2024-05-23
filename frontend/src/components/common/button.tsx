import React, { lazy, Suspense } from "react";
import { LucideProps } from "lucide-react";
import dynamicIconImports from "lucide-react/dynamicIconImports";
import { Flex, IconButton, IconButtonProps, Text } from "@radix-ui/themes";

const fallback = <div style={{ background: "#ddd", width: 24, height: 24 }} />;

interface IconProps extends Omit<LucideProps, "ref"> {
    name: keyof typeof dynamicIconImports;
}

const Icon = ({ name, ...props }: IconProps) => {
    const LucideIcon = lazy(dynamicIconImports[name]);

    return (
        <Suspense fallback={fallback}>
            <LucideIcon {...props} />
        </Suspense>
    );
};

export function ButtonIconWithText({
    icon,
    text,
    ...props
}: {
    icon: keyof typeof dynamicIconImports;
    text?: React.ReactNode;
} & IconButtonProps) {
    return (
        <Flex direction="column" gap="2" justify="center" align="center">
            <IconButton size="2" {...props}>
                <Icon name={icon} size="100%" className="p-1.5" />
            </IconButton>
            <Text size="1" color="gray">
                {text}
            </Text>
        </Flex>
    );
}
