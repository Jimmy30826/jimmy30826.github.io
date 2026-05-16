const chatMessages = document.getElementById('chat-messages');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const settingsBtn = document.getElementById('settings-btn');
const settingsModal = document.getElementById('settings-modal');
const closeModalBtn = document.getElementById('close-modal-btn');
const gpsBtn = document.getElementById('gps-btn');
const sidoSelect = document.getElementById('sido-select');
const sigunguSelect = document.getElementById('sigungu-select');
const dongSelect = document.getElementById('dong-select');
const weatherInfoBox = document.getElementById('weather-info-box');
const saveLocationBtn = document.getElementById('save-location-btn');
const weatherBackground = document.getElementById('weather-background');
const manualWeatherSelect = document.getElementById('manual-weather-select');
const chatToggleBtn = document.getElementById('chat-toggle-btn');
const chatContainer = document.getElementById('chat-container');

// API Key Modal Elements
const apiKeyModal = document.getElementById('api-key-modal');
const geminiKeyInput = document.getElementById('gemini-key-input');
const weatherKeyInput = document.getElementById('weather-key-input');
const saveApiKeysBtn = document.getElementById('save-api-keys-btn');

let geminiApiKey = null;
let publicDataApiKey = null;
let chatHistory = [];
let currentLocation = { nx: null, ny: null, name: '현재 위치' };

// LCC DFS 변환 함수 (기상청 위경도 -> 격자 변환)
const RE = 6371.00877; 
const GRID = 5.0;      
const SLAT1 = 30.0;    
const SLAT2 = 60.0;    
const OLON = 126.0;    
const OLAT = 38.0;     
const XO = 43;         
const YO = 136;        

function dfs_xy_conv(v1, v2) {
    const DEGRAD = Math.PI / 180.0;
    const re = RE / GRID;
    const slat1 = SLAT1 * DEGRAD;
    const slat2 = SLAT2 * DEGRAD;
    const olon = OLON * DEGRAD;
    const olat = OLAT * DEGRAD;

    let sn = Math.tan(Math.PI * 0.25 + slat2 * 0.5) / Math.tan(Math.PI * 0.25 + slat1 * 0.5);
    sn = Math.log(Math.cos(slat1) / Math.cos(slat2)) / Math.log(sn);
    let sf = Math.tan(Math.PI * 0.25 + slat1 * 0.5);
    sf = Math.pow(sf, sn) * Math.cos(slat1) / sn;
    let ro = Math.tan(Math.PI * 0.25 + olat * 0.5);
    ro = re * sf / Math.pow(ro, sn);

    let ra = Math.tan(Math.PI * 0.25 + (v1) * DEGRAD * 0.5);
    ra = re * sf / Math.pow(ra, sn);
    let theta = v2 * DEGRAD - olon;
    if (theta > Math.PI) theta -= 2.0 * Math.PI;
    if (theta < -Math.PI) theta += 2.0 * Math.PI;
    theta *= sn;

    return {
        nx: Math.floor(ra * Math.sin(theta) + XO + 0.5),
        ny: Math.floor(ro - ra * Math.cos(theta) + YO + 0.5)
    };
}

// 앱 초기화 로직
function initAppWithKeys() {
    messageInput.disabled = false;
    getGPSWeather();
    loadSido();
}

// API 키 로드
function loadApiKeys() {
    try {
        if (typeof CONFIG === 'undefined' || !CONFIG.gemini_api_key) {
            throw new Error('API keys not found');
        }
        geminiApiKey = CONFIG.gemini_api_key;
        publicDataApiKey = CONFIG.public_data_portal_api_key || null;
        
        initAppWithKeys();
    } catch (error) {
        // 설정 파일이 없거나 오류 발생 시, 모달 띄우기
        messageInput.disabled = true;
        apiKeyModal.classList.add('active');
    }
}

// 임시 API 키 저장 로직
saveApiKeysBtn.addEventListener('click', () => {
    const gKey = geminiKeyInput.value.trim();
    const wKey = weatherKeyInput.value.trim();
    
    if(!gKey) {
        alert('Gemini API 키는 필수입니다.');
        return;
    }
    
    geminiApiKey = gKey;
    publicDataApiKey = wKey || null;
    
    apiKeyModal.classList.remove('active');
    initAppWithKeys();
});

// ---------------- 챗봇 및 설정 모달 토글 로직 ----------------
settingsBtn.addEventListener('click', () => settingsModal.classList.add('active'));
closeModalBtn.addEventListener('click', () => settingsModal.classList.remove('active'));

chatToggleBtn.addEventListener('click', () => {
    chatContainer.classList.toggle('hidden');
    if(!chatContainer.classList.contains('hidden')) {
        messageInput.focus();
    }
});

gpsBtn.addEventListener('click', getGPSWeather);

