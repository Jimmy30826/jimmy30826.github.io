// Map Configuration
const MAP_BOUNDS = {
    N: 47.56,
    S: 22.95,
    W: 121.96,
    E: 151.58
};
const SVG_VIEWBOX = {
    width: 581.981,
    height: 579.907
};

// Zoom/Pan State
let viewBox = { x: 0, y: 0, w: SVG_VIEWBOX.width, h: SVG_VIEWBOX.height };
let isPanning = false;
let panStart = { x: 0, y: 0 };

// Data Structures
let linesData = {}; // line_cd -> { name, color }
let stationsData = {}; // station_cd -> { name, lon, lat, line_cd }
let graph = {}; // line_cd -> { station_cd -> [adjacent_station_cds] }
let lineStations = {}; // line_cd -> [station_cds]
let selectedLines = []; // order of selected line codes
let linePanels = {}; // line_cd -> panel state

// Circle tracking for zoom-proportional sizing
let stationCircles = []; // all visible circles
const CIRCLE_PX            = 4;    // normal size in screen pixels
const CIRCLE_HOVER_PX      = 8;    // hover size in screen pixels

function getR(hover = false) {
    const svg = ui.mapContainer.querySelector('svg');
    const pixelRadius = hover ? CIRCLE_HOVER_PX : CIRCLE_PX;
    if (!svg) {
        return pixelRadius * (viewBox.w / SVG_VIEWBOX.width);
    }
    const rect = svg.getBoundingClientRect();
    const unitsPerPixel = viewBox.w / rect.width;
    return pixelRadius * unitsPerPixel;
}
function updateCircleRadii() {
    for (const c of stationCircles) {
        c.element.setAttribute('r', getR(c.hovered));
    }
}

// DOM Elements
const ui = {
    lineSearch: document.getElementById('line-search'),
    lineSelect: document.getElementById('line-select'),
    addLineBtn: document.getElementById('add-line-btn'),
    selectedLineList: document.getElementById('selected-line-list'),
    loadingIndicator: document.getElementById('loading-indicator'),
    loadingText: document.getElementById('loading-text'),
    mapContainer: document.getElementById('map-container')
};

// Helper: Convert Lat/Lon to SVG X/Y
const LONGITUDE_SCALE = (SVG_VIEWBOX.width / SVG_VIEWBOX.height) *
    ((MAP_BOUNDS.N - MAP_BOUNDS.S) / (MAP_BOUNDS.E - MAP_BOUNDS.W));

function project(lon, lat) {
    const scaledWidth = SVG_VIEWBOX.width * LONGITUDE_SCALE;
    const xOffset = (SVG_VIEWBOX.width - scaledWidth) / 2;
    const x = ((lon - MAP_BOUNDS.W) / (MAP_BOUNDS.E - MAP_BOUNDS.W)) * scaledWidth + xOffset;
    const y = ((MAP_BOUNDS.N - lat) / (MAP_BOUNDS.N - MAP_BOUNDS.S)) * SVG_VIEWBOX.height;
    return { x, y };
}

// Initialize Application
async function init() {
    try {
        ui.loadingText.textContent = "Loading Map...";
        
        // 1. Load SVG Map
        const mapResponse = await fetch('japan_map_clean.svg');
        const mapText = await mapResponse.text();
        ui.mapContainer.innerHTML = mapText;
        
        // Add overlay layer to SVG
        const svg = ui.mapContainer.querySelector('svg');
        svg.style.cursor = 'grab';
        svg.style.userSelect = 'none';
        const lineLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        lineLayer.setAttribute('id', 'line-layer');
        svg.appendChild(lineLayer);
        const routeLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        routeLayer.setAttribute('id', 'route-layer');
        svg.appendChild(routeLayer);

        // Setup zoom/pan
        setupZoomPan(svg);

        // Tooltip
        const tooltip = document.createElement('div');
        tooltip.className = 'station-tooltip';
        document.body.appendChild(tooltip);
        
        // 2. Load CSV Data
        ui.loadingText.textContent = "Loading Lines...";
        await loadCSV('ekidata/line20260323free.csv', processLines);
        
        ui.loadingText.textContent = "Loading Stations...";
        await loadCSV('ekidata/station20260206free.csv', processStations);
        
        ui.loadingText.textContent = "Loading Connections...";
        await loadCSV('ekidata/join20260226.csv', processJoins);

        // 3. Setup UI
        populateLineSelect();
        setupEventListeners();

        ui.loadingIndicator.classList.add('hidden');
        ui.lineSelect.disabled = false;
        ui.lineSearch.disabled = false;
        ui.addLineBtn.disabled = true;

    } catch (error) {
        console.error("Initialization error:", error);
        ui.loadingText.textContent = "Error loading data.";
        ui.loadingText.style.color = "#ef4444";
    }
}

