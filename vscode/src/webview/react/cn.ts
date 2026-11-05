import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** shadcn/ui の class の合成 */
export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));