async function loadSido() {
    const res = await fetch('https://grpc-proxy-server-mkvo6j4wsq-du.a.run.app/v1/regcodes?regcode_pattern=*00000000');
    const data = await res.json();
    sidoSelect.innerHTML = '<option value="">시/도 선택</option>';
    data.regcodes.forEach(reg => {
        if(reg.name) {
            const opt = document.createElement('option');
            opt.value = reg.code.substring(0, 2);
            opt.textContent = reg.name;
            sidoSelect.appendChild(opt);
        }
    });
}

async function updateSigungu(sidoCode) {
    sigunguSelect.innerHTML = '<option value="">시/군/구 선택</option>';
    dongSelect.innerHTML = '<option value="">읍/면/동 선택</option>';
    sigunguSelect.disabled = true;
    dongSelect.disabled = true;
    saveLocationBtn.disabled = true;

    if(sidoCode) {
        const res = await fetch(`https://grpc-proxy-server-mkvo6j4wsq-du.a.run.app/v1/regcodes?regcode_pattern=${sidoCode}*00000&is_ignore_zero=true`);
        const data = await res.json();
        data.regcodes.forEach(reg => {
            if(reg.name.split(' ').length > 1) {
                const opt = document.createElement('option');
                opt.value = reg.code.substring(0, 5);
                opt.textContent = reg.name.split(' ').slice(1).join(' ');
                sigunguSelect.appendChild(opt);
            }
        });
        sigunguSelect.disabled = false;
    }
}

async function updateDong(sigunguCode) {
    dongSelect.innerHTML = '<option value="">읍/면/동 선택</option>';
    dongSelect.disabled = true;
    saveLocationBtn.disabled = true;

    if(sigunguCode) {
        const res = await fetch(`https://grpc-proxy-server-mkvo6j4wsq-du.a.run.app/v1/regcodes?regcode_pattern=${sigunguCode}*&is_ignore_zero=true`);
        const data = await res.json();
        data.regcodes.forEach(reg => {
            if(reg.name.split(' ').length > 2) {
                const opt = document.createElement('option');
                opt.value = reg.name;
                opt.textContent = reg.name.split(' ').slice(2).join(' ');
                dongSelect.appendChild(opt);
            }
        });
        dongSelect.disabled = false;
    }
}

sidoSelect.addEventListener('change', async (e) => {
    await updateSigungu(e.target.value);
});

sigunguSelect.addEventListener('change', async (e) => {
    await updateDong(e.target.value);
});