// CSV Loading Utility
function loadCSV(url, callback) {
    return new Promise((resolve, reject) => {
        Papa.parse(url, {
            download: true,
            header: true,
            skipEmptyLines: true,
            complete: function(results) {
                callback(results.data);
                resolve();
            },
            error: function(err) {
                reject(err);
            }
        });
    });
}

// Processors
function processLines(data) {
    data.forEach(row => {
        linesData[row.line_cd] = {
            name: row.line_name,
            color: row.line_color_c || '#ef4444' // fallback color
        };
        graph[row.line_cd] = {};
        lineStations[row.line_cd] = new Set();
    });
}

function processStations(data) {
    data.forEach(row => {
        stationsData[row.station_cd] = {
            name: row.station_name,
            lon: parseFloat(row.lon),
            lat: parseFloat(row.lat),
            line_cd: row.line_cd
        };
        if (lineStations[row.line_cd]) {
            lineStations[row.line_cd].add(row.station_cd);
        }
    });
}

function processJoins(data) {
    data.forEach(row => {
        const line = row.line_cd;
        const s1 = row.station_cd1;
        const s2 = row.station_cd2;

        if (!graph[line]) graph[line] = {};
        if (!graph[line][s1]) graph[line][s1] = [];
        if (!graph[line][s2]) graph[line][s2] = [];

        // Undirected graph
        graph[line][s1].push(s2);
        graph[line][s2].push(s1);
    });
}

// UI Population
function populateLineSelect(filter = '') {
    ui.lineSelect.innerHTML = '<option value="">Select a line</option>';
    const normalizedFilter = filter.trim().toLowerCase();

    const sortedLines = Object.keys(linesData)
        .filter(lineCd => lineStations[lineCd] && lineStations[lineCd].size > 0)
        .filter(lineCd => {
            if (!normalizedFilter) return true;
            return linesData[lineCd].name.toLowerCase().includes(normalizedFilter);
        })
        .sort((a, b) => linesData[a].name.localeCompare(linesData[b].name));

    sortedLines.forEach(lineCd => {
        const option = document.createElement('option');
        option.value = lineCd;
        option.textContent = linesData[lineCd].name;
        ui.lineSelect.appendChild(option);
    });

    ui.lineSelect.disabled = sortedLines.length === 0;
    ui.addLineBtn.disabled = true;
}

function populateStationSelectsForPanel(lineCd, startSelect, endSelect) {
    startSelect.innerHTML = '<option value="">Select Start</option>';
    endSelect.innerHTML = '<option value="">Select End</option>';

    if (!lineCd) {
        startSelect.disabled = true;
        endSelect.disabled = true;
        return;
    }

    const stations = Array.from(lineStations[lineCd])
        .filter(cd => stationsData[cd])
        .sort((a, b) => stationsData[a].name.localeCompare(stationsData[b].name));

    stations.forEach(cd => {
        const station = stationsData[cd];
        const option = document.createElement('option');
        option.value = cd;
        option.textContent = station.name;
        startSelect.appendChild(option);
        endSelect.appendChild(option.cloneNode(true));
    });

    startSelect.disabled = false;
    endSelect.disabled = false;
}

