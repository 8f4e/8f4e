export default function compareObject(obj1: Record<string, number>, obj2: Record<string, number>): boolean {
	const keys1 = Object.keys(obj1);
	const keys2 = Object.keys(obj2);

	if (keys1.length !== keys2.length) {
		return false;
	}

	for (const key of keys1) {
		if (obj2[key] !== obj1[key]) {
			return false;
		}
	}

	return true;
}
