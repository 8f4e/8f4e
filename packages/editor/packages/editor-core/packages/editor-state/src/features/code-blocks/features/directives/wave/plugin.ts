import { createDirectivePlugin } from '../utils';
import { createWaveDirectiveData } from './data';
import { createWaveDirectiveLayoutCallbacks } from './resolve';

function createWaveDirectivePlugin(name: string, heightRows: number) {
	return createDirectivePlugin(
		name,
		(directive, draft) => {
			const wave = createWaveDirectiveData(directive.args, directive.rawRow, heightRows);
			if (!wave) {
				return;
			}

			draft.layoutContributions.push({ rawRow: directive.rawRow, rows: heightRows });
			draft.layoutCallbacks.push(createWaveDirectiveLayoutCallbacks(wave));
		},
		{
			clearGraphicData: graphicData => {
				graphicData.widgets.arrayWaves = [];
			},
		}
	);
}

export const waveDirective = createWaveDirectivePlugin('wave', 2);
export const wave2Directive = createWaveDirectivePlugin('wave2', 4);
export const wave4Directive = createWaveDirectivePlugin('wave4', 8);

export default waveDirective;
