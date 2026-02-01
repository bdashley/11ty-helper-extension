import * as fs from 'fs';
import * as path from 'path';
import * as chokidar from 'chokidar';

const LOG_FILE = '.gemini-context.log';

interface Macro {
  file: string;
  name: string;
  args: string;
}

interface AuditReport {
  configFound: string;
  layouts: string[];
  customDataFiles: string[];
  macros: Macro[];
  customFilters: string[];
  shortcodes: string[];
  uiFramework: string;
}

function performAudit(): void {
  const configFiles: string[] = ['.eleventy.js', 'eleventy.config.js', 'eleventy.config.cjs'];
  const activeConfig: string | undefined = configFiles.find(file => fs.existsSync(file));
  
  const report: AuditReport = {
    configFound: activeConfig || 'None',
    layouts: [],
    customDataFiles: [],
    macros: [],
    customFilters: [],
    shortcodes: [],
    uiFramework: 'Vanilla/Unknown'
  };

  // 1. Framework Detection (UI Context)
  if (fs.existsSync('tailwind.config.js')) report.uiFramework = 'Tailwind CSS';
  else if (fs.existsSync('bootstrap.config.js')) report.uiFramework = 'Bootstrap';

  // 2. Extract Config Logic (Filters & Shortcodes)
  if (activeConfig) {
    const configContent: string = fs.readFileSync(activeConfig, 'utf8');
    const filterRegex = /\.addFilter\s*\(\s*["']([^"']+)["']/g;
    const shortcodeRegex = /\.add(?:Async)?(?:Paired)?Shortcode\s*\(\s*["']([^"']+)["']/g;
    
    let match: RegExpExecArray | null;
    while ((match = filterRegex.exec(configContent))) report.customFilters.push(match[1]);
    while ((match = shortcodeRegex.exec(configContent))) report.shortcodes.push(match[1]);
  }

  // 3. Deep Macro Inspection
  const includesDir = '_includes';
  if (fs.existsSync(includesDir)) {
    const scanFiles = (dir: string): void => {
      fs.readdirSync(dir).forEach(file => {
        const filePath = path.join(dir, file);
        if (fs.statSync(filePath).isDirectory()) return scanFiles(filePath);
        
        if (file.endsWith('.njk')) {
          const content: string = fs.readFileSync(filePath, 'utf8');
          const macroRegex = /\{%\s*macro\s+([a-zA-Z0-9_]+)\s*\(([^)]*)\)\s*%\}/g;
          let mMatch: RegExpExecArray | null;
          while ((mMatch = macroRegex.exec(content))) {
            report.macros.push({
              file: file,
              name: mMatch[1],
              args: mMatch[2].trim() || 'none'
            });
          }
          if (dir === includesDir) report.layouts.push(file);
        }
      });
    };
    scanFiles(includesDir);
  }

  // 4. Global Data
  if (fs.existsSync('_data')) {
    report.customDataFiles = fs.readdirSync('_data').filter(f => f.endsWith('.json') || f.endsWith('.js'));
  }

  // Output formatting for Gemini
  const output = `--- 11ty LIVE UI AUDIT [${new Date().toLocaleTimeString()}] ---
UI Framework:   ${report.uiFramework}
Filters:        ${report.customFilters.join(', ') || 'None'}
Shortcodes:     ${report.shortcodes.join(', ') || 'None'}
Layouts:        ${report.layouts.join(', ') || 'None'}

MACRO REGISTRY:
${report.macros.map(m => ` - ${m.name}(${m.args}) [in ${m.file}]`).join('\n') || ' No macros found.'}
------------------------------------------------------`;
  
  fs.writeFileSync(LOG_FILE, output);
}

const watcher = chokidar.watch(['.eleventy.js', 'eleventy.config.js', '_includes/**/*', '_data/**/*', 'tailwind.config.js'], {
  ignored: /(^|[\/\\])\../,
  persistent: true
});

watcher.on('change', (filePath: string) => {
  performAudit();
});

performAudit();
