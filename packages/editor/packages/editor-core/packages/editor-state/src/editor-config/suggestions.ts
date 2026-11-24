function levenshteinDistance(left: string, right: string): number {
	if (left === right) {
		return 0;
	}

	if (left.length === 0) {
		return right.length;
	}

	if (right.length === 0) {
		return left.length;
	}

	const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
	const current = new Array<number>(right.length + 1);

	for (let leftIndex = 0; leftIndex < left.length; leftIndex++) {
		current[0] = leftIndex + 1;

		for (let rightIndex = 0; rightIndex < right.length; rightIndex++) {
			const substitutionCost = left[leftIndex] === right[rightIndex] ? 0 : 1;
			current[rightIndex + 1] = Math.min(
				current[rightIndex] + 1,
				previous[rightIndex + 1] + 1,
				previous[rightIndex] + substitutionCost
			);
		}

		for (let column = 0; column < previous.length; column++) {
			previous[column] = current[column]!;
		}
	}

	return previous[right.length]!;
}

function getSuggestionThreshold(value: string): number {
	if (value.length <= 4) {
		return 1;
	}

	if (value.length <= 8) {
		return 2;
	}

	return Math.max(3, Math.floor(value.length * 0.3));
}

export function getDidYouMeanSuggestion(value: string, candidates: readonly string[]): string | undefined {
	const normalizedValue = value.trim().toLowerCase();
	if (!normalizedValue) {
		return undefined;
	}

	const prefixMatches = candidates.filter(candidate => candidate.toLowerCase().startsWith(normalizedValue));
	if (prefixMatches.length > 0) {
		return [...prefixMatches].sort((left, right) => left.length - right.length || left.localeCompare(right))[0];
	}

	const substringMatches = candidates.filter(candidate => candidate.toLowerCase().includes(normalizedValue));
	if (substringMatches.length > 0) {
		return [...substringMatches].sort((left, right) => left.length - right.length || left.localeCompare(right))[0];
	}

	let bestCandidate: string | undefined;
	let bestDistance = Number.POSITIVE_INFINITY;
	let bestPrefixScore = -1;

	for (const candidate of candidates) {
		const normalizedCandidate = candidate.toLowerCase();
		const distance = levenshteinDistance(normalizedValue, normalizedCandidate);
		const prefixScore = normalizedCandidate.startsWith(normalizedValue)
			? normalizedValue.length
			: normalizedValue.startsWith(normalizedCandidate)
				? normalizedCandidate.length
				: 0;

		if (distance < bestDistance || (distance === bestDistance && prefixScore > bestPrefixScore)) {
			bestCandidate = candidate;
			bestDistance = distance;
			bestPrefixScore = prefixScore;
		}
	}

	if (!bestCandidate) {
		return undefined;
	}

	return bestDistance <= getSuggestionThreshold(normalizedValue) ? bestCandidate : undefined;
}

export function formatDidYouMeanSuffix(value: string, candidates: readonly string[]): string {
	const suggestion = getDidYouMeanSuggestion(value, candidates);
	return suggestion ? ` Did you mean '${suggestion}'?` : '';
}
