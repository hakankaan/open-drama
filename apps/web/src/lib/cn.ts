type ClassValue = string | false | null | undefined | 0;

/** Joins truthy class names. */
export const cn = (...classes: ClassValue[]) => classes.filter(Boolean).join(' ');
