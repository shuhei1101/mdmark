import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** `clsx` で結んだ class を `tailwind-merge` で重複を除いて返却する */
export const cn = (...inputs: ClassValue[]): string => twMerge(clsx(inputs));