dongSelect.addEventListener('change', async (e) => {
    if(e.target.value) {
        weatherInfoBox.textContent = '좌표 변환 중...';
        saveLocationBtn.disabled = true;
        // Nominatim API를 통한 주소 -> 위경도 변환
        const query = encodeURIComponent(e.target.value);
        try {
            const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${query}&format=json`, {
                headers: { 'User-Agent': 'MyWeatherChatbot/1.0 (antigravity@test.com)' }
            });
            const data = await res.json();
            if(data && data.length > 0) {
                const lat = parseFloat(data[0].lat);
                const lon = parseFloat(data[0].lon);
                const {nx, ny} = dfs_xy_conv(lat, lon);
                currentLocation = { nx, ny, name: e.target.value };
                weatherInfoBox.textContent = `설정 위치: ${e.target.value} (격자: ${nx}, ${ny})`;
                saveLocationBtn.disabled = false;
            } else {
                weatherInfoBox.textContent = '해당 지역의 좌표를 찾을 수 없습니다. 다른 지역을 선택해 주세요.';
            }
        } catch (err) {
            weatherInfoBox.textContent = '주소 변환 중 오류가 발생했습니다.';
        }
    } else {
        saveLocationBtn.disabled = true;
    }
});

saveLocationBtn.addEventListener('click', () => {
    const manualWeather = manualWeatherSelect.value;
    if (manualWeather) {
        updateWeatherBackground(manualWeather, true);
    } else {
        fetchWeather(currentLocation.nx, currentLocation.ny);
    }
    settingsModal.classList.remove('active');
});

manualWeatherSelect.addEventListener('change', (e) => {
    if (e.target.value) {
        sidoSelect.disabled = true;
        sigunguSelect.disabled = true;
        dongSelect.disabled = true;
        gpsBtn.disabled = true;
        weatherInfoBox.textContent = `강제 날씨 설정: ${e.target.options[e.target.selectedIndex].text}`;
        saveLocationBtn.disabled = false;
    } else {
        sidoSelect.disabled = false;
        gpsBtn.disabled = false;
        if (sidoSelect.value) sigunguSelect.disabled = false;
        if (sigunguSelect.value) dongSelect.disabled = false;
        weatherInfoBox.textContent = '위치 기반 날씨를 사용합니다. 위치를 설정해주세요.';
        saveLocationBtn.disabled = (currentLocation.nx === null);
    }
});

async function reverseGeocodeAndUpdateUI(lat, lon) {
    try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`, {
            headers: { 'User-Agent': 'MyWeatherChatbot/1.0' }
        });
        const data = await res.json();
        if(data && data.address) {
            const addr = data.address;
            let city = addr.city || addr.province || addr.state || '';
            let borough = addr.borough || addr.county || addr.city_district || '';
            let suburb = addr.suburb || addr.town || addr.village || addr.quarter || '';
            
            // Set Sido
            if(city) {
                for(let i=0; i<sidoSelect.options.length; i++) {
                    if(sidoSelect.options[i].text.includes(city) || city.includes(sidoSelect.options[i].text)) {
                        sidoSelect.selectedIndex = i;
                        await updateSigungu(sidoSelect.value);
                        break;
                    }
                }
            }
            // Set Sigungu
            if(borough) {
                for(let i=0; i<sigunguSelect.options.length; i++) {
                    if(sigunguSelect.options[i].text.includes(borough) || borough.includes(sigunguSelect.options[i].text)) {
                        sigunguSelect.selectedIndex = i;
                        await updateDong(sigunguSelect.value);
                        break;
                    }
                }
            }
            // Set Dong
            if(suburb) {
                const normalizeDong = (name) => name.replace(/[0-9]+(동|가|리)?/g, '').replace(/(동|가|리|면|읍)$/, '');
                const normSuburb = normalizeDong(suburb);
                
                for(let i=1; i<dongSelect.options.length; i++) { // Skip index 0 (Select option)
                    const normOption = normalizeDong(dongSelect.options[i].text);
                    if(normOption === normSuburb || dongSelect.options[i].text.includes(suburb) || suburb.includes(dongSelect.options[i].text)) {
                        dongSelect.selectedIndex = i;
                        saveLocationBtn.disabled = false;
                        break;
                    }
                }
                
                // 만약 매칭을 못 찾았더라도 값이 존재하면 첫 번째 동이라도 선택하게 해서 보여줌
                if (dongSelect.selectedIndex === 0 && dongSelect.options.length > 1) {
                    dongSelect.selectedIndex = 1; 
                    saveLocationBtn.disabled = false;
                }
            }
        }
    } catch(e) {
        console.error("Reverse geocoding failed", e);
    }
}

// ---------------- 날씨 및 백그라운드 로직 ----------------
function getGPSWeather() {
    weatherInfoBox.textContent = '현재 위치 권한을 요청 중입니다...';
    if(navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const lat = pos.coords.latitude;
                const lon = pos.coords.longitude;
                const {nx, ny} = dfs_xy_conv(lat, lon);
                currentLocation = { nx, ny, name: '현재 위치(GPS)' };
                weatherInfoBox.textContent = `현재 위치 확인됨 (격자: ${nx}, ${ny})`;
                
                // 설정창 드롭다운 동기화
                reverseGeocodeAndUpdateUI(lat, lon);
                
                fetchWeather(nx, ny);
                if(settingsModal.classList.contains('active')) {
                    settingsModal.classList.remove('active');
                }
            },
            (err) => {
                weatherInfoBox.textContent = '위치 권한이 거부되었거나 가져올 수 없습니다. 수동으로 설정해 주세요.';
                // 위치 권한 없으면 맑음으로 기본 설정하고 알림창 띄움
                updateWeatherBackground('clear', true);
                alert('⚠️ 위치 정보 접근 권한이 없어 기본 날씨(맑음)로 설정되었습니다.\n우측 상단의 ⚙️ 톱니바퀴 아이콘을 눌러 수동으로 날씨나 위치를 설정하실 수 있습니다.');
            },
            { timeout: 5000, maximumAge: 0 } // 5초 타임아웃 추가
        );
    } else {
        weatherInfoBox.textContent = '현재 브라우저에서 위치 정보를 지원하지 않습니다.';
        updateWeatherBackground('clear', true);
        alert('⚠️ 브라우저가 위치 정보를 지원하지 않아 기본 날씨(맑음)로 설정되었습니다.');
    }
}

