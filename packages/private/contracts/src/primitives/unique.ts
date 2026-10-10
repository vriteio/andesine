const uniqueItems = <T>(values: T[]): boolean => new Set(values).size === values.length;

export { uniqueItems };
