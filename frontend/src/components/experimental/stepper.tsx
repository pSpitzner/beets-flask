import { FolderIcon, ImportIcon, TagIcon } from "lucide-react";
import { Box, Step, StepLabel, Stepper, styled } from "@mui/material";
import StepConnector, { stepConnectorClasses } from "@mui/material/StepConnector";
import { StepIconProps } from "@mui/material/StepIcon";

const ColorlibConnector = styled(StepConnector)(({ theme }) => ({
    [`&.${stepConnectorClasses.alternativeLabel}`]: {
        top: 19,
    },
    [`&.${stepConnectorClasses.active}`]: {
        [`& .${stepConnectorClasses.line}`]: {
            backgroundImage: `linear-gradient( 95deg,${theme.palette.secondary.muted} 0%, ${theme.palette.secondary.main} 100%)`,
        },
    },
    [`&.${stepConnectorClasses.completed}`]: {
        [`& .${stepConnectorClasses.line}`]: {
            backgroundImage: `linear-gradient( 95deg, ${theme.palette.secondary.muted} 0%,  ${theme.palette.secondary.muted} 100%)`,
        },
    },
    [`& .${stepConnectorClasses.line}`]: {
        height: 3,
        border: 0,
        backgroundColor: "#eaeaf0",
        borderRadius: 1,
        ...theme.applyStyles("dark", {
            backgroundColor: theme.palette.grey[800],
        }),
    },
}));

const ColorlibStepIconRoot = styled(Box)<{
    ownerState: { completed?: boolean; active?: boolean };
}>(({ theme }) => ({
    backgroundColor: "#ccc",
    zIndex: 1,
    color: theme.palette.common.white,
    width: 40,
    height: 40,
    display: "flex",
    borderRadius: "50%",
    justifyContent: "center",
    alignItems: "center",

    ...theme.applyStyles("dark", {
        backgroundColor: theme.palette.grey[700],
    }),
    variants: [
        {
            props: ({ ownerState }) => ownerState.active,
            style: {
                backgroundImage: `linear-gradient( 136deg,${theme.palette.secondary.main} 0%, ${theme.palette.secondary.main} 100%)`,
                boxShadow: "0 4px 10px 0 rgba(0,0,0,.25)",
            },
        },
        {
            props: ({ ownerState }) => ownerState.completed,
            style: {
                backgroundImage: `linear-gradient( 95deg, ${theme.palette.secondary.muted} 0%,  ${theme.palette.secondary.muted} 100%)`,
            },
        },
    ],
}));

function ColorlibStepIcon(props: StepIconProps) {
    const { active, completed, className } = props;

    return (
        <ColorlibStepIconRoot ownerState={{ completed, active }} className={className}>
            {props.icon}
        </ColorlibStepIconRoot>
    );
}

export function SessionStepper({ step }: { step: "preview" | "import" }) {
    const options = [
        {
            label: "Created",
            icon: <FolderIcon />,
        },
        {
            label: "Tagged",
            icon: <TagIcon />,
        },
        {
            label: "Imported",
            icon: <ImportIcon />,
        },
    ];

    return (
        <Stepper
            alternativeLabel
            activeStep={step === "preview" ? 1 : 2}
            connector={<ColorlibConnector />}
            sx={{
                width: "100%",

                ".MuiStep-alternativeLabel:nth-of-type(1)": {
                    flexGrow: 0.5,
                    paddingLeft: 0,
                    "& > * ": {
                        "& > *": {
                            display: "flex",
                        },
                        justifyContent: "flex-start",
                        alignItems: "flex-start",
                        flexShrink: 1,
                    },
                },

                ".MuiStep-alternativeLabel:nth-of-type(3)": {
                    flexGrow: 0.5,
                    paddingRight: 0,
                    "& > * ": {
                        "& > *": {
                            display: "flex",
                            width: "auto",
                        },
                        justifyContent: "flex-end",
                        alignItems: "flex-end",
                        flexShrink: 1,
                    },
                    ".MuiStepConnector-root": {
                        width: "calc(200% - 20px)",
                        left: "-100%",
                    },
                },

                ".MuiStepLabel-label": {
                    marginTop: 0.75,
                    "&.Mui-completed": {
                        color: "secondary.muted",
                    },
                    "&.Mui-active": {
                        color: "secondary.main",
                    },
                },
            }}
        >
            {options.map(({ label, icon }) => (
                <Step key={label}>
                    <StepLabel
                        slots={{
                            stepIcon: ColorlibStepIcon,
                        }}
                        icon={icon}
                    >
                        {label}
                    </StepLabel>
                </Step>
            ))}
        </Stepper>
    );
}