async function fetchWeather(nx, ny) {
    if(!publicDataApiKey) return;
    
    // 기상청 초단기실황 API
    const now = new Date();
    let baseDate = now.getFullYear() + String(now.getMonth()+1).padStart(2, '0') + String(now.getDate()).padStart(2, '0');
    // 현재 시간에서 40분 이전 값을 써야 안전함 (API 제공 시간 제약)
    now.setMinutes(now.getMinutes() - 40);
    let baseTime = String(now.getHours()).padStart(2, '0') + String(now.getMinutes()).padStart(2, '0');

    // API Key가 디코딩된 상태인지 인코딩된 상태인지 불분명할 수 있으므로 바로 넣기
    const url = `https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getUltraSrtNcst?serviceKey=${publicDataApiKey}&pageNo=1&numOfRows=10&dataType=JSON&base_date=${baseDate}&base_time=${baseTime}&nx=${nx}&ny=${ny}`;
    
    try {
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.response && data.response.body && data.response.body.items) {
            const items = data.response.body.items.item;
            let pty = '0'; // 강수형태
            
            items.forEach(item => {
                if (item.category === 'PTY') pty = item.obsrValue;
            });
            
            updateWeatherBackground(pty);
        } else {
            console.error("날씨 정보 응답 오류:", data);
        }
    } catch (error) {
        console.error("날씨 데이터를 가져오는 중 오류 발생:", error);
    }
}

function updateWeatherBackground(ptyCode, isManual = false) {
    // 기존 효과 제거
    weatherBackground.className = 'weather-background';
    weatherBackground.innerHTML = '';
    
    if (isManual) {
        if (ptyCode === 'rain') {
            weatherBackground.classList.add('rain');
            createParticles('raindrop', 50);
        } else if (ptyCode === 'snow') {
            weatherBackground.classList.add('snow');
            createParticles('snowflake', 80);
        } else if (ptyCode === 'cloudy') {
            weatherBackground.classList.add('cloudy');
        } else {
            weatherBackground.classList.add('clear');
        }
        return;
    }

    // PTY(강수형태): 0(없음), 1(비), 2(비/눈), 3(눈), 5(빗방울), 6(빗방울눈날림), 7(눈날림)
    if (ptyCode === '1' || ptyCode === '2' || ptyCode === '5') {
        weatherBackground.classList.add('rain');
        createParticles('raindrop', 50);
    } else if (ptyCode === '3' || ptyCode === '6' || ptyCode === '7') {
        weatherBackground.classList.add('snow');
        createParticles('snowflake', 80);
    } else {
        weatherBackground.classList.add('clear');
    }
}

function createParticles(className, count) {
    for(let i=0; i<count; i++) {
        const p = document.createElement('div');
        p.className = className;
        p.style.left = Math.random() * 100 + 'vw';
        
        if(className === 'snowflake') {
            // 눈은 천천히 떨어지도록 지속 시간을 늘립니다 (3초 ~ 6초)
            p.style.animationDuration = (Math.random() * 3 + 3) + 's';
            p.style.animationDelay = Math.random() * 5 + 's';
            p.style.opacity = Math.random() * 0.6 + 0.4;
            p.style.transform = `scale(${Math.random() * 0.5 + 0.5})`;
        } else {
            // 비는 빠르게 떨어지도록 유지 (0.5초 ~ 1.5초)
            p.style.animationDuration = (Math.random() * 1 + 0.5) + 's';
            p.style.animationDelay = Math.random() * 2 + 's';
        }
        
        weatherBackground.appendChild(p);
    }
}

// ---------------- 챗봇 통신 로직 ----------------
function addMessageToUI(sender, text) {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', sender);
    const contentDiv = document.createElement('div');
    contentDiv.classList.add('message-content');
    
    if (sender === 'bot') {
        contentDiv.innerHTML = marked.parse(text);
    } else {
        contentDiv.textContent = text; 
        contentDiv.style.whiteSpace = 'pre-wrap';
    }
    
    messageDiv.appendChild(contentDiv);
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function showTyping() {
    const indicator = document.createElement('div');
    indicator.classList.add('typing-indicator');
    indicator.id = 'typing-indicator';
    indicator.style.display = 'flex';
    for(let i=0; i<3; i++) {
        indicator.appendChild(document.createElement('span'));
    }
    chatMessages.appendChild(indicator);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function hideTyping() {
    const indicator = document.getElementById('typing-indicator');
    if (indicator) indicator.remove();
}

async function sendMessage() {
    const text = messageInput.value.trim();
    if (!text || !geminiApiKey) return;

    addMessageToUI('user', text);
    messageInput.value = '';
    messageInput.disabled = true;
    sendBtn.disabled = true;
    
    showTyping();
    chatHistory.push({ role: "user", parts: [{ text: text }] });

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: chatHistory })
        });

        const data = await response.json();
        hideTyping();

        if (data.error) throw new Error(data.error.message);

        const botReply = data.candidates[0].content.parts[0].text;
        addMessageToUI('bot', botReply);
        chatHistory.push({ role: "model", parts: [{ text: botReply }] });
    } catch (error) {
        hideTyping();
        console.error('Gemini API Error:', error);
        addMessageToUI('bot', `오류가 발생했습니다: ${error.message}`);
        chatHistory.pop();
    } finally {
        messageInput.disabled = false;
        sendBtn.disabled = false;
        messageInput.focus();
    }
}

sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});

window.addEventListener('DOMContentLoaded', loadApiKeys);
