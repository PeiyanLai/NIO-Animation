#!/usr/bin/env node
import fs from 'node:fs';

const input = process.argv[2];
if (!input) { console.error('Usage: node validate-animation-manifest.mjs animation-manifest.json'); process.exit(2); }
let manifest;
try { manifest = JSON.parse(fs.readFileSync(input, 'utf8')); } catch (error) { console.error(`Cannot read valid JSON: ${error.message}`); process.exit(2); }

const scopes = new Set(['vehicle-exterior', 'cockpit', 'vehicle-environment', 'vehicle-ecosystem', 'vehicle-system', 'fleet-topology']);
const mechanisms = new Set(['user-action', 'automatic-detection', 'state-transition', 'device-pairing', 'data-sync', 'relay-network', 'exception-handling']);
const errors = [];
for (const key of ['title', 'vehicle', 'scope', 'mechanism', 'chapters', 'assets', 'acceptance']) if (!(key in manifest)) errors.push(`Missing required field: ${key}`);
if (manifest.scope && !scopes.has(manifest.scope)) errors.push(`Unsupported scope: ${manifest.scope}`);
if (!Array.isArray(manifest.mechanism) || manifest.mechanism.length === 0) errors.push('mechanism must be a non-empty array');
for (const mechanism of manifest.mechanism || []) if (!mechanisms.has(mechanism)) errors.push(`Unsupported mechanism: ${mechanism}`);
if (!Array.isArray(manifest.chapters) || manifest.chapters.length === 0) errors.push('chapters must be a non-empty array');
for (const [index, chapter] of (manifest.chapters || []).entries()) for (const key of ['id', 'claim', 'scene', 'startState', 'endState']) if (!chapter?.[key]) errors.push(`chapters[${index}] is missing ${key}`);
if (manifest.scope === 'vehicle-system' && !manifest.mechanism?.includes('state-transition')) errors.push('vehicle-system requires state-transition');
if (manifest.scope === 'fleet-topology' && !manifest.mechanism?.includes('relay-network') && !manifest.mechanism?.includes('data-sync')) errors.push('fleet-topology requires relay-network or data-sync');
if (errors.length) { console.error('Animation manifest failed validation:'); for (const error of errors) console.error(`- ${error}`); process.exit(1); }
console.log(`Animation manifest is valid: ${manifest.title}`);
