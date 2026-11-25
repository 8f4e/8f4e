// biome-ignore lint/correctness/noUnusedVariables: State brands paths to the shape they belong to.
export type Path<State> = string & Record<never, never>;

export type PathValue<State, P extends string> = P extends `${infer K}.${infer Rest}`
	? K extends keyof State
		? PathValue<State[K], Rest>
		: unknown
	: P extends keyof State
		? State[P]
		: unknown;

type NonFunction<V> = V extends (...args: never[]) => unknown ? never : V;

export type Matcher<V> = ((value: V) => boolean) | NonFunction<V>;

export type Subscription<State, P extends Path<State> = Path<State>> = {
	selector: P;
	tokens: string[];
	callback: (value: PathValue<State, P>) => void;
	matcher?: Matcher<PathValue<State, P>>;
};