function createLinePanel(lineCd) {
    const color = linesData[lineCd].color || '#ef4444';
    const displayColor = color.startsWith('#') ? color : '#' + color;
    const panel = document.createElement('div');
    panel.className = 'selected-line-item';
    panel.dataset.lineCd = lineCd;
    panel.innerHTML = `
        <div class="selected-line-header">
            <div class="selected-line-badge" style="background:${displayColor}"></div>
            <div class="selected-line-title">
                <strong>${linesData[lineCd].name}</strong>
                <span>${lineCd}</span>
            </div>
            <button type="button" class="remove-line-btn">삭제</button>
        </div>
        <div class="selected-line-controls">
            <div class="control-group">
                <label>Start Station</label>
                <select class="panel-start-station"></select>
            </div>
            <div class="control-group">
                <label>End Station</label>
                <select class="panel-end-station"></select>
            </div>
        </div>
        <div class="selected-line-actions">
            <button type="button" class="panel-draw-btn">경로 그리기</button>
        </div>
    `;

    const startSelect = panel.querySelector('.panel-start-station');
    const endSelect = panel.querySelector('.panel-end-station');
    const drawBtn = panel.querySelector('.panel-draw-btn');
    const removeBtn = panel.querySelector('.remove-line-btn');

    populateStationSelectsForPanel(lineCd, startSelect, endSelect);

    drawBtn.addEventListener('click', () => {
        const startCd = startSelect.value;
        const endCd = endSelect.value;
        drawLinePanelRoute(lineCd, startCd, endCd);
    });

    removeBtn.addEventListener('click', () => {
        removeSelectedLine(lineCd);
    });

    ui.selectedLineList.appendChild(panel);
    linePanels[lineCd] = { lineCd, panel, routePath: null };
}

function updateSelectedLinePlaceholder() {
    const empty = document.querySelector('.selected-line-empty');
    if (!empty) return;
    empty.style.display = selectedLines.length ? 'none' : 'block';
}

function addSelectedLine(lineCd) {
    if (!lineCd || linePanels[lineCd]) return;
    selectedLines.push(lineCd);
    createLinePanel(lineCd);
    updateSelectedLinePlaceholder();
    drawSelectedLines();
}

function removeSelectedLine(lineCd) {
    delete linePanels[lineCd];
    selectedLines = selectedLines.filter(code => code !== lineCd);
    const panel = ui.selectedLineList.querySelector(`.selected-line-item[data-line-cd="${lineCd}"]`);
    if (panel) panel.remove();
    drawSelectedLines();
    drawRoutes();
}

function drawSelectedLines() {
    clearLineLayer();
    const overlay = document.getElementById('line-layer');
    if (!overlay) return;

    const drawnStations = new Set();
    selectedLines.forEach(lineCd => drawFullLine(lineCd, overlay, drawnStations));
}

function drawRoutes() {
    clearRouteLayer();
    const overlay = document.getElementById('route-layer');
    if (!overlay) return;

    selectedLines.forEach(lineCd => {
        const panel = linePanels[lineCd];
        if (panel?.routePath) {
            drawRoutePath(panel.routePath, lineCd, overlay);
        }
    });
}

function drawLinePanelRoute(lineCd, startCd, endCd) {
    if (!lineCd || !startCd || !endCd) {
        alert('시작역과 도착역을 모두 선택해주세요.');
        return;
    }

    const path = findShortestPath(lineCd, startCd, endCd);
    if (!path) {
        alert('선택한 노선에서 해당 구간 경로를 찾을 수 없습니다.');
        return;
    }

    if (!linePanels[lineCd]) return;
    linePanels[lineCd].routePath = path;
    drawRoutes();
}

