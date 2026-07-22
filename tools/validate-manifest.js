#!/usr/bin/env node
// Sanity-checks every widgets/*/manifest.json against the fields iCUE requires.
// Field set follows the official spec: https://docs.elgato.com/icue/widgets/specification
// This is a pre-flight check only — the official `icuewidget` CLI's `validate`
// is authoritative and required before packaging.
// Usage: node tools/validate-manifest.js
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WIDGETS_DIR = path.join(REPO_ROOT, 'widgets');

const REQUIRED_FIELDS = [
  'author',
  'id',
  'name',
  'description',
  'version',
  'preview_icon',
  'min_framework_version',
  'os',
  'supported_devices',
];

const VALID_DEVICE_TYPES = ['pump_lcd', 'dashboard_lcd', 'keyboard_lcd'];

function validateManifest(manifest, widgetDir) {
  const errors = [];

  for (const field of REQUIRED_FIELDS) {
    if (!(field in manifest)) errors.push(`missing "${field}"`);
  }

  // id: lowercase alphanumeric, hyphens, and periods (per official spec).
  if (manifest.id && !/^[a-z0-9.-]+$/.test(manifest.id)) {
    errors.push(`"id" must be lowercase [a-z0-9.-] reverse-domain notation (got "${manifest.id}")`);
  }

  if (manifest.preview_icon && !fs.existsSync(path.join(widgetDir, manifest.preview_icon))) {
    errors.push(`"preview_icon" points to a missing file: ${manifest.preview_icon}`);
  }

  if (Array.isArray(manifest.supported_devices)) {
    if (manifest.supported_devices.length === 0) {
      errors.push('"supported_devices" must not be empty');
    }
    for (const device of manifest.supported_devices) {
      if (!VALID_DEVICE_TYPES.includes(device.type)) {
        errors.push(
          `unknown device type "${device.type}" (expected one of ${VALID_DEVICE_TYPES.join(', ')})`,
        );
      }
    }
  } else if ('supported_devices' in manifest) {
    errors.push('"supported_devices" must be an array');
  }

  return errors;
}

function main() {
  const widgetNames = fs
    .readdirSync(WIDGETS_DIR)
    .filter((name) => fs.existsSync(path.join(WIDGETS_DIR, name, 'manifest.json')));

  if (widgetNames.length === 0) {
    console.log('No widgets with a manifest.json found.');
    return;
  }

  let hasErrors = false;
  for (const name of widgetNames) {
    const manifestPath = path.join(WIDGETS_DIR, name, 'manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const errors = validateManifest(manifest, path.join(WIDGETS_DIR, name));

    if (errors.length > 0) {
      hasErrors = true;
      console.error(`✗ ${name}:`);
      for (const error of errors) console.error(`  - ${error}`);
    } else {
      console.log(`✓ ${name}`);
    }
  }

  if (hasErrors) process.exit(1);
}

main();
