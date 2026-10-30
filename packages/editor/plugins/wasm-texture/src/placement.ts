type OverlayPosition = 'left' | 'center' | 'right';

export function getTextureDrawRect(
	sourceWidth: number,
	sourceHeight: number,
	viewportWidth: number,
	viewportHeight: number,
	magnification = 1,
	position: OverlayPosition = 'center'
): { x: number; y: number; width: number; height: number } {
	const width = sourceWidth * magnification;
	const height = sourceHeight * magnification;
	const horizontalCenter = {
		left: viewportWidth / 4,
		center: viewportWidth / 2,
		right: (viewportWidth * 3) / 4,
	}[position];
	return {
		x: horizontalCenter - width / 2,
		y: (viewportHeight - height) / 2,
		width,
		height,
	};
}
