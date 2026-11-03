import loadFontAtlas from '@8f4e/sprite-generator';

const canvas = document.getElementById('test-canvas') as HTMLCanvasElement;
const { image } = await loadFontAtlas('6x10');
canvas.width = image.width;
canvas.height = image.height;
const pixels = new Uint8ClampedArray(image.width * image.height * 4);
for (let i = 0; i < image.data.length; i++) pixels.set([image.data[i], image.data[i], image.data[i], 255], i * 4);
canvas.getContext('2d')!.putImageData(new ImageData(pixels, image.width, image.height), 0, 0);
document.body.dataset.ready = 'true';
