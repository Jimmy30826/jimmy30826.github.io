import { VertiWikiPlugin, PluginContext } from '../core/pipeline';
import { resolveResourceUrl } from '../core/router';

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
    // Template calls use MediaWiki-style syntax: {{역정보|이름=서울역}}
    const matches = [...markdown.matchAll(/\{\{\s*([^{}\n]+?)\s*\}\}/g)];
    if (!matches.length) return markdown;

    let result = markdown;

    for (const match of matches) {
      const { name, args } = parseArguments(match[1].trim());
      if (!name || name.includes('/') || name.includes('\\\\')) continue;

      const templatePath = `templates/${name}.md`;
      let source = cache.get(templatePath);

      try {
        if (!source) {
          const url = resolveResourceUrl(templatePath);
          const response = await fetch(url, {
            headers: { 'Accept': 'text/markdown, text/plain, */*' }
          });
          if (!response.ok) {
            console.warn(`[Template] Failed to load ${templatePath}: ${response.status} ${response.statusText}`);
            continue;
          }
          source = await response.text();
          cache.set(templatePath, source);
        }

        // Strip optional YAML frontmatter from the template document.
        source = source.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '');
        result = result.replace(match[0], renderTemplate(source, args));
      } catch (error) {
        console.warn(`[Template] Error loading ${templatePath}:`, error);
      }
    }

    return result;
  }
};