function drawRoutePath(path, lineCd, overlay) {
    const points = path.map(cd => {
        const st = stationsData[cd];
        return project(st.lon, st.lat);
    });

    let color = linesData[lineCd].color;
    if (!color.startsWith('#')) color = '#' + color;

    const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    polyline.setAttribute('points', points.map(p => `${p.x},${p.y}`).join(' '));
    polyline.setAttribute('class', 'rail-route');
    polyline.style.setProperty('--route-color', color);

    let totalLength = 0;
    for (let i = 1; i < points.length; i++) {
        const dx = points[i].x - points[i-1].x;
        const dy = points[i].y - points[i-1].y;
        totalLength += Math.sqrt(dx*dx + dy*dy);
    }

    polyline.style.strokeDasharray = totalLength + 50;
    polyline.style.strokeDashoffset = totalLength + 50;
    overlay.appendChild(polyline);

    const tooltip = document.querySelector('.station-tooltip');
    path.forEach((cd, index) => {
        const st = stationsData[cd];
        const pt = points[index];
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', pt.x);
        circle.setAttribute('cy', pt.y);
        circle.setAttribute('r', getR());
        circle.setAttribute('class', 'rail-station');
        circle.style.setProperty('--route-color', color);
        circle.style.animationDelay = `${(index / path.length) * 1.5}s`;

        const state = { element: circle, hovered: false };
        stationCircles.push(state);

        circle.addEventListener('mouseenter', (e) => {
            state.hovered = true;
            circle.setAttribute('r', getR(true));
            tooltip.textContent = st.name;
            tooltip.style.opacity = '1';
            tooltip.style.left = (e.pageX + 10) + 'px';
            tooltip.style.top = (e.pageY + 10) + 'px';
        });
        circle.addEventListener('mousemove', (e) => {
            tooltip.style.left = (e.pageX + 10) + 'px';
            tooltip.style.top = (e.pageY + 10) + 'px';
        });
        circle.addEventListener('mouseleave', () => {
            state.hovered = false;
            circle.setAttribute('r', getR());
            tooltip.style.opacity = '0';
        });

        overlay.appendChild(circle);
    });
}

function clearRouteLayer() {
    const overlay = document.getElementById('route-layer');
    if (overlay) overlay.innerHTML = '';
    stationCircles = [];
}

function clearLineLayer() {
    const overlay = document.getElementById('line-layer');
    if (overlay) overlay.innerHTML = '';
    stationCircles = [];
}

// Event Listeners
function setupEventListeners() {
    ui.lineSearch.addEventListener('input', (e) => {
        populateLineSelect(e.target.value);
    });

    ui.lineSelect.addEventListener('change', (e) => {
        ui.addLineBtn.disabled = !e.target.value;
    });

    ui.addLineBtn.addEventListener('click', () => {
        const lineCd = ui.lineSelect.value;
        addSelectedLine(lineCd);
    });

    document.getElementById('reset-view-btn').addEventListener('click', () => {
        const svg = ui.mapContainer.querySelector('svg');
        if (svg) resetView(svg);
    });
}

// Pathfinding (BFS)
function findShortestPath(lineCd, startCd, endCd) {
    const lineGraph = graph[lineCd];
    if (!lineGraph || !lineGraph[startCd] || !lineGraph[endCd]) return null;

    const queue = [[startCd]];
    const visited = new Set([startCd]);

    while (queue.length > 0) {
        const path = queue.shift();
        const current = path[path.length - 1];

        if (current === endCd) {
            return path;
        }

        for (const neighbor of lineGraph[current]) {
            if (!visited.has(neighbor)) {
                visited.add(neighbor);
                queue.push([...path, neighbor]);
            }
        }
    }
    return null; // No path found
}

// Map Rendering
function clearMap() {
    clearRouteLayer();
    clearLineLayer();
    stationCircles = [];
}

function drawRoute(lineCd, startCd, endCd) {
    clearRouteLayer();
    const overlay = document.getElementById('route-layer');
    const path = findShortestPath(lineCd, startCd, endCd);

    if (!path) {
        alert("No direct path found between these stations on the selected line.");
        return;
    }

    const points = path.map(cd => {
        const st = stationsData[cd];
        return project(st.lon, st.lat);
    });

    // Determine color
    let color = linesData[lineCd].color;
    if (!color.startsWith('#')) color = '#' + color; // Ensure proper hex format if missing

    // Draw Polyline
    const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    polyline.setAttribute('points', points.map(p => `${p.x},${p.y}`).join(' '));
    polyline.setAttribute('class', 'rail-route');
    polyline.style.setProperty('--route-color', color);
    
    // Calculate path length for drawing animation
    // A rough estimate of length to set dasharray
    let totalLength = 0;
    for (let i = 1; i < points.length; i++) {
        const dx = points[i].x - points[i-1].x;
        const dy = points[i].y - points[i-1].y;
        totalLength += Math.sqrt(dx*dx + dy*dy);
    }
    
    polyline.style.strokeDasharray = totalLength + 50;
    polyline.style.strokeDashoffset = totalLength + 50;
    overlay.appendChild(polyline);

    // Draw Stations
    const tooltip = document.querySelector('.station-tooltip');

    path.forEach((cd, index) => {
        const st = stationsData[cd];
        const pt = points[index];
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', pt.x);
        circle.setAttribute('cy', pt.y);
        circle.setAttribute('r', getR());
        circle.setAttribute('class', 'rail-station');
        circle.style.setProperty('--route-color', color);
        circle.style.animationDelay = `${(index / path.length) * 1.5}s`;

        const state = { element: circle, hovered: false };
        stationCircles.push(state);
        routeCircles.push(state);

        // Interaction
        circle.addEventListener('mouseenter', (e) => {
            state.hovered = true;
            circle.setAttribute('r', getR(true));
            tooltip.textContent = st.name;
            tooltip.style.opacity = '1';
            tooltip.style.left = (e.pageX + 10) + 'px';
            tooltip.style.top = (e.pageY + 10) + 'px';
        });
        circle.addEventListener('mousemove', (e) => {
            tooltip.style.left = (e.pageX + 10) + 'px';
            tooltip.style.top = (e.pageY + 10) + 'px';
        });
        circle.addEventListener('mouseleave', () => {
            state.hovered = false;
            circle.setAttribute('r', getR());
            tooltip.style.opacity = '0';
        });

        overlay.appendChild(circle);
    });
}

