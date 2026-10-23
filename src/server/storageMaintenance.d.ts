export function verifyDatabase(filename: string): { integrity: string; books: number; notes: number };
export function backupDatabase(directory: string): Promise<{ filename: string; integrity: string; books: number; notes: number }>;
