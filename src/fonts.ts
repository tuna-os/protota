/**
 * Typography parity with native GTK.
 *
 * Adwaita Sans is a variable font (weight axis 100–900, optical-size axis
 * 14–32), and GNOME renders real weights from it. The bundled stylesheet
 * declares the same file as a static `font-weight: 400` face, so every bold
 * heading and button in the browser was *synthesised* bold — a smeared
 * regular face that never matches the app it is meant to depict.
 *
 * Re-declaring the same file with its true variable range makes the browser
 * instantiate genuine weights. This matters for a design tool beyond looks:
 * synthetic bold has different metrics, so text measured in Protota would
 * not match text in the built app.
 */
import adwaitaSans from '@gjsify/adwaita-fonts/files/adwaita-sans-400.ttf?url';
import adwaitaSansItalic from '@gjsify/adwaita-fonts/files/adwaita-sans-400-italic.ttf?url';

export function installVariableAdwaitaFonts(): void {
  if (typeof document === 'undefined') return;
  const sheet = document.createElement('style');
  sheet.id = 'protota-variable-fonts';
  sheet.textContent = `
@font-face {
  font-family: 'Adwaita Sans';
  font-style: normal;
  font-display: swap;
  font-weight: 100 900;
  src: url('${adwaitaSans}') format('truetype-variations');
}
@font-face {
  font-family: 'Adwaita Sans';
  font-style: italic;
  font-display: swap;
  font-weight: 100 900;
  src: url('${adwaitaSansItalic}') format('truetype-variations');
}
:root {
  /* GTK renders with grayscale antialiasing and the font's own optical
     sizing; matching both keeps glyph weight and spacing comparable. */
  font-optical-sizing: auto;
  font-synthesis-weight: none;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
`;
  document.head.appendChild(sheet);
}
