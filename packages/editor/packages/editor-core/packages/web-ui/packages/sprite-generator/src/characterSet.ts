/** IBM CP437 display order, including the graphical C0 and DEL characters.
 * Extended mappings: https://www.unicode.org/Public/MAPPINGS/VENDORS/MICSFT/PC/CP437.TXT
 */
export const CP437_CHARACTERS =
	'\0☺☻♥♦♣♠•◘○◙♂♀♪♫☼' +
	'►◄↕‼¶§▬↨↑↓→←∟↔▲▼' +
	' !"#$%&\'()*+,-./' +
	'0123456789:;<=>?' +
	'@ABCDEFGHIJKLMNO' +
	'PQRSTUVWXYZ[\\]^_' +
	'`abcdefghijklmno' +
	'pqrstuvwxyz{|}~⌂' +
	'ÇüéâäàåçêëèïîìÄÅ' +
	'ÉæÆôöòûùÿÖÜ¢£¥₧ƒ' +
	'áíóúñÑªº¿⌐¬½¼¡«»' +
	'░▒▓│┤╡╢╖╕╣║╗╝╜╛┐' +
	'└┴┬├─┼╞╟╚╔╩╦╠═╬╧' +
	'╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀' +
	'αßΓπΣσµτΦΘΩδ∞φε∩' +
	'≡±≥≤⌠⌡÷≈°∙·√ⁿ²■\u00a0';

export const GLYPH_COUNT = CP437_CHARACTERS.length;
