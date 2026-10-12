/**
 * Compatibility facade for the Blueprint codec.
 *
 * The parser/import side lives in ./blueprintImport, the serializer/export
 * side in ./blueprintExport, and the shared type/property mappings in
 * ./blueprintCodec. This module re-exports all three so existing imports
 * keep working with no behavior change; new code should import from the
 * specific module instead.
 */
export type { ImportDiagnostic } from '../types/mockup';
export * from './blueprintCodec';
export * from './blueprintImport';
export * from './blueprintExport';
