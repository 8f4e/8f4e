// The page owns this context so it survives editor disposal and gallery selections.
// The first audio project's Allow button resumes it from a user gesture.
export const sharedAudioContext = new AudioContext({ sampleRate: 48000, latencyHint: 'interactive' });

import.meta.hot?.dispose(() => {
	void sharedAudioContext.close();
});
