import { VertiWikiPlugin, PluginContext } from '../core/pipeline';

const cache = new Map<string, string>();

function parseArguments(raw: string): { name: string; args: Record<string, string> } {
  const parts = raw.split('|');
  const name = (parts.shift() || '').trim();
  const args: Record<string, string> = {};
  for (const part of parts) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.substring(0, idx).trim();
    if (key) args[key] = part.substring(idx + 1).trim();
  }
  return { name, args };
}

function renderTemplate(source: string, args: Record<string, string>): string {
  return source.replace(/\{\{\{\s*([^}]+?)\s*\}\}\}/g, (_, key) => args[key.trim()] ?? '');
}

export const templatesPlugin: VertiWikiPlugin = {
  name: 'templates',
  beforeParse: async (markdown: string, context: PluginContext) => {
    if (!markdown.includes('{{')) return markdown;
    const matches = [...markdown.matchAll(/\\{\\{\\s*([^{}\\n]+?)\\s*\\}\\}/g)];
    if (!matches.length) return markdown;
    let result = markdown;
    for (const match of matches) {
      const { name, args } = parseArguments(match[1].trim());
      if (!name || name.includes('/') || name.includes('\\\\')) continue;
      const templatePath = `templates/${name}.md`;
      let source = cache.get(templatePath);
      if (!source) {
        try {
          const response = await fetch(new URL(templatePath, window.location.href), { headers: { 'Accept': 'text/markdown, text/plain, */*' } });
          if (!response.ok) continue;
          source = await response.text();
          cache.set(templatePath, source);
        } catch { continue; }
      }
      source = source.replace(/^---\\r?\\n[\\s\\S]*?\\r?\\n---\\r?\\n/, '');
      result = result.replace(match[0], renderTemplate(source, args));
    }
    return result;
  }
};
