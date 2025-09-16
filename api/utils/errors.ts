// Utilities to safely extract information from unknown errors

export const getErrorMessage = (error: unknown): string => {
	if (error instanceof Error) return error.message;
	if (typeof error === "string") return error;
	try {
		return JSON.stringify(error);
	} catch {
		return String(error);
	}
};

export const getErrorStack = (error: unknown): string | undefined => {
	if (error instanceof Error) return error.stack;
	return undefined;
};


