import type { ResolvedMemoryTarget } from '@8f4e/editor-state/memory';
import type { CompiledStackAnalysisLine, CompilerASTLine, FunctionDocumentation } from '@8f4e/language-spec';
import type { SelectedLineTooltipContent } from '../types';
import { getSelectedLineTooltipColors } from './colors';
import { TOOLTIP_WRAP_WIDTH } from './constants';
import { getLiveReferenceTooltipContent, getLiveTooltipContent } from './liveValues';
import type { SourceLineDescription } from './sourceLine';
import { getStackAnalysisTooltipContent } from './stackAnalysisTooltip';
import { formatStackSignature, formatStackSignatureLines, resolveStackSignature } from './stackSignature';
import { getMaxLineLength, getTooltipTextCharacters, wrapTooltipText } from './text';

interface SelectedLineTooltipTextContent {
	text: string[];
	signatureLineCount: number;
	stackAnalysisStartLine: number;
	highlightTargets: SelectedLineTooltipContent['highlightTargets'];
}

interface SelectedLineTooltipTextOptions {
	source: SourceLineDescription;
	maxLength?: number;
	stackAnalysisLine?: CompiledStackAnalysisLine;
	parsedLine?: CompilerASTLine;
	functionDocumentation?: FunctionDocumentation;
	moduleExecutionOrder?: number;
}

interface SelectedLineTooltipOptions extends SelectedLineTooltipTextOptions {
	target?: ResolvedMemoryTarget;
}

/** Reads a parameter's own documentation, including names that shadow object properties. */
function getParameterDescription(documentation: FunctionDocumentation, name: string): string | undefined {
	const { parameters } = documentation;
	return parameters && Object.hasOwn(parameters, name) ? parameters[name] : undefined;
}

/** Selects documentation relevant to the current call or function declaration line. */
function getFunctionDocumentationText({
	source,
	parsedLine,
	stackAnalysisLine,
	functionDocumentation: documentation,
}: SelectedLineTooltipTextOptions): string[] {
	if (!documentation) return [];
	const returns = documentation.returns ? [`returns: ${documentation.returns}`] : [];
	switch (source.sourceInstruction?.instruction) {
		case 'call': {
			const call = stackAnalysisLine?.resolvedCall;
			if (!call) return [];
			return [
				...(documentation.description ? [documentation.description] : []),
				...call.signature.parameters.flatMap(({ name }) => {
					const description = getParameterDescription(documentation, name);
					return description ? [`${name}: ${description}`] : [];
				}),
				...returns,
			];
		}
		case 'function':
			return documentation.description ? [documentation.description] : [];
		case 'param': {
			if (parsedLine?.instruction !== 'param') return [];
			const name = parsedLine.arguments[1].value;
			const description = getParameterDescription(documentation, name);
			return description ? [`${name}: ${description}`] : [];
		}
		case 'functionEnd':
			return returns;
		default:
			return [];
	}
}

/**
 * Builds wrapped tooltip text for instruction and function docs and stack analysis.
 */
export function getSelectedLineTooltipTextContent({
	source,
	maxLength = TOOLTIP_WRAP_WIDTH,
	stackAnalysisLine,
	parsedLine,
	functionDocumentation,
	moduleExecutionOrder,
}: SelectedLineTooltipTextOptions): SelectedLineTooltipTextContent {
	if (!source.text) {
		return { text: [], signatureLineCount: 0, stackAnalysisStartLine: 0, highlightTargets: [] };
	}

	const { sourceInstruction } = source;
	const signature = resolveStackSignature({ sourceInstruction, stackAnalysisLine, parsedLine });
	const signatureLines = signature
		? signature.kind === 'call'
			? formatStackSignatureLines({ signature, maxLength })
			: [formatStackSignature(signature)]
		: [];
	const shortDescription = sourceInstruction?.spec.docs?.shortDescription;
	const documentedText = getFunctionDocumentationText({ source, parsedLine, stackAnalysisLine, functionDocumentation });
	const tooltipText: string[] = [];
	const highlightTargets: SelectedLineTooltipContent['highlightTargets'] = [];

	tooltipText.push(...signatureLines);

	if (documentedText.length > 0) {
		tooltipText.push(...documentedText.flatMap(text => wrapTooltipText(text, maxLength)));
	} else if (shortDescription) {
		tooltipText.push(...wrapTooltipText(shortDescription, maxLength));
	}

	if (moduleExecutionOrder !== undefined) {
		tooltipText.push(`execution order: ${moduleExecutionOrder}`);
	}

	const stackAnalysisContent = getStackAnalysisTooltipContent(stackAnalysisLine);
	const stackAnalysisStartLine = tooltipText.length;
	highlightTargets.push(
		...stackAnalysisContent.highlightTargets.map(target => ({
			...target,
			lineIndex: target.lineIndex + tooltipText.length,
		}))
	);
	tooltipText.push(...stackAnalysisContent.text);

	return { text: tooltipText, signatureLineCount: signatureLines.length, stackAnalysisStartLine, highlightTargets };
}

/**
 * Builds wrapped tooltip text for instruction docs and stack analysis.
 */
export function getSelectedLineTooltipText(options: SelectedLineTooltipTextOptions): string[] {
	return getSelectedLineTooltipTextContent(options).text;
}

/**
 * Assembles the complete selected-line tooltip payload consumed by the drawer.
 */
export function getSelectedLineTooltipContent(options: SelectedLineTooltipOptions): SelectedLineTooltipContent {
	const textContent = getSelectedLineTooltipTextContent(options);
	const text = textContent.text;
	const { declaration } = options.source;
	const colors = getSelectedLineTooltipColors(text, textContent.signatureLineCount, textContent.stackAnalysisStartLine);
	const liveTooltipContent =
		declaration?.kind === 'reference'
			? getLiveReferenceTooltipContent(options.target, text.length)
			: getLiveTooltipContent(declaration ? options.target : undefined, text.length);

	text.push(...liveTooltipContent.text);
	colors.push(...liveTooltipContent.colors);

	return {
		text,
		characters: getTooltipTextCharacters(text),
		colors,
		lineCount: text.length,
		widthChars: Math.max(getMaxLineLength(text), liveTooltipContent.maxLineLength),
		highlightTargets: textContent.highlightTargets,
		liveValueTargets: liveTooltipContent.liveValueTargets,
	};
}
