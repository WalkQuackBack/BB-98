import { existsSync } from "@std/fs/exists";
import * as path from "@std/path";
import { parseArgs } from "@std/cli";
import { Buffer } from "node:buffer";

import browserslist from 'browserslist';
import { transform, browserslistToTargets } from "lightningcss";
import * as sass from "sass";

const __dirname = path.dirname(path.fromFileUrl(import.meta.url));
const root = path.resolve(__dirname, "..");

const THEME_NAME = "BB-98";
const AUTHOR = "wqb";
const VERSION = "1.0.0";
const OUT = path.join(root, "dist");

const TEMPLATE_FILE = path.join(__dirname, "template.bbtheme");
const PREFIX_FILE = path.join(__dirname, "prefix.css");
const SASS_DIR = path.join(root, "sass");
const MAIN_SCSS = path.join(SASS_DIR, "main.scss");

const PLACES_TO_WATCH = [SASS_DIR, TEMPLATE_FILE, PREFIX_FILE];

const flags = parseArgs(Deno.args, {
  boolean: ["dev"],
});

const targets = browserslistToTargets(browserslist(['last 2 versions', 'not dead']));

if (!existsSync(OUT)) {
  Deno.mkdirSync(OUT, { recursive: true });
}

function formatBytes(bytes: number) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${['B', 'KB', 'MB', 'GB'][i]}`;
}

const buildTheme = async () => {
  console.log(`\nStarting build for ${THEME_NAME}...`);
  const start = Date.now();

  try {
    const template = Deno.readTextFileSync(TEMPLATE_FILE);
    const prefixCss = Deno.readTextFileSync(PREFIX_FILE);

    const prefixResult = transform({
      filename: "prefix.css",
      minify: false,
      code: Buffer.from(prefixCss),
      targets
    }).code.toString();

    const compiledSass = await sass.compileAsync(MAIN_SCSS, {
      loadPaths: ["node_modules"],
      quietDeps: true,
    });

    const cssResult = transform({
      filename: "style.css",
      minify: false,
      code: Buffer.from(compiledSass.css),
      targets
    }).code.toString();

    const themeData = template
      .replace("<THEMENAME>", THEME_NAME)
      .replace("<THEMEAUTHOR>", AUTHOR);

    const metadataHeader = `
/*
    ${THEME_NAME}
    Version ${VERSION}
    Compiled on: ${new Date().toUTCString()}
*/
`;

    const finalContent = themeData.concat(prefixResult, metadataHeader, cssResult);
    const outputPath = path.join(OUT, `${THEME_NAME}.bbtheme`);
    
    await Deno.writeTextFile(outputPath, finalContent);

    console.log(`Built: ${outputPath} (${formatBytes(finalContent.length)})`);
    console.log(`Done in ${Date.now() - start}ms`);

  } catch (error) {
    console.error("Build failed:");
    console.error(error);
  }
};

await buildTheme();

if (flags.dev) {
  console.log(`Watching for changes...`);
  
  let debounceTimer: number | undefined;
  const watcher = Deno.watchFs(PLACES_TO_WATCH);

  for await (const event of watcher) {
    const isRelevant = event.paths.some(p => 
      p.endsWith(".scss") || 
      p.endsWith(".sass") || 
      p.endsWith(".bbtheme") || 
      p.endsWith(".css")
    );

    if (isRelevant) {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        buildTheme();
      }, 300);
    }
  }
}