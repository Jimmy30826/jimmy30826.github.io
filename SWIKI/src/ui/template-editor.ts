import { escapeHtml } from '../core/escape';

interface TemplateFile {
  name: string;
  path: string;
  sha?: string;
}

function repoFromConfig(config: any): string {
  const url = String(config?.githubUrl || '');
  const match = url.match(/github\.com\/([^/]+\/[^/#]+?)(?:\.git)?$/);
  return match ? match[1] : '';
}

function apiUrl(repo: string, path: string = ''): string {
  return `https://api.github.com/repos/${repo}/contents/${path}`;
}

function headers(token: string = ''): Record<string, string> {
  const h: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28'
  };
  if (token.trim()) h.Authorization = `Bearer ${token.trim()}`;
  return h;
}

function encodeBase64Utf8(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  bytes.forEach(b => binary += String.fromCharCode(b));
  return btoa(binary);
}

async function listTemplates(repo: string, token: string): Promise<TemplateFile[]> {
  if (!repo) return [];
  const response = await fetch(apiUrl(repo, 'SWIKI/templates'), { headers: headers(token) });
  if (!response.ok) throw new Error(`GitHub API ${response.status}`);
  const data = await response.json();
  if (!Array.isArray(data)) return [];
  return data
    .filter((item: any) => item.type === 'file' && item.name.toLowerCase().endsWith('.md'))
    .map((item: any) => ({
      name: item.name.replace(/\.md$/i, ''),
      path: item.path,
      sha: item.sha
    }))
    .sort((a: TemplateFile, b: TemplateFile) => a.name.localeCompare(b.name));
}

async function loadTemplate(repo: string, name: string, token: string): Promise<{ content: string; sha?: string }> {
  const response = await fetch(apiUrl(repo, `SWIKI/templates/${encodeURIComponent(name)}.md`), { headers: headers(token) });
  if (response.status === 404) return { content: '' };
  if (!response.ok) throw new Error(`GitHub API ${response.status}`);
  const data = await response.json();
  const binary = atob(data.content.replace(/\s/g, ''));
  const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
  return { content: new TextDecoder().decode(bytes), sha: data.sha };
}

async function saveTemplate(repo: string, name: string, content: string, sha: string | undefined, token: string): Promise<string> {
  if (!repo) throw new Error('config.json의 githubUrl에서 저장할 GitHub 저장소를 찾을 수 없습니다.');
  if (!token.trim()) throw new Error('GitHub 저장 토큰을 입력해 주세요.');
  const body: any = {
    message: `docs: update template ${name}`,
    content: encodeBase64Utf8(content),
    branch: 'main'
  };
  if (sha) body.sha = sha;

  const response = await fetch(apiUrl(repo, `SWIKI/templates/${encodeURIComponent(name)}.md`), {
    method: 'PUT',
    headers: { ...headers(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`GitHub API ${response.status}: ${detail.slice(0, 300)}`);
  }
  const data = await response.json();
  return data.content?.sha || sha || '';
}

export async function renderTemplateEditor(
  container: HTMLElement,
  config: any,
  requestedName: string = '',
  onNavigate?: (path: string) => void
): Promise<void> {
  const repo = repoFromConfig(config);
  let token = sessionStorage.getItem('swiki_github_token') || '';
  let currentName = requestedName;
  let currentSha: string | undefined;
  let templates: TemplateFile[] = [];

  const render = (message = '', error = false) => {
    container.innerHTML = `
      <section class="swiki-template-editor">
        <div class="swiki-template-editor-head">
          <div>
            <p class="swiki-template-kicker">SWIKI 템플릿</p>
            <h1>템플릿 관리</h1>
            <p class="swiki-template-description">위키에서 사용하는 <code>템플릿:이름</code> 문서를 만들고 수정합니다.</p>
          </div>
          <button class="verti-btn verti-btn-sm swiki-template-new">새 템플릿</button>
        </div>

        <div class="swiki-template-layout">
          <aside class="swiki-template-list">
            <div class="swiki-template-list-title">템플릿 목록</div>
            <div class="swiki-template-items">
              ${templates.length
                ? templates.map(t => `<button class="swiki-template-item ${t.name === currentName ? 'active' : ''}" data-template="${escapeHtml(t.name)}">${escapeHtml(t.name)}</button>`).join('')
                : '<div class="swiki-template-empty">아직 템플릿이 없습니다.</div>'}
            </div>
          </aside>

          <div class="swiki-template-main">
            <label class="swiki-template-label">템플릿 이름</label>
            <input class="swiki-template-name" value="${escapeHtml(currentName)}" placeholder="예: 역정보" />

            <label class="swiki-template-label">템플릿 내용</label>
            <textarea class="swiki-template-source" spellcheck="false" placeholder="# 역정보\n\n| 항목 | 내용 |\n| --- | --- |\n| 이름 | {{{이름}}} |"></textarea>

            <div class="swiki-template-help">
              <strong>변수 문법</strong>
              <code>{{{이름}}}</code>처럼 작성하고, 호출할 때 <code>{{역정보|이름=서울역}}</code>처럼 사용합니다.
            </div>

            <div class="swiki-template-actions">
              <button class="verti-btn swiki-template-save">저장</button>
              <button class="verti-btn verti-btn-sm swiki-template-open">템플릿 문서 열기</button>
              <span class="swiki-template-status ${error ? 'error' : ''}">${escapeHtml(message)}</span>
            </div>

            <details class="swiki-template-auth">
              <summary>GitHub 저장 설정</summary>
              <p>이 편집기는 GitHub API를 사용합니다. 토큰은 이 브라우저의 sessionStorage에만 저장되며 저장소에 커밋됩니다.</p>
              <input type="password" class="swiki-template-token" placeholder="GitHub Fine-grained token" autocomplete="off" />
              <div><button class="verti-btn verti-btn-sm swiki-template-token-save">이 세션에서 사용</button></div>
            </details>
          </div>
        </div>
      </section>
    `;

    const source = container.querySelector<HTMLTextAreaElement>('.swiki-template-source')!;
    const nameInput = container.querySelector<HTMLInputElement>('.swiki-template-name')!;
    const tokenInput = container.querySelector<HTMLInputElement>('.swiki-template-token')!;
    tokenInput.value = token;

    container.querySelectorAll<HTMLButtonElement>('.swiki-template-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const name = btn.dataset.template || '';
        onNavigate?.(`템플릿:${name}`);
      });
    });

    container.querySelector('.swiki-template-new')?.addEventListener('click', () => {
      onNavigate?.('템플릿:새템플릿');
    });

    container.querySelector('.swiki-template-token-save')?.addEventListener('click', () => {
      token = tokenInput.value.trim();
      sessionStorage.setItem('swiki_github_token', token);
      render('토큰을 이 브라우저 세션에 저장했습니다.');
      loadCurrent();
    });

    container.querySelector('.swiki-template-save')?.addEventListener('click', async () => {
      const name = nameInput.value.trim();
      if (!/^[^/\\]+$/.test(name) || !name || name === '.' || name === '..') {
        render('템플릿 이름이 올바르지 않습니다.', true);
        return;
      }
      try {
        const newSha = await saveTemplate(repo, name, source.value, currentSha, token);
        currentName = name;
        currentSha = newSha;
        await refreshList();
        render('저장했습니다.');
        await loadCurrent();
      } catch (err) {
        render(err instanceof Error ? err.message : String(err), true);
      }
    });

    container.querySelector('.swiki-template-open')?.addEventListener('click', () => {
      if (currentName) onNavigate?.(`템플릿:${currentName}`);
    });

    source.value = (window as any).__swikiTemplateContent || '';
    delete (window as any).__swikiTemplateContent;
  };

  const refreshList = async () => {
    try {
      templates = await listTemplates(repo, token);
    } catch {
      templates = [];
    }
  };

  const loadCurrent = async () => {
    if (!currentName || currentName === '새템플릿') {
      currentSha = undefined;
      (window as any).__swikiTemplateContent = currentName === '새템플릿'
        ? '# 새 템플릿\n\n| 항목 | 내용 |\n| --- | --- |\n| 이름 | {{{이름}}} |\n'
        : '';
      render();
      return;
    }

    try {
      const loaded = await loadTemplate(repo, currentName, token);
      currentSha = loaded.sha;
      (window as any).__swikiTemplateContent = loaded.content;
      render();
    } catch (err) {
      currentSha = undefined;
      (window as any).__swikiTemplateContent = '';
      render(err instanceof Error ? err.message : String(err), true);
    }
  };

  await refreshList();
  await loadCurrent();
}
