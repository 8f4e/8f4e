import isIntermodularReferencePattern from './isIntermodularReferencePattern';
/** Recognizes an intermodular start-address reference. End queries have their own parser. */
export default function isIntermodularReference(value: string): boolean {
	return isIntermodularReferencePattern(value);
}
