export const projects = [
	{
		id: 'cyclic-timestretch',
		title: 'Cyclic time stretch',
		description: 'Stretch a sample by repeating and crossfading short cycles while preserving their playback pitch.',
		path: 'audio/cyclicTimestretch.8f4e',
	},
	{
		id: 'granular-sampler',
		title: 'Granular sampler',
		description: 'Explore sample playback driven by a clock, random positions and modulation, with stereo reverb.',
		path: 'audio/granularSampler.8f4e',
	},
	{
		id: 'felt-piano',
		title: 'Felt piano',
		description: 'Play sixteen MIDI voices from a 158 MB mono sample bank, with three velocity layers.',
		path: 'midi/feltPiano.8f4e',
	},
	{
		id: 'felt-piano-one-shot',
		title: 'Felt piano (one-shot)',
		description: 'Trigger sixteen piano voices that play to the sample end, replacing the oldest voice when reused.',
		path: 'midi/feltPianoOneShot.8f4e',
	},
];

export const projectCategories = [
	{ path: 'audio', title: 'Audio' },
	{ path: 'midi', title: 'MIDI' },
].map(category => ({
	...category,
	projects: projects.filter(project => project.path.slice(0, project.path.lastIndexOf('/')) === category.path),
}));
