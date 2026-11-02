export interface SyntaxFonts<T> {
	fontInstruction: T;
	fontCode: T;
	fontCodeComment: T;
	fontNumbers: T;
	fontBinaryZero: T;
	fontBinaryOne: T;
	fontBasePrefix: T;
}

export type SyntaxHighlighting<T> = Array<Array<T | undefined>>;
