const css = `* {
	padding: 0;
	margin: 0;
	-webkit-user-select: none;
	-webkit-touch-callout: none;
	background: #000000;
}

canvas {
	image-rendering: pixelated;
}`;

export default function createCanvas() {
	const canvas = document.createElement('canvas');
	canvas.setAttribute('data-testid', 'canvas');
	canvas.setAttribute('width', '1024');
	canvas.setAttribute('height', '768');

	const style = document.createElement('style');
	style.textContent = css;

	document.head.appendChild(style);
	document.body.appendChild(canvas);

	return canvas;
}
