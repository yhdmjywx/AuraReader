export function verifyDatabase(filename: string): { integrity: string; books: number; notes: number };
export function backupDatabase(directory: string, destination?: string): Promise<{ filename: string; integrity: string; books: number; notes: number }>;
