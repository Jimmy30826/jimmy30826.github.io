// SEIC - Server Elevator Information Center (서버승강기정보센터)
// API 연동: https://mcsapi.kn4u.net/evapi (고유번호: 5자리-5자리-2자리)
// 수기 메타데이터: elevators_meta.json 연동 (신규 승강기만 추가, 기존 내용 영구 보존)
// 주기: 6시간 단위 자동 동기화 (21,600,000ms) 및 수동 즉시 동기화 버튼 지원
// -99 시험운행(테스트용) 승강기 특수 처리 로직

document.addEventListener('DOMContentLoaded', () => {
    const API_URL = 'https://mcsapi.kn4u.net/evapi';
    const META_URL = 'elevators_meta.json';
    const SYNC_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6시간 주기

    // undefined / null 안전 처리 헬퍼 함수
    function safeValue(val, fallback = '알수없음') {
        if (val === undefined || val === null || val === '' || val === 'undefined' || val === 'null') {
            return fallback;
        }
        return val;
    }

    // 기본 수기 메타데이터 Fallback
    const fallbackMetadata = {
        "10131-00316-01": {
            "name": "중앙역 광장 1호기 (고속 전망용)",
            "building": "중앙역 복합환승센터",
            "manager": "중앙교통공사 시설관리팀",
            "type": "승객용 / 전망용"
        },
        "10165-10036-01": {
            "name": "센트럴 타워 메인 1호기",
            "building": "센트럴 타워",
            "manager": "센트럴타워 시설관리단",
            "type": "승객용 / 고속"
        },
        "10151-00026-01": {
            "name": "중앙마을 농장연계 셔틀 승강기",
            "building": "중앙마을 거주단지",
            "manager": "마을자치운영위원회",
            "type": "승객용 / 셔틀"
        },
        "00034-10011-01": {
            "name": "동부 광장 18호기",
            "building": "동부 광장 환승센터",
            "manager": "서버인프라관리공단",
            "type": "승객용 / 일반"
        },
        "00088-10011-01": {
            "name": "서부 주거구 19호기",
            "building": "서부 복합주거타운",
            "manager": "서부시설운영처",
            "type": "승객용 / 일반"
        },
        "10014-10009-01": {
            "name": "지하 물류창고 21호 화물리프트",
            "building": "지하 대심도 물류센터",
            "manager": "서버물류개발공사",
            "type": "화물용 / 리프트"
        },
        "10165-10036-99": {
            "name": "센트럴 타워 R&D 시험기 (-99)",
            "building": "센트럴 타워 실험구역",
            "manager": "기술개발팀 (테스트)",
            "type": "시험운행 / 테스트용"
        }
    };

    // API 응답 데이터 기본 Fallback
    const fallbackApiData = {
        "00034-10011-01": {
            "id": 18,
            "serial": "00034-10011-01",
            "delay": 2,
            "elevator_door": { "dx": 1, "dy": 2, "dz": 0, "x": 33, "z": -12, "y": -33 },
            "bounds": {
                "size": { "dz": 1, "dx": 1, "dy": 4 },
                "point0": { "x": 34, "z": -11, "y": -30 },
                "min": { "x": 33, "z": -12, "y": -34 },
                "point1": { "x": 33, "z": -12, "y": -34 }
            },
            "rope": { "start": { "x": 33, "z": -11, "y": -29 }, "end": { "x": 33, "z": -11, "y": -8 } },
            "floors": [
                { "floor_number": "-1", "display_name": "F", "y": -34, "has_call_button": 1, "has_door": 1 },
                { "floor_number": "1", "display_name": "1F", "y": -13, "has_call_button": 1, "has_door": 1 }
            ]
        },
        "10131-00316-01": {
            "id": 23,
            "serial": "10131-00316-01",
            "delay": 1,
            "elevator_door": { "dx": 3, "dy": 2, "dz": 0, "x": -134, "z": 319, "y": -62 },
            "bounds": {
                "size": { "dz": 3, "dx": 3, "dy": 4 },
                "point0": { "x": -131, "z": 316, "y": -59 },
                "min": { "x": -134, "z": 316, "y": -63 },
                "point1": { "x": -134, "z": 319, "y": -63 }
            },
            "rope": { "start": { "x": -132, "z": 318, "y": -58 }, "end": { "x": -133, "z": 317, "y": 318 } },
            "floors": [
                { "floor_number": "-1", "display_name": "???", "y": -63, "has_call_button": 1, "has_door": 1 },
                { "floor_number": "1", "display_name": "Ground", "y": -13, "has_call_button": 1, "has_door": 1 },
                { "floor_number": "2", "display_name": "subway", "y": 40, "has_call_button": 1, "has_door": 1 },
                { "floor_number": "3", "display_name": "Café & Skywalk", "y": 200, "has_call_button": 1, "has_door": 1 },
                { "floor_number": "4", "display_name": "256!!!!!!", "y": 255, "has_call_button": 1, "has_door": 1 },
                { "floor_number": "5", "display_name": "observation deck", "y": 313, "has_call_button": 1, "has_door": 1 }
            ]
        },
        "10151-00026-01": {
            "id": 24,
            "serial": "10151-00026-01",
            "delay": 3,
            "elevator_door": { "dx": 0, "dy": 2, "dz": 2, "x": -151, "z": 27, "y": -42 },
            "bounds": {
                "size": { "dz": 4, "dx": 3, "dy": 4 },
                "point0": { "x": -151, "z": 26, "y": -39 },
                "min": { "x": -154, "z": 26, "y": -43 },
                "point1": { "x": -154, "z": 30, "y": -43 }
            },
            "rope": { "start": { "x": -154, "z": 26, "y": -38 }, "end": { "x": -151, "z": 30, "y": -6 } },
            "floors": [
                { "floor_number": "-2", "display_name": "underground / farm", "y": -43, "has_call_button": 1, "has_door": 1 },
                { "floor_number": "-1", "display_name": "village", "y": -19, "has_call_button": 1, "has_door": 1 },
                { "floor_number": "1", "display_name": "ground&subway", "y": -13, "has_call_button": 1, "has_door": 1 }
            ]
        },
        "10165-10036-99": {
            "id": 5,
            "serial": "10165-10036-99",
            "delay": 0,
            "elevator_door": { "dx": 0, "dy": 1, "dz": 1, "x": -162, "z": -38, "y": -12 },
            "bounds": {
                "size": { "dz": 3, "dx": 3, "dy": 3 },
                "point0": { "x": -165, "z": -36, "y": -10 },
                "min": { "x": -165, "z": -39, "y": -13 },
                "point1": { "x": -162, "z": -39, "y": -13 }
            },
            "rope": { "start": { "x": -163, "z": -38, "y": -9 }, "end": { "x": -164, "z": -37, "y": 54 } },
            "floors": [
                { "floor_number": "1", "display_name": "1F (테스트)", "y": -13, "has_call_button": 1, "has_door": 1 },
                { "floor_number": "8", "display_name": "8F (테스트)", "y": 51, "has_call_button": 1, "has_door": 1 }
            ]
        },
        "00088-10011-01": {
            "id": 19,
            "serial": "00088-10011-01",
            "delay": 2,
            "elevator_door": { "dx": 1, "dy": 2, "dz": 0, "x": 87, "z": -12, "y": -33 },
            "bounds": {
                "size": { "dz": 1, "dx": 1, "dy": 4 },
                "point0": { "x": 88, "z": -11, "y": -30 },
                "min": { "x": 87, "z": -12, "y": -34 },
                "point1": { "x": 87, "z": -12, "y": -34 }
            },
            "rope": { "start": { "x": 87, "z": -11, "y": -29 }, "end": { "x": 87, "z": -11, "y": -8 } },
            "floors": [
                { "floor_number": "-1", "display_name": "B1F", "y": -34, "has_call_button": 1, "has_door": 1 },
                { "floor_number": "1", "display_name": "1F", "y": -13, "has_call_button": 1, "has_door": 1 }
            ]
        },
        "10165-10036-01": {
            "id": 5,
            "serial": "10165-10036-01",
            "delay": 0,
            "elevator_door": { "dx": 0, "dy": 1, "dz": 1, "x": -162, "z": -38, "y": -12 },
            "bounds": {
                "size": { "dz": 3, "dx": 3, "dy": 3 },
                "point0": { "x": -165, "z": -36, "y": -10 },
                "min": { "x": -165, "z": -39, "y": -13 },
                "point1": { "x": -162, "z": -39, "y": -13 }
            },
            "rope": { "start": { "x": -163, "z": -38, "y": -9 }, "end": { "x": -164, "z": -37, "y": 54 } },
            "floors": [
                { "floor_number": "1", "display_name": "1F (로비)", "y": -13, "has_call_button": 1, "has_door": 1 },
                { "floor_number": "2", "display_name": "2F", "y": 1, "has_call_button": 1, "has_door": 1 },
                { "floor_number": "3", "display_name": "3F", "y": 9, "has_call_button": 1, "has_door": 1 },
                { "floor_number": "4", "display_name": "4F", "y": 19, "has_call_button": 1, "has_door": 1 },
                { "floor_number": "5", "display_name": "5F", "y": 29, "has_call_button": 1, "has_door": 1 },
                { "floor_number": "6", "display_name": "6F", "y": 39, "has_call_button": 1, "has_door": 1 },
                { "floor_number": "7", "display_name": "7F", "y": 46, "has_call_button": 1, "has_door": 1 },
                { "floor_number": "8", "display_name": "8F (스카이라운지)", "y": 51, "has_call_button": 1, "has_door": 1 }
            ]
        },
        "10014-10009-01": {
            "id": 21,
            "serial": "10014-10009-01",
            "delay": 4,
            "elevator_door": { "dx": 1, "dy": 1, "dz": 0, "x": -13, "z": -6, "y": -23 },
            "bounds": {
                "size": { "dz": 3, "dx": 3, "dy": 3 },
                "point0": { "x": -14, "z": -9, "y": -21 },
                "min": { "x": -14, "z": -9, "y": -24 },
                "point1": { "x": -11, "z": -6, "y": -24 }
            },
            "rope": { "start": { "x": -13, "z": -7, "y": -20 }, "end": { "x": -12, "z": -8, "y": -9 } },
            "floors": [
                { "floor_number": "-1", "display_name": "B1F 지하구역", "y": -24, "has_call_button": 1, "has_door": 1 },
                { "floor_number": "1", "display_name": "1F 지상", "y": -13, "has_call_button": 1, "has_door": 1 }
            ]
        }
    };

    let elevatorList = [];
    let customMetadata = {};

    // DOM Elements
    const searchInput = document.getElementById('search-input');
    const searchForm = document.getElementById('search-form');
    const searchClearBtn = document.getElementById('search-clear-btn');
    const searchTabBtns = document.querySelectorAll('.search-tab-btn');
    const resultsGrid = document.getElementById('results-grid');
    const resultCount = document.getElementById('result-count');
    const emptyState = document.getElementById('empty-results');
    const statusFilter = document.getElementById('status-filter');
    const typeFilter = document.getElementById('type-filter');
    const quickTagBtns = document.querySelectorAll('.tag-btn');
    const modalBackdrop = document.getElementById('detail-modal');
    const modalCloseBtn = document.getElementById('modal-close-btn');
    const manualSyncBtn = document.getElementById('btn-manual-sync');

    let currentTab = 'all';

    // Parse raw API data and merge with manual metadata (elevators_meta.json)
    function parseApiData(rawJson, metaJson) {
        const parsed = [];
        if (!rawJson || typeof rawJson !== 'object') return parsed;

        const serials = rawJson.serial || Object.keys(rawJson).filter(k => k !== 'serial');
        const allSerials = Array.from(new Set([...serials, ...Object.keys(metaJson || {})]));

        allSerials.forEach(serial => {
            const ev = rawJson[serial] || {};
            const meta = (metaJson && metaJson[serial]) ? metaJson[serial] : {};

            const isTest = String(serial).endsWith('-99');
            const evId = ev.id !== undefined ? ev.id : (isTest ? 99 : '알수없음');
            const bounds = ev.bounds || {};
            const min = bounds.min || null;
            const size = bounds.size || null;
            const door = ev.elevator_door || null;
            const rope = ev.rope || null;
            const floors = Array.isArray(ev.floors) ? ev.floors : [];

            // 1. 위치 좌표 (Location Coordinates)
            let locationText = '알수없음';
            let coordsObj = { x: '알수없음', y: '알수없음', z: '알수없음' };
            if (min && min.x !== undefined && min.y !== undefined && min.z !== undefined) {
                locationText = `X: ${min.x}, Y: ${min.y}, Z: ${min.z}`;
                coordsObj = { x: min.x, y: min.y, z: min.z };
            }

            // 2. 승강기 크기 (Elevator Car / Cabin Dimensions)
            let carDimensions = '알수없음';
            let carVolume = '';
            if (size && size.dx !== undefined && size.dy !== undefined && size.dz !== undefined) {
                const widthX = size.dx + 1;
                const depthZ = size.dz + 1;
                const heightY = size.dy;
                carDimensions = `가로 ${widthX}m × 세로 ${depthZ}m (높이 ${heightY}m)`;
                carVolume = `${widthX}×${depthZ}×${heightY}m`;
            }

            // 3. 문 크기 (Door Dimensions)
            let doorDimensions = '알수없음';
            let doorShort = '';
            if (door && (door.dx !== undefined || door.dz !== undefined) && door.dy !== undefined) {
                const doorWidth = Math.max(door.dx || 0, door.dz || 0) + 1;
                const doorHeight = (door.dy || 0) + 1;
                doorDimensions = `가로 ${doorWidth}m × 높이 ${doorHeight}m`;
                doorShort = `${doorWidth}×${doorHeight}m`;
            }

            // 4. 승강로 길이 및 운행 행정 (Hoistway Length & Travel Range)
            let hoistwayLengthText = '알수없음';
            let hoistwayShort = '알수없음';
            let travelRangeText = '알수없음';

            if (rope && rope.start && rope.end && rope.start.y !== undefined && rope.end.y !== undefined) {
                const startY = Number(rope.start.y);
                const endY = Number(rope.end.y);
                const diff = Math.abs(endY - startY);
                hoistwayLengthText = `${diff}m (Y: ${Math.min(startY, endY)} ~ ${Math.max(startY, endY)})`;
                hoistwayShort = `${diff}m`;
            }

            if (floors.length > 0) {
                const floorYList = floors.map(f => Number(f.y)).filter(y => !isNaN(y));
                if (floorYList.length > 0) {
                    const minY = Math.min(...floorYList);
                    const maxY = Math.max(...floorYList);
                    const travelDiff = maxY - minY;
                    travelRangeText = `${travelDiff}m (Y: ${minY} ~ ${maxY})`;
                    if (hoistwayLengthText === '알수없음') {
                        hoistwayLengthText = `${travelDiff}m (Y: ${minY} ~ ${maxY})`;
                        hoistwayShort = `${travelDiff}m`;
                    }
                }
            }

            // 5. 운행 층수 및 층 명칭 정리
            const floorCount = floors.length;
            const floorNames = floors.map(f => {
                const num = safeValue(f.floor_number, '');
                const name = f.display_name ? ` (${f.display_name})` : '';
                return num ? `${num}F${name}` : safeValue(f.display_name, '');
            }).filter(Boolean);

            let floorRange = '알수없음';
            if (floorCount > 0) {
                const firstF = safeValue(floors[0].floor_number, '최저');
                const lastF = safeValue(floors[floorCount - 1].floor_number, '최고');
                floorRange = `${firstF}F ~ ${lastF}F (총 ${floorCount}개 층)`;
            }

            // 6. 속도 (Speed) - API 'delay' 및 'speed' 필드에서 직접 조회 및 계산
            let speedText = '알수없음';
            let speedValue = null;

            if (ev.delay !== undefined && ev.delay !== null) {
                const tickDelay = Number(ev.delay);
                const mps = (20 / (tickDelay + 1)).toFixed(1);
                const mpm = Math.round((20 / (tickDelay + 1)) * 60);
                speedText = `${mpm} m/min (${mps} m/s, 딜레이 ${tickDelay}t)`;
                speedValue = mpm;
            } else if (ev.speed !== undefined && ev.speed !== null) {
                speedText = `${ev.speed}`;
            } else if (meta.speed) {
                speedText = meta.speed;
            }

            // 7. 이름, 건물, 관리주체, 용도 (수기 메타데이터 반영 - 기존 내용 절대 보존)
            let autoName = meta.name || (evId !== '알수없음' ? `서버 승강기 ${evId}호기` : '서버 승강기');
            let buildingName = meta.building || (locationText !== '알수없음' ? `서버 복합구역 (${coordsObj.x}, ${coordsObj.z})` : '미지정 (수기입력 필요)');
            let managerName = meta.manager || (isTest ? '기술개발팀 (테스트)' : '미지정 (수기입력 필요)');
            let typeName = meta.type || (isTest ? '시험운행 / 테스트용' : (floorCount >= 5 ? '승객용 / 전망용' : '승객용'));

            // 8. 상태 처리 (-99 시험운행 특수 처리)
            let status = 'normal';
            let statusText = '정상운행';

            if (isTest) {
                status = 'test';
                statusText = '시험운행 (테스트)';
            }

            parsed.push({
                serial: safeValue(serial, '알수없음'),
                isTest: isTest,
                id: evId,
                delay: ev.delay !== undefined ? ev.delay : '알수없음',
                name: autoName,
                building: buildingName,
                manager: managerName,
                location: locationText,
                coords: coordsObj,
                carDimensions: carDimensions,
                carVolume: carVolume,
                doorDimensions: doorDimensions,
                doorShort: doorShort,
                hoistwayLength: hoistwayLengthText,
                hoistwayShort: hoistwayShort,
                travelRange: travelRangeText,
                speed: speedText,
                speedValue: speedValue,
                floors: floors,
                floorCount: floorCount,
                floorRange: floorRange,
                floorNamesText: floorNames.join(' / '),
                type: typeName,
                status: status,
                statusText: statusText,
                datapackId: evId !== '알수없음' ? `customizable_elevators:ev_${evId}` : '알수없음'
            });
        });

        return parsed;
    }

    // Fetch data from live API & elevators_meta.json
    async function loadData() {
        // 1. Fetch metadata JSON
        try {
            const metaRes = await fetch(META_URL, { cache: 'no-cache' });
            if (metaRes.ok) {
                customMetadata = await metaRes.json();
            } else {
                customMetadata = fallbackMetadata;
            }
        } catch (err) {
            console.warn('Metadata JSON fetch failed, using fallback metadata:', err);
            customMetadata = fallbackMetadata;
        }

        // 2. Fetch live API data
        try {
            const res = await fetch(API_URL, { cache: 'no-cache' });
            if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
            const data = await res.json();
            elevatorList = parseApiData(data, customMetadata);
        } catch (err) {
            console.warn('Live API fetch failed, loading fallback data:', err);
            elevatorList = parseApiData(fallbackApiData, customMetadata);
        }

        // Update last sync time
        const now = new Date();
        const timeStr = now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
        localStorage.setItem('seic_last_sync', now.toISOString());

        const syncTimeEl = document.getElementById('last-sync-time');
        if (syncTimeEl) {
            syncTimeEl.textContent = `최근 동기화: ${timeStr} (6시간 주기)`;
        }

        updateStats();
        filterAndRender();
    }

    // Manual sync button trigger
    if (manualSyncBtn) {
        manualSyncBtn.addEventListener('click', async () => {
            const originalHtml = manualSyncBtn.innerHTML;
            manualSyncBtn.innerHTML = '동기화중...';
            manualSyncBtn.disabled = true;
            await loadData();
            setTimeout(() => {
                manualSyncBtn.innerHTML = originalHtml;
                manualSyncBtn.disabled = false;
            }, 600);
        });
    }

    // Set 6-hour periodic polling interval
    setInterval(loadData, SYNC_INTERVAL_MS);

    // Update stats bar
    function updateStats() {
        const total = elevatorList.length;
        const runningCount = elevatorList.filter(e => e.status === 'normal').length;
        const totalFloors = elevatorList.reduce((acc, cur) => acc + (cur.floorCount || 0), 0);

        const statTotal = document.getElementById('stat-total-count');
        const statRunning = document.getElementById('stat-running-count');
        const statFloors = document.getElementById('stat-floors-count');

        if (statTotal) statTotal.innerHTML = `${total}<small>대</small>`;
        if (statRunning) statRunning.innerHTML = `${runningCount}<small>대</small>`;
        if (statFloors) statFloors.innerHTML = `${totalFloors}<small>개 층</small>`;
    }

    // Tab switching
    searchTabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            searchTabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentTab = btn.dataset.tab;

            switch (currentTab) {
                case 'id':
                    searchInput.placeholder = "승강기 고유번호 (예: 10131-00316-01, 10165-10036-99)";
                    break;
                case 'building':
                    searchInput.placeholder = "건물명 또는 운영주체를 입력하세요 (예: 중앙역, 센트럴 타워, 관리단)";
                    break;
                case 'coord':
                    searchInput.placeholder = "서버 좌표를 입력하세요 (예: -134, 316, 33, -154)";
                    break;
                case 'specs':
                    searchInput.placeholder = "속도, 크기, 문 크기, 승강로를 검색하세요 (예: 1200, 600 m/min, 4m, 376m)";
                    break;
                default:
                    searchInput.placeholder = "고유번호(5-5-2), 건물/위치명, 운영주체, 속도, 크기를 입력하세요";
            }

            searchInput.focus();
            filterAndRender();
        });
    });

    // Search input listeners
    searchInput.addEventListener('input', () => {
        if (searchInput.value.trim().length > 0) {
            searchClearBtn.style.display = 'block';
        } else {
            searchClearBtn.style.display = 'none';
        }
        filterAndRender();
    });

    searchClearBtn.addEventListener('click', () => {
        searchInput.value = '';
        searchClearBtn.style.display = 'none';
        searchInput.focus();
        filterAndRender();
    });

    searchForm.addEventListener('submit', (e) => {
        e.preventDefault();
        filterAndRender();

        const resultsSection = document.getElementById('results-section');
        if (resultsSection) {
            resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    });

    if (statusFilter) statusFilter.addEventListener('change', filterAndRender);
    if (typeFilter) typeFilter.addEventListener('change', filterAndRender);

    // Quick tag buttons
    quickTagBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const query = btn.dataset.query || btn.textContent.replace('#', '').trim();
            searchInput.value = query;
            searchClearBtn.style.display = 'block';
            searchInput.focus();
            filterAndRender();

            const resultsSection = document.getElementById('results-section');
            if (resultsSection) {
                resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    });

    // Filter & Render
    function filterAndRender() {
        const query = searchInput.value.trim().toLowerCase();
        const selectedStatus = statusFilter ? statusFilter.value : 'all';
        const selectedType = typeFilter ? typeFilter.value : 'all';

        const filtered = elevatorList.filter(item => {
            // Status filter (normal, test, inspecting, stopped)
            if (selectedStatus !== 'all' && item.status !== selectedStatus) {
                return false;
            }

            // Type filter
            if (selectedType !== 'all') {
                if (selectedType === 'passenger' && !item.type.includes('승객용')) return false;
                if (selectedType === 'freight' && !item.type.includes('화물용')) return false;
                if (selectedType === 'emergency' && !item.type.includes('비상용') && !item.type.includes('셔틀')) return false;
                if (selectedType === 'test' && !item.isTest) return false;
            }

            if (!query) return true;

            const cleanQuery = query.replace(/[^0-9a-zA-Z가-힣]/g, '');

            if (currentTab === 'id') {
                const cleanSerial = item.serial.replace(/-/g, '').toLowerCase();
                return cleanSerial.includes(cleanQuery) || item.serial.toLowerCase().includes(query) || String(item.id).includes(query);
            } else if (currentTab === 'building') {
                return (
                    item.building.toLowerCase().includes(query) ||
                    item.name.toLowerCase().includes(query) ||
                    item.manager.toLowerCase().includes(query)
                );
            } else if (currentTab === 'coord') {
                return item.location.toLowerCase().includes(query);
            } else if (currentTab === 'specs') {
                return (
                    item.speed.toLowerCase().includes(query) ||
                    item.carDimensions.toLowerCase().includes(query) ||
                    item.doorDimensions.toLowerCase().includes(query) ||
                    item.hoistwayLength.toLowerCase().includes(query) ||
                    item.carVolume.toLowerCase().includes(query) ||
                    item.doorShort.toLowerCase().includes(query)
                );
            } else {
                const cleanSerial = item.serial.replace(/-/g, '').toLowerCase();
                return (
                    cleanSerial.includes(cleanQuery) ||
                    item.serial.toLowerCase().includes(query) ||
                    String(item.id).includes(query) ||
                    item.name.toLowerCase().includes(query) ||
                    item.building.toLowerCase().includes(query) ||
                    item.manager.toLowerCase().includes(query) ||
                    item.location.toLowerCase().includes(query) ||
                    item.type.toLowerCase().includes(query) ||
                    item.speed.toLowerCase().includes(query) ||
                    item.carDimensions.toLowerCase().includes(query) ||
                    item.doorDimensions.toLowerCase().includes(query) ||
                    item.hoistwayLength.toLowerCase().includes(query) ||
                    item.floorNamesText.toLowerCase().includes(query)
                );
            }
        });

        renderResults(filtered);
    }

    // Render result cards
    function renderResults(list) {
        resultCount.textContent = `${list.length}건`;

        if (list.length === 0) {
            resultsGrid.style.display = 'none';
            emptyState.style.display = 'block';
            return;
        }

        resultsGrid.style.display = 'grid';
        emptyState.style.display = 'none';

        resultsGrid.innerHTML = list.map(item => {
            let statusClass = 'normal';
            let idBadgeClass = '';

            if (item.isTest) {
                statusClass = 'test';
                idBadgeClass = 'test';
            } else if (item.status === 'inspecting') {
                statusClass = 'inspecting';
            } else if (item.status === 'stopped') {
                statusClass = 'stopped';
            }

            return `
                <article class="ev-card" data-serial="${item.serial}" tabindex="0">
                    <div class="ev-card-head">
                        <span class="ev-id-badge ${idBadgeClass}">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                                <rect x="3" y="3" width="18" height="18" rx="2"/>
                                <path d="M7 7h.01M7 17h.01M17 7h.01M17 17h.01"/>
                            </svg>
                            ${item.serial}
                        </span>
                        <span class="ev-status ${statusClass}">
                            ● ${item.statusText}
                        </span>
                    </div>

                    <h3 class="ev-name">${item.name}</h3>
                    <div class="ev-location">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                            <circle cx="12" cy="10" r="3"/>
                        </svg>
                        <span>${item.building} (${item.location})</span>
                    </div>

                    <div class="ev-specs-grid">
                        <div class="spec-cell">
                            <span class="spec-title">운행 속도 (API)</span>
                            <span class="spec-data" style="color: #2563eb;">${item.speed}</span>
                        </div>
                        <div class="spec-cell">
                            <span class="spec-title">승강로 길이</span>
                            <span class="spec-data">${item.hoistwayLength}</span>
                        </div>
                        <div class="spec-cell">
                            <span class="spec-title">승강기(카) 크기</span>
                            <span class="spec-data">${item.carDimensions}</span>
                        </div>
                        <div class="spec-cell">
                            <span class="spec-title">문(도어) 크기</span>
                            <span class="spec-data">${item.doorDimensions}</span>
                        </div>
                    </div>

                    <div class="ev-card-foot">
                        <span class="ev-manager-text">운영: ${item.manager}</span>
                        <span class="btn-detail">
                            상세 스펙 조회
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                                <path d="M5 12h14M12 5l7 7-7 7"/>
                            </svg>
                        </span>
                    </div>
                </article>
            `;
        }).join('');

        // Modal triggers
        document.querySelectorAll('.ev-card').forEach(card => {
            card.addEventListener('click', () => {
                const serial = card.dataset.serial;
                const item = elevatorList.find(e => e.serial === serial);
                if (item) openModal(item);
            });
            card.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    const serial = card.dataset.serial;
                    const item = elevatorList.find(e => e.serial === serial);
                    if (item) openModal(item);
                }
            });
        });
    }

    // Modal display
    function openModal(item) {
        document.getElementById('modal-cert-id').textContent = safeValue(item.serial);
        document.getElementById('modal-ev-name').textContent = safeValue(item.name);
        document.getElementById('modal-building').textContent = safeValue(item.building);
        document.getElementById('modal-location').textContent = safeValue(item.location);
        document.getElementById('modal-floors').textContent = safeValue(item.floorRange);
        document.getElementById('modal-type').textContent = safeValue(item.type);
        document.getElementById('modal-car-dimensions').textContent = safeValue(item.carDimensions);
        document.getElementById('modal-door-dimensions').textContent = safeValue(item.doorDimensions);
        document.getElementById('modal-hoistway').textContent = safeValue(item.hoistwayLength);
        document.getElementById('modal-speed').textContent = safeValue(item.speed);
        document.getElementById('modal-status').textContent = safeValue(item.statusText);
        document.getElementById('modal-manager').textContent = safeValue(item.manager);
        document.getElementById('modal-datapack-id').textContent = safeValue(item.datapackId);

        // Test modal style
        const certPlate = document.querySelector('.cert-plate');
        if (certPlate) {
            if (item.isTest) {
                certPlate.classList.add('test');
            } else {
                certPlate.classList.remove('test');
            }
        }

        // Render floor table in modal
        const floorTableBody = document.getElementById('modal-floor-list-tbody');
        if (floorTableBody) {
            if (item.floors && item.floors.length > 0) {
                floorTableBody.innerHTML = item.floors.map(f => {
                    const fNum = safeValue(f.floor_number, '-');
                    const fName = safeValue(f.display_name, '-');
                    const fY = f.y !== undefined ? `Y: ${f.y}` : '알수없음';
                    const hasBtn = f.has_call_button ? '있음 (O)' : '없음 (X)';
                    const hasDoor = f.has_door ? '설치됨 (O)' : '미설치 (X)';
                    return `
                        <tr>
                            <td style="font-weight: 700; text-align: center;">${fNum}${fNum !== '-' ? 'F' : ''}</td>
                            <td>${fName}</td>
                            <td style="font-family: var(--font-mono); text-align: center;">${fY}</td>
                            <td style="text-align: center;">${hasBtn}</td>
                            <td style="text-align: center;">${hasDoor}</td>
                        </tr>
                    `;
                }).join('');
            } else {
                floorTableBody.innerHTML = `
                    <tr>
                        <td colspan="5" style="text-align: center; color: var(--slate-400); padding: 18px;">
                            등록된 층별 상세 정보가 없습니다.
                        </td>
                    </tr>
                `;
            }
        }

        modalBackdrop.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function closeModal() {
        modalBackdrop.classList.remove('active');
        document.body.style.overflow = '';
    }

    if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeModal);
    if (modalBackdrop) {
        modalBackdrop.addEventListener('click', (e) => {
            if (e.target === modalBackdrop) closeModal();
        });
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modalBackdrop.classList.contains('active')) {
            closeModal();
        }
    });

    // Copy ID button in modal
    const copyBtn = document.getElementById('btn-copy-id');
    if (copyBtn) {
        copyBtn.addEventListener('click', () => {
            const id = document.getElementById('modal-cert-id').textContent;
            navigator.clipboard.writeText(id).then(() => {
                const originalText = copyBtn.textContent;
                copyBtn.textContent = "복사 완료!";
                setTimeout(() => {
                    copyBtn.textContent = originalText;
                }, 1500);
            });
        });
    }

    // Reset search button
    const resetBtn = document.getElementById('btn-reset-search');
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            searchInput.value = '';
            if (statusFilter) statusFilter.value = 'all';
            if (typeFilter) typeFilter.value = 'all';
            searchClearBtn.style.display = 'none';
            searchTabBtns[0].click();
            filterAndRender();
        });
    }

    // Start loading data
    loadData();
});