// ── Draw Full Line ───────────────────────────────────────────
function drawFullLine(lineCd, overlay = null, drawnStations = new Set()) {
    const lineOverlay = overlay || document.getElementById('line-layer');
    if (!lineCd || !graph[lineCd] || !lineOverlay) return;

    let color = linesData[lineCd].color;
    if (!color) color = 'ef4444';
    if (!color.startsWith('#')) color = '#' + color;

    const lineGraph = graph[lineCd];
    const drawnEdges = new Set();

    // Draw edges (each undirected edge once)
    for (const [stCd, neighbors] of Object.entries(lineGraph)) {
        for (const neighborCd of neighbors) {
            const edgeKey = [stCd, neighborCd].sort().join('-');
            if (drawnEdges.has(edgeKey)) continue;
            drawnEdges.add(edgeKey);

            const s1 = stationsData[stCd];
            const s2 = stationsData[neighborCd];
            if (!s1 || !s2) continue;

            const p1 = project(s1.lon, s1.lat);
            const p2 = project(s2.lon, s2.lat);

            const seg = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            seg.setAttribute('x1', p1.x);
            seg.setAttribute('y1', p1.y);
            seg.setAttribute('x2', p2.x);
            seg.setAttribute('y2', p2.y);
            seg.setAttribute('class', 'rail-route-full');
            seg.style.stroke = color;
            lineOverlay.appendChild(seg);
        }
    }

    // Draw station dots
    const tooltip = document.querySelector('.station-tooltip');
    for (const stCd of lineStations[lineCd]) {
        if (drawnStations.has(stCd)) continue;
        drawnStations.add(stCd);

        const st = stationsData[stCd];
        if (!st) continue;
        const pt = project(st.lon, st.lat);

        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', pt.x);
        circle.setAttribute('cy', pt.y);
        circle.setAttribute('r', getR());
        circle.setAttribute('class', 'rail-station-full');
        circle.style.fill = color;

        const state = { element: circle, hovered: false };
        stationCircles.push(state);
        lineCircles.push(state);

        circle.addEventListener('mouseenter', (e) => {
            state.hovered = true;
            circle.setAttribute('r', getR(true));
            tooltip.textContent = st.name;
            tooltip.style.opacity = '1';
            tooltip.style.left = (e.pageX + 10) + 'px';
            tooltip.style.top  = (e.pageY + 10) + 'px';
        });
        circle.addEventListener('mousemove', (e) => {
            tooltip.style.left = (e.pageX + 10) + 'px';
            tooltip.style.top  = (e.pageY + 10) + 'px';
        });
        circle.addEventListener('mouseleave', () => {
            state.hovered = false;
            circle.setAttribute('r', getR());
            tooltip.style.opacity = '0';
        });

        lineOverlay.appendChild(circle);
    }
}

// ── Zoom / Pan ──────────────────────────────────────────────
function applyViewBox(svg) {
    svg.setAttribute('viewBox', `${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`);
    updateCircleRadii();
}

