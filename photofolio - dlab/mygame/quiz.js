/* quiz.js - 17차 최종: 노선도 삭제 및 기권 기능 최적화 */
window.foundCount = 0;
window.totalStations = 0;
const params = new URLSearchParams(window.location.search);
const gameMode = params.get('mode') || 'region'; 
const gameVal = params.get('val') || '全国';     

const MAP_CONFIG = {
    N: 47.56, S: 22.95, W: 121.96, E: 151.58, 
    WIDTH: 581.981, HEIGHT: 579.907
};

function getPixels(lat, lon) {
    const x = ((lon - MAP_CONFIG.W) / (MAP_CONFIG.E - MAP_CONFIG.W)) * MAP_CONFIG.WIDTH;
    const y = ((MAP_CONFIG.N - lat) / (MAP_CONFIG.N - MAP_CONFIG.S)) * MAP_CONFIG.HEIGHT;
    return { x, y };
}

let targetStations = stationsData.filter(st => {
    if (gameVal === "全国") return true; 
    if (gameMode === 'region' && st.region === gameVal) return true;
    if (gameMode === 'company' && Array.isArray(st.company) && st.company.includes(gameVal)) return true;
    return false;
});

function calculateDynamicBounds(stations) {
    if (gameVal === "全国" || stations.length === 0) return { x: 0, y: 0, w: MAP_CONFIG.WIDTH, h: MAP_CONFIG.HEIGHT };
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    stations.forEach(st => {
        const p = getPixels(st.lat, st.lon);
        if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
    });
    let w = maxX - minX, h = maxY - minY;
    const r = MAP_CONFIG.WIDTH / MAP_CONFIG.HEIGHT;
    if (w / h > r) h = w / r; else w = h * r;
    const m = Math.max(w, h, 20) * 0.25; 
    return { x: Math.max(0, minX - m), y: Math.max(0, minY - m), w: Math.min(MAP_CONFIG.WIDTH, w + m * 2), h: Math.min(MAP_CONFIG.HEIGHT, h + m * 2) };
}
const activeBounds = calculateDynamicBounds(targetStations);
window.totalStations = targetStations.length;

async function initGame() {
    const inputEl = document.getElementById('station-input');
    const svgWrapper = document.getElementById('svg-wrapper');
    document.getElementById('total-text').innerText = window.totalStations;
    document.getElementById('score-text').innerText = window.foundCount;

    try {
        const res = await fetch('japan_map_clean.svg');
        svgWrapper.innerHTML = await res.text();
        const svg = svgWrapper.querySelector('svg');
        svg.setAttribute('viewBox', `${activeBounds.x} ${activeBounds.y} ${activeBounds.w} ${activeBounds.h}`);
        svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

        const dr = Math.max(0.08, activeBounds.w * 0.005);
        const dotsG = document.createElementNS("http://www.w3.org/2000/svg", "g");
        svg.appendChild(dotsG);

        targetStations.forEach(st => {
            const p = getPixels(st.lat, st.lon);
            const c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            c.setAttribute("cx", p.x); c.setAttribute("cy", p.y); c.setAttribute("r", dr); 
            c.setAttribute("class", "station-dot"); c.id = `dot-${st.id}`;
            dotsG.appendChild(c);
        });
    } catch (e) { console.error(e); }

    // 20차 최종 수정: 버그 수정한 정답 입력 로직
    inputEl.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter') return; 

        const val = inputEl.value.trim();
        // 빈 입력값은 절대 매칭하지 않음 (백스페이스 버그 방지)
        if (!val) return;

        // Katakana -> Hiragana 변환
        const kana = val.replace(/[\u30a1-\u30f6]/g, m => String.fromCharCode(m.charCodeAt(0) - 0x60));
        
        // 해당 이름을 가진 모든 미발견 역 찾기
        const matches = targetStations.filter(st => !st.found && (st.kanji === val || st.kana === kana));
        
        if (matches.length > 0) {
            matches.forEach(match => {
                match.found = true; 
                window.foundCount++;
                
                const dot = document.getElementById(`dot-${match.id}`);
                if (dot) {
                    dot.classList.add('found');
                    dot.style.setProperty('--line-color', match.color || '#fff');
                    dot.setAttribute("r", parseFloat(dot.getAttribute("r")) * 2.5);
                }
            });

            // 점수 업데이트 및 입력창 비우기
            document.getElementById('score-text').innerText = window.foundCount;
            inputEl.value = "";
            
            // 모든 역을 다 찾았는지 확인
            if (window.foundCount === window.totalStations) {
                setTimeout(() => showResult(true), 500);
            }
        }
    });

    inputEl.focus();
}
window.onload = initGame;
