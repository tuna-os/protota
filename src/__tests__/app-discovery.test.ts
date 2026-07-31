/**
 * Shared discovery core (#118): the environment-free file-map port of the
 * protota-import CLI's checkout walking (PR #111). Same fixtures, same
 * honest manifest facts — the CLI tests in round-trip-cli.test.ts prove the
 * filesystem adapter, these prove the pure core the browser also uses.
 */
import { describe, expect, it } from 'vitest';
import {
  discoverAppSources,
  appBundleManifest,
  normalizePosixPath,
  isDiscoveryRelevantPath,
  isIgnoredPath,
} from '../utils/appDiscovery';

const WINDOW_BLP = `using Gtk 4.0;
using Adw 1;

template $DemoWindow : Adw.ApplicationWindow {
  title: _("Demo");
  content: Adw.ToolbarView toolbar {
    [top]
    Adw.HeaderBar header_bar {}
    content: Gtk.Box main_box {
      $ThirdPartyWidget preview {}
    };
  };
}
`;

const PANEL_BLP = `using Gtk 4.0;

template $DemoPanel : Gtk.Box {
  Gtk.Button open_button { label: _("Open"); }
}
`;

describe('discoverAppSources (file map)', () => {
  it('selects meson-referenced sources and reports exclusions', () => {
    const result = discoverAppSources({
      'src/window.blp': WINDOW_BLP,
      'src/panel.blp': PANEL_BLP,
      'src/scratch.blp': 'using Gtk 4.0;\nGtk.Box abandoned {}\n',
      'src/meson.build': "blueprints = custom_target(input: files('window.blp', 'panel.blp'))\n",
    });
    expect(result.discovery).toContain('build-metadata');
    expect(result.files.map((file) => file.path)).toEqual(['src/panel.blp', 'src/window.blp']);
    expect(result.notes.join(' ')).toContain('src/scratch.blp');
  });

  it('resolves gresource references relative to the XML, mapping .ui back to sibling .blp', () => {
    const result = discoverAppSources({
      'data/app.gresource.xml':
        '<gresources><gresource prefix="/org/demo"><file preprocess="xml-stripblanks">../src/window.ui</file></gresource></gresources>',
      'src/window.ui': '<interface><object class="AdwApplicationWindow"/></interface>',
      'src/window.blp': WINDOW_BLP,
    });
    expect(result.discovery).toContain('build-metadata');
    // The shipped .ui maps back to its sibling .blp source.
    expect(result.files.map((file) => file.path)).toEqual(['src/window.blp']);
  });

  it('falls back to a glob with an explicit note when no metadata exists', () => {
    const result = discoverAppSources({ 'ui/window.blp': WINDOW_BLP });
    expect(result.discovery).toBe('glob fallback');
    expect(result.notes[0]).toContain('glob');
    expect(result.files.map((file) => file.path)).toEqual(['ui/window.blp']);
  });

  it('skips VCS and build directories and collects code files', () => {
    const result = discoverAppSources({
      'src/window.blp': WINDOW_BLP,
      'src/window.vala': 'public class DemoWindow {}',
      'src/main.c': 'int main() { return 0; }',
      'builddir/generated.ui': '<interface/>',
      '.git/blob.blp': 'garbage',
    });
    expect(result.files.map((file) => file.path)).toEqual(['src/window.blp']);
    expect(result.codeFiles.map((file) => file.path)).toEqual(['src/main.c', 'src/window.vala']);
  });
});

describe('appBundleManifest', () => {
  it('reports entry candidates, declared templates, and unresolved references', () => {
    const manifest = appBundleManifest([
      { path: 'src/panel.blp', content: PANEL_BLP },
      { path: 'src/window.blp', content: WINDOW_BLP },
    ]);
    expect(manifest.entryCandidates).toEqual(['src/window.blp']);
    expect(manifest.declaredTemplates).toEqual(['DemoPanel', 'DemoWindow']);
    expect(manifest.unresolvedReferences).toEqual(['ThirdPartyWidget']);
    expect(manifest.parseIssues).toEqual([]);
  });

  it('collects parse issues without dropping the file from the manifest', () => {
    const manifest = appBundleManifest([
      { path: 'src/window.blp', content: WINDOW_BLP },
      { path: 'src/broken.blp', content: 'using Gtk 4.0;\n// nothing importable here\n' },
    ]);
    expect(manifest.entryCandidates).toEqual(['src/window.blp']);
    expect(manifest.parseIssues).toHaveLength(1);
    expect(manifest.parseIssues[0].path).toBe('src/broken.blp');
  });
});

describe('path helpers', () => {
  it('normalizes ./ and ../ segments', () => {
    expect(normalizePosixPath('data/../src/./window.blp')).toBe('src/window.blp');
    expect(normalizePosixPath('./meson.build')).toBe('meson.build');
  });

  it('classifies discovery-relevant paths', () => {
    expect(isDiscoveryRelevantPath('src/window.blp')).toBe(true);
    expect(isDiscoveryRelevantPath('data/app.gresource.xml')).toBe(true);
    expect(isDiscoveryRelevantPath('meson.build')).toBe(true);
    expect(isDiscoveryRelevantPath('src/meson.build')).toBe(true);
    expect(isDiscoveryRelevantPath('icon.png')).toBe(false);
  });

  it('ignores VCS/build segments anywhere in the path', () => {
    expect(isIgnoredPath('.git/config')).toBe(true);
    expect(isIgnoredPath('sub/builddir/x.ui')).toBe(true);
    expect(isIgnoredPath('src/window.blp')).toBe(false);
  });
});