function resetView(svg) {
    viewBox = { x: 0, y: 0, w: SVG_VIEWBOX.width, h: SVG_VIEWBOX.height };
    applyViewBox(svg);
}

function setupZoomPan(svg) {
    const MIN_ZOOM = SVG_VIEWBOX.width / 1000; // ~1000× zoom
    const MAX_ZOOM = SVG_VIEWBOX.width * 2;     // 0.5× out

    // Mouse-wheel zoom (zoom toward cursor)
    svg.addEventListener('wheel', (e) => {
        e.preventDefault();
        const scaleFactor = e.deltaY > 0 ? 1.12 : 1 / 1.12;

        const newW = viewBox.w * scaleFactor;
        const newH = viewBox.h * scaleFactor;
        if (newW > MAX_ZOOM || newW < MIN_ZOOM) return;

        // Mouse position in SVG-coordinate space
        const rect = svg.getBoundingClientRect();
        const mouseX = (e.clientX - rect.left) / rect.width  * viewBox.w + viewBox.x;
        const mouseY = (e.clientY - rect.top)  / rect.height * viewBox.h + viewBox.y;

        // Keep mouse position fixed while scaling
        viewBox.x = mouseX - (mouseX - viewBox.x) * scaleFactor;
        viewBox.y = mouseY - (mouseY - viewBox.y) * scaleFactor;
        viewBox.w = newW;
        viewBox.h = newH;

        applyViewBox(svg);
    }, { passive: false });

    // Drag-to-pan
    svg.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        isPanning = true;
        panStart.x = e.clientX;
        panStart.y = e.clientY;
        svg.style.cursor = 'grabbing';
    });

    window.addEventListener('mousemove', (e) => {
        if (!isPanning) return;
        const rect = svg.getBoundingClientRect();
        const dx = (e.clientX - panStart.x) / rect.width  * viewBox.w;
        const dy = (e.clientY - panStart.y) / rect.height * viewBox.h;
        viewBox.x -= dx;
        viewBox.y -= dy;
        panStart.x = e.clientX;
        panStart.y = e.clientY;
        applyViewBox(svg);
    });

    window.addEventListener('mouseup', () => {
        if (!isPanning) return;
        isPanning = false;
        svg.style.cursor = 'grab';
    });

    window.addEventListener('resize', () => {
        if (svg) applyViewBox(svg);
    });

    // Touch zoom/pan (two-finger pinch + drag)
    let lastTouches = null;
    svg.addEventListener('touchstart', (e) => {
        lastTouches = e.touches;
    }, { passive: true });

    svg.addEventListener('touchmove', (e) => {
        e.preventDefault();
        const touches = e.touches;
        const rect = svg.getBoundingClientRect();

        if (touches.length === 1 && lastTouches.length === 1) {
            // Pan
            const dx = (touches[0].clientX - lastTouches[0].clientX) / rect.width  * viewBox.w;
            const dy = (touches[0].clientY - lastTouches[0].clientY) / rect.height * viewBox.h;
            viewBox.x -= dx;
            viewBox.y -= dy;
            applyViewBox(svg);
        } else if (touches.length === 2 && lastTouches.length >= 2) {
            // Pinch zoom
            const prevDist = Math.hypot(
                lastTouches[0].clientX - lastTouches[1].clientX,
                lastTouches[0].clientY - lastTouches[1].clientY
            );
            const currDist = Math.hypot(
                touches[0].clientX - touches[1].clientX,
                touches[0].clientY - touches[1].clientY
            );
            const scale = prevDist / currDist;
            const midX = ((touches[0].clientX + touches[1].clientX) / 2 - rect.left) / rect.width  * viewBox.w + viewBox.x;
            const midY = ((touches[0].clientY + touches[1].clientY) / 2 - rect.top)  / rect.height * viewBox.h + viewBox.y;

            const newW = viewBox.w * scale;
            const newH = viewBox.h * scale;
            if (newW <= MAX_ZOOM && newW >= MIN_ZOOM) {
                viewBox.x = midX - (midX - viewBox.x) * scale;
                viewBox.y = midY - (midY - viewBox.y) * scale;
                viewBox.w = newW;
                viewBox.h = newH;
                applyViewBox(svg);
            }
        }
        lastTouches = touches;
    }, { passive: false });
}

// Start
init();
