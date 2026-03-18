import { existsSync } from '@std/fs/exists';
import * as path from '@std/path';
import { parseArgs } from '@std/cli';

import { Buffer } from 'node:buffer';

import browserslist from 'browserslist';
import {
  transform,
  browserslistToTargets,
} from 'lightningcss';
import * as sass from 'sass';

const flags = parseArgs(Deno.args, {
  boolean: ['dev'],
});

const targets = browserslistToTargets(
  browserslist(['last 2 versions', 'not dead'])
);

const IN = './sass/main.sass';
const OUT = './dist';
const PLACES_TO_WATCH = ['sass', 'Main.bbtheme'];

const THEME_PREFIX = 'bb98-';
const PROJECT_NAME_PRETTY = 'Blockbench 98';
const VERSION = '1.0.0';

const AUTHOR = 'wqb';

const DEFAULT_THEME = {
  name: PROJECT_NAME_PRETTY,
  author: AUTHOR,
  borders: false,
  main_font:
    '"Pixelated MS Sans Serif", MS sans serif, sans-serif',
  headline_font: '',
  code_font: 'Courier, monospace',
  css: '',
  thumbnail: `.theme_preview_menu {
  margin-top: 20px;
  background-color: var(--color-back);
  box-shadow: inset -2px -2px #0a0a0a, inset 1px 1px #ffffff, inset -2px -2px #808080, inset 2px 2px #dfdfdf;
  background-color: var(--color-back);
  border: 1px solid var(--color-back);
} 

.theme_preview_menu > .theme_preview_text {
    background-color: #000000;
    opacity: 1;
}

.theme_preview_header {
  background: linear-gradient(90deg, #000080, #1084d0);
  height: 12px;
  position: relative;
  z-index: 1;
}

.theme_preview_menu_header {
    box-shadow:  inset -2px -2px #dfdfdf, inset 2px 2px #0a0a0a;
    background: none;
    margin-top: 12px;
}

.theme_preview_menu_header > .theme_preview_text {
     background-color: #000000;
}
`,
  colors: {
    ui: '#c0c0c0',
    back: '#c0c0c0',
    dark: '#c0c0c0',
    border: '#181a1f',
    selected: '#9f9f9f',
    button: '#dfdfdf',
    bright_ui: '#ffffff',
    accent: '#0000ff',
    frame: '#c2c6ca',
    text: '#000000',
    light: '#000000',
    accent_text: '#ffffff',
    bright_ui_text: '#000006',
    subtle_text: '#000000',
    grid: '#0000bd',
    wireframe: '#b1b1ff',
    checkerboard: '#dadada',
  },
};

if (!existsSync(OUT)) {
  Deno.mkdirSync(OUT, {
    recursive: true,
  });
}

function formatBytes(
  bytes: number,
  decimals = 2
) {
  if (!+bytes) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = [
    'B',
    'KB',
    'MB',
    'GB',
    'TB',
    'PB',
    'EB',
    'ZB',
    'YB',
  ];

  const i = Math.floor(
    Math.log(bytes) / Math.log(k)
  );

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

const compileToTheme = async () => {
  const compiled = await sass.compileAsync(IN, {
    loadPaths: ['sass'],
    quietDeps: true,
  });

  const result = transform({
    filename: '',
    minify: false,
    code: Buffer.from(compiled.css),
    targets,
  });

  const themeData = {
    ...DEFAULT_THEME,
    css: result.code.toString(),
  };

  Deno.writeTextFile(
    path.join(
      OUT,
      `${THEME_PREFIX}default.bbtheme`
    ),
    JSON.stringify(themeData, null, 2)
  )
    .catch((err) => {
      throw err;
    })
    .finally(() => {
      console.log(
        `Built bb98-default (${formatBytes(result.code.length)})`
      );
    });
};

let isBuilding = false;
let debounceTimer: number | undefined;

const buildAll = async () => {
  if (isBuilding) return;
  isBuilding = true;

  console.log('\nStarting build...');
  const start = Date.now();

  try {
    await compileToTheme();
    console.log(
      `Build complete in ${Date.now() - start}ms`
    );
  } catch (error) {
    console.error('Build failed');
    console.error(error);
  } finally {
    isBuilding = false;
  }
};

buildAll();

if (flags.dev) {
  console.log(
    `Watching for changes in ${PLACES_TO_WATCH}...`
  );
  const watcher = Deno.watchFs(PLACES_TO_WATCH);
  for await (const event of watcher) {
    event.paths.forEach((filePath) => {
      if (!filePath) return;
      const basename = path.basename(filePath);
      if (
        basename.endsWith('.sass') ||
        basename.endsWith('.scss') ||
        PLACES_TO_WATCH.includes(basename)
      ) {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          console.log(
            `\nChange detected in: ${path.basename(filePath)}`
          );
          buildAll();
        }, 300);
      }
    });
  }
}
