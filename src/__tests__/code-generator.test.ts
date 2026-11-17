/**
 * Code generator (src/utils/codeGenerator.ts) — Python/Rust/Vala bindings and
 * the Broadway launcher script. Previously 0% coverage.
 *
 * These generators produce the exact files a user copies into their GTK app,
 * so the class names, resource paths and template wiring are a contract:
 * a typo here silently ships broken bindings.
 */
import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import {
  generateBroadwayScript,
  generatePythonBindings,
  generateRustBindings,
  generateValaBindings,
} from '../utils/codeGenerator';
import type { MockupDocument } from '../types/mockup';

const doc = (title: string): MockupDocument =>
  ({ id: 'd1', title, screens: [] }) as unknown as MockupDocument;

describe('generatePythonBindings', () => {
  it('generates a valid PyGObject template binding', () => {
    const out = generatePythonBindings(doc('My App'));
    expect(out).toContain("gi.require_version('Gtk', '4.0')");
    expect(out).toContain("gi.require_version('Adw', '1')");
    expect(out).toContain('class MyAppWindow(Adw.ApplicationWindow):');
    expect(out).toContain("__gtype_name__ = 'MyAppWindow'");
    expect(out).toContain("@Gtk.Template(resource_path='/my-app/window.ui')");
    expect(out).toContain('header_bar = Gtk.Template.Child()');
    expect(out).toContain('@Gtk.Template.Callback()');
  });

  it('sanitizes non-alphanumeric characters from the class name', () => {
    const out = generatePythonBindings(doc('My-App! v2'));
    expect(out).toContain('class MyAppv2Window(Adw.ApplicationWindow):');
  });

  it('turns whitespace into dashes for the resource path', () => {
    const out = generatePythonBindings(doc('my app'));
    expect(out).toContain("@Gtk.Template(resource_path='/my-app/window.ui')");
  });
});

describe('generateRustBindings', () => {
  it('generates CompositeTemplate bindings', () => {
    const out = generateRustBindings(doc('My App'));
    expect(out).toContain('use gtk::{glib, CompositeTemplate};');
    expect(out).toContain('#[template(resource = "/my-app/window.ui")]');
    expect(out).toContain('pub struct MyAppWindow {');
    expect(out).toContain('#[template_child]');
    expect(out).toContain('pub header_bar: TemplateChild<adw::HeaderBar>');
    expect(out).toContain('glib::wrapper!');
    expect(out).toContain('impl ApplicationWindowImpl for MyAppWindow {}');
  });
});

describe('generateValaBindings', () => {
  it('generates GtkTemplate declarations', () => {
    const out = generateValaBindings(doc('My App'));
    expect(out).toContain('[GtkTemplate (ui = "/my-app/window.ui")]');
    expect(out).toContain('public class MyAppWindow : Adw.ApplicationWindow');
    expect(out).toContain('[GtkChild]');
    expect(out).toContain('private unowned Adw.HeaderBar header_bar;');
    expect(out).toContain('[GtkCallback]');
  });
});

describe('generateBroadwayScript', () => {
  it('starts broadwayd, compiles the blueprint and exports the display', () => {
    const out = generateBroadwayScript(doc('My App'));
    expect(out).toContain('#!/usr/bin/env bash');
    expect(out).toContain('broadwayd :5 &');
    expect(out).toContain('export GDK_BACKEND=broadway');
    expect(out).toContain('export BROADWAY_DISPLAY=:5');
    expect(out).toContain('blueprint-compiler compile my-app.blp -o my-app.ui');
  });

  it('uses the dash-case name from the title', () => {
    const out = generateBroadwayScript(doc('Hello World'));
    expect(out).toContain('blueprint-compiler compile hello-world.blp -o hello-world.ui');
  });
});

describe('a title from an opened file', () => {
  // Each title closes the literal it lands in and adds code of its own.
  const hostile = [
    "x'+__import__('os').system('id')+'",
    'x"; system("id"); "',
    'x$(id)',
    'x`id`',
    'x;id;',
    'x\\',
  ];

  it.each(hostile)('stays inside the Python string: %s', (title) => {
    expect(generatePythonBindings(doc(title)))
      .toMatch(/^@Gtk\.Template\(resource_path='\/[\p{L}\p{N}._-]+\/window\.ui'\)$/mu);
  });

  it.each(hostile)('stays inside the Rust and Vala strings: %s', (title) => {
    expect(generateRustBindings(doc(title)))
      .toMatch(/^ {4}#\[template\(resource = "\/[\p{L}\p{N}._-]+\/window\.ui"\)\]$/mu);
    expect(generateValaBindings(doc(title)))
      .toMatch(/^\[GtkTemplate \(ui = "\/[\p{L}\p{N}._-]+\/window\.ui"\)\]$/mu);
  });

  it.each(hostile)('reaches the launcher script as plain file names: %s', (title) => {
    const script = generateBroadwayScript(doc(title));
    const compile = script.split('\n').find((line) => line.startsWith('blueprint-compiler compile '))!;
    // What a shell hands to the compiler, with `printf` standing in for it.
    const seen = execFileSync('sh', ['-c', compile.replace('blueprint-compiler compile', "printf '%s\\n'")], {
      encoding: 'utf8',
      cwd: tmpdir(),
      env: { PATH: process.env.PATH ?? '' },
    }).trimEnd().split('\n');
    expect(seen).toHaveLength(3);
    expect(seen[0]).toMatch(/^[\p{L}\p{N}._-]+\.blp$/u);
    expect(seen[1]).toBe('-o');
    expect(seen[2]).toBe(seen[0].replace(/\.blp$/, '.ui'));
  });

  it('keeps letters and digits of any script, and falls back when none are left', () => {
    expect(generateBroadwayScript(doc('Café Menü 2'))).toContain('blueprint-compiler compile café-menü-2.blp');
    expect(generateBroadwayScript(doc('$()'))).toContain('blueprint-compiler compile app.blp -o app.ui');
  });
});
