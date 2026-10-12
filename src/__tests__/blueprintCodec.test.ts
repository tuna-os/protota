import { describe, expect, it } from 'vitest';
import * as blueprint from '../utils/blueprint';
import * as codec from '../utils/blueprintCodec';

/** The codec move must not fork behavior: blueprint re-exports one source of truth. */
describe('blueprintCodec single source of truth', () => {
  it('re-exports the same references', () => {
    expect(blueprint.CLASS_TO_WIDGET_MAP).toBe(codec.CLASS_TO_WIDGET_MAP);
    expect(blueprint.ANNOTATION_SLOTS).toBe(codec.ANNOTATION_SLOTS);
    expect(blueprint.canonicalClassName).toBe(codec.canonicalClassName);
    expect(blueprint.editorPropertyName).toBe(codec.editorPropertyName);
    expect(blueprint.escapeBlueprintString).toBe(codec.escapeBlueprintString);
    expect(blueprint.widgetClassForType).toBe(codec.widgetClassForType);
    expect(blueprint.widgetTypeForClass).toBe(codec.widgetTypeForClass);
  });

  it('keeps canonicalization order (GtkSource before Gtk) and Gio support', () => {
    expect(codec.canonicalClassName('GtkSourceView')).toBe('GtkSource.View');
    expect(codec.canonicalClassName('GtkBox')).toBe('Gtk.Box');
    expect(codec.canonicalClassName('GioMenu')).toBe('Gio.Menu');
  });

  it('escapes without adding quotes (callers quote)', () => {
    expect(codec.escapeBlueprintString('a"b\\c')).toBe('a\\"b\\\\c');
  });

  it('keeps real annotation slots and property encoding', () => {
    expect(codec.ANNOTATION_SLOTS.has('top')).toBe(true);
    expect(codec.ANNOTATION_SLOTS.has('translatable')).toBe(false);
    expect(codec.exportPropertyName('iconName')).toBe('icon-name');
    expect(codec.exportPropertyName('widthRequest')).toBe('width-request');
    // Button/label text stays quoted even when numeric.
    expect(codec.formatPropertyValue('label', '0')).toBe('"0"');
  });
});
