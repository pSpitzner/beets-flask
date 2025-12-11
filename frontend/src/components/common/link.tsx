import { Link as MuiLink } from '@mui/material';
import { createLink } from '@tanstack/react-router';

/** Custom link component allows for mui styling but tanstack safety */
export const Link = createLink(MuiLink);
