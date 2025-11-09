// Gerenciamento do tema (claro/escuro)
function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
}

// Verifica preferência salva ou do sistema
function initTheme() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
        setTheme(savedTheme);
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        setTheme('dark');
    } else {
        setTheme('light');
    }
}

// Alterna entre os temas
function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
}

// Inicializa tema e adiciona listener ao botão
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    document.getElementById('theme-toggle').addEventListener('click', toggleTheme);
    // Inicializa tentativa de carregar imagens de projetos hospedados no GitHub
    initGitHubProjectImages();
});
/**
 * Busca imagens de um repositório no GitHub e retorna a URL raw se encontrar.
 * Estratégia:
 * 1) Pega o default_branch do repositório
 * 2) Lista o conteúdo da raíz e procura por arquivos de imagem
 * 3) Caso não encontre, procura em pastas comuns (assets, images, img, docs)
 * 4) Se ainda não achar, tenta extrair a primeira imagem do README
 */
async function findRepoImage(owner, repo) {
    try {
        const repoResp = await fetch(`https://api.github.com/repos/${owner}/${repo}`);
        if (!repoResp.ok) return null;
        const repoJson = await repoResp.json();
        const branch = repoJson.default_branch || 'main';

        const contentsResp = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents?ref=${branch}`);
        if (!contentsResp.ok) return null;
        const items = await contentsResp.json();

        const imageExt = /\.(png|jpg|jpeg|svg|gif)$/i;
        // procura imagens na raiz
        const candidates = items.filter(i => i.type === 'file' && imageExt.test(i.name));
        if (candidates.length) {
            return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${candidates[0].path}`;
        }

        // procura em pastas comuns
        const folders = items.filter(i => i.type === 'dir' && /^(assets|images|img|docs|static)$/i.test(i.name));
        for (const f of folders) {
            const folderResp = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${f.path}?ref=${branch}`);
            if (!folderResp.ok) continue;
            const folderItems = await folderResp.json();
            const match = folderItems.find(fi => fi.type === 'file' && imageExt.test(fi.name));
            if (match) return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${match.path}`;
        }

        // tenta extrair imagem do README
        const readmeResp = await fetch(`https://api.github.com/repos/${owner}/${repo}/readme`);
        if (readmeResp.ok) {
            const readmeJson = await readmeResp.json();
            const content = atob((readmeJson.content || '').replace(/\n/g, ''));
            const mdImageRegex = /!\[[^\]]*\]\(([^)]+)\)/;
            const m = content.match(mdImageRegex);
            if (m && m[1]) {
                let url = m[1];
                // se for URL absoluta, usa direto
                if (/^https?:\/\//i.test(url)) return url;
                // se for relativa, torna raw URL
                url = url.replace(/^\.\//, '');
                return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${url}`;
            }
        }

        return null;
    } catch (e) {
        // Falha silenciosa: retorna null para usar fallback
        return null;
    }
}

// Inicializa e processa todos os elementos com a classe .project-github-img
function initGitHubProjectImages() {
    const imgs = document.querySelectorAll('.project-github-img');
    imgs.forEach(async (img) => {
        const repo = img.getAttribute('data-repo');
        const defaultSrc = img.getAttribute('data-default-src') || img.src;
        if (!repo) return;

        // repo no formato owner/repo
        const parts = repo.split('/');
        if (parts.length !== 2) return;
        const [owner, reponame] = parts;

        const wrapper = img.closest('.thumbnail-wrapper');
        if (wrapper) wrapper.classList.add('loading');

        // tenta encontrar imagem no repositório
        const found = await findRepoImage(owner, reponame);
        const targetSrc = found || defaultSrc;

        // carrega a imagem e aguarda load/error para remover o spinner
        await new Promise((resolve) => {
            // handlers
            function cleanAndResolve() {
                if (wrapper) wrapper.classList.remove('loading');
                img.removeEventListener('load', onLoad);
                img.removeEventListener('error', onError);
                resolve();
            }
            function onLoad() {
                cleanAndResolve();
            }
            function onError() {
                // se erro ao carregar targetSrc (possivelmente URL raw), tenta fallback
                if (img.src !== defaultSrc) {
                    img.src = defaultSrc;
                    return; // aguarda novo evento (load/error) para finalizar
                }
                cleanAndResolve();
            }

            img.addEventListener('load', onLoad);
            img.addEventListener('error', onError);

            // inicia o carregamento
            img.src = targetSrc;
        });
    });
}

document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
        e.preventDefault();
        document.querySelector(this.getAttribute('href')).scrollIntoView({
            behavior: 'smooth'
        });
    });
});
