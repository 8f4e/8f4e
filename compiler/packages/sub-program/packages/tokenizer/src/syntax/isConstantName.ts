/**
 * Determines whether a variable name follows constant naming conventions.
 * A constant name must start with an uppercase ASCII letter (A-Z) and cannot
 * contain lowercase letters - it can only contain uppercase letters, numbers,
 * and special ASCII characters (!, $, _, -, etc.).
 * @param name - The variable name to check.
 * @returns True if the name is a constant name, false otherwise.
 */
export default function isConstantName(name: string): boolean {
	// Must start with uppercase letter and contain no lowercase letters
	return /^[A-Z]/.test(name) && !/[a-z]/.test(name);
}
