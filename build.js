#!/usr/bin/env babel-node

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

export const HTERM_REPO = 'https://chromium.googlesource.com/apps/libapps';
export const HTERM_BRANCH = 'master';
export const OUTFILE = 'dist/index.js';
export const TMPDIR = path.resolve(__dirname, 'tmp');

export function buildHterm(repo, branch, outfile, tmpdir = TMPDIR) {
  const gitargs = `--work-tree="${tmpdir}" --git-dir="${tmpdir}/.git"`;
  execSync(`mkdir -p ${tmpdir}`);
  execSync(`git clone ${repo} ${tmpdir}`);
  execSync(`git ${gitargs} checkout ${branch}`);
  execSync(`${tmpdir}/hterm/bin/mkdist`);

  // modified version of https://github.com/umdjs/umd/blob/95563fd6b46f06bda0af143ff67292e7f6ede6b7/templates/returnExportsGlobal.js
  const htermEncoding = 'utf8';
  fs.writeFileSync(path.join(__dirname, outfile), `
(function (root, factory) {
  var GLOBAL_NAME = '_htermExports';
  if (typeof define === 'function' && define.amd) {
    // AMD. Register as an anonymous module.
    define(['exports'], function (exports) {
      root[GLOBAL_NAME] = factory(exports);
    });
  } else if (typeof exports === 'object' && typeof exports.nodeName !== 'string') {
    // CommonJS
    factory(exports);
  } else {
    // Browser globals
    root[GLOBAL_NAME] = factory({});
  }
}(this, function (exports) {
  ${/* libdot */fs.readFileSync(`${tmpdir}/hterm/dist/js/hterm_all.js`, htermEncoding).replace('lib.ensureRuntimeDependencies_();', '')}
  exports.lib = lib;
  ${/* hterm */fs.readFileSync(`${tmpdir}/hterm/dist/js/hterm.js`, htermEncoding)}
  exports.hterm = hterm;
}));
  `.replace(/^\s+/, '').replace(/\s+$/, '\n'));

  const htmermPackageJson = JSON.parse(fs.readFileSync(`${tmpdir}/hterm/package.json`).toString());
  const { version } = htmermPackageJson;
  execSync(`rm -rf ${tmpdir}`);
  return {
    version,
  };
}

export function updateVersion(packageJSONPath, htermVersion) {
  const pkg = JSON.parse(fs.readFileSync(packageJSONPath));
  pkg.version = `${htermVersion}`;
  fs.writeFileSync(packageJSONPath, `${JSON.stringify(pkg, null, '  ')}\n`);
  return pkg.version;
}

if (require.main === module) {
  const hterm = buildHterm(HTERM_REPO, HTERM_BRANCH, OUTFILE);
  console.log(`built ${OUTFILE}`); // eslint-disable-line no-console
  const version = updateVersion('package.json', hterm.version);
  console.log(version); // eslint-disable-line no-console
}
