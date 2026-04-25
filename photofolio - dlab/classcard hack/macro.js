(function () {
    console.log("%c[Classcard Hack] 안정화 버전 실행", "color: #2ed573; font-weight: bold; font-size: 1.2em;");

    const rawData = {
        "bake": "(음식을) 굽다", "blow": "불다", "candle": "양초, 초", "during": "~ 동안", "early": "일찍",
        "eat out": "외식하다", "film": "촬영하다", "garden": "정원", "get up": "일어나다", "gift": "선물",
        "great-grandmother": "증조할머니", "guest": "손님", "hold": "들다, 잡다, 껴안다", "introduce": "소개하다",
        "join": "함께하다, 가입하다", "light": "불을 붙이다, 밝게 하다", "little": "작은",
        "look at": "~을 보다", "look for": "~을 찾다", "make sense": "이해가 되다, 말이 되다",
        "owner": "주인", "pick": "(과일 등을) 따다", "playground": "운동장, 놀이터", "pool": "수영장",
        "prepare": "준비하다", "put": "놓다, (~on) 입다", "ride": "타다", "right": "옳은, 올바른",
        "slowly": "천천히", "special": "특별한", "stage": "무대", "stand": "서다, 서 있다",
        "strange": "이상한, 낯선", "sweater": "스웨터", "take a walk": "산책하다", "twin": "쌍둥이의",
        "usually": "보통", "water": "물을 주다", "work out": "운동하다"
    };

    const pdfData = Object.fromEntries(
        Object.entries(rawData).map(([k, v]) => [k.toLowerCase().trim(), v])
    );

    const sleep = (ms) => new Promise(r => setTimeout(r, ms));

    function isGone(el) {
    return !el || 
            el.classList.contains('invisible') ||
            el.style.opacity === '0' ||
            el.style.display === 'none';
}

async function waitUntilGone(left, right, timeout = 1000) {
    const start = Date.now();

    while (Date.now() - start < timeout) {
        if (isGone(left) && isGone(right)) return true;
        await sleep(50);
    }
    return false;
}
    function heavyClick(el) {
        if (!el) return;
        ["touchstart", "touchend", "mousedown", "mouseup", "click"].forEach(type => {
            el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
        });
    }

    function cleanText(text) {
        return text.split('\n')[0]
            .replace(/[0-9]/g, '')
            .replace(/[\t\r]/g, '')
            .trim()
            .toLowerCase();
    }

    function autoNext() {
        const selectors = [
            '.btn-next-sec', '.btn-rank-start', '.btn-app-start',
            '.btn-opt-start', '.btn_next', '#next_btn', '.btn-blue'
        ];

        for (let sel of selectors) {
            const btn = document.querySelector(sel);
            if (btn && btn.offsetParent !== null && !btn.classList.contains('hidden')) {
                console.log("%c[Next] 클릭", "color: #3498db;");
                heavyClick(btn);
                return true;
            }
        }
        return false;
    }

    function buildQueue() {
        const leftCards = Array.from(document.querySelectorAll('.match-body.left .flip-card:not(.invisible)'))
            .filter(c => c.style.opacity !== '0' && c.style.display !== 'none');

        const rightCards = Array.from(document.querySelectorAll('.match-body.right .flip-card:not(.invisible)'))
            .filter(c => c.style.opacity !== '0' && c.style.display !== 'none');

        const queue = [];

        for (let leftCard of leftCards) {
            const textEl = leftCard.querySelector('.match-text div');
            if (!textEl) continue;

            const word = cleanText(textEl.innerText);
            const meaning = pdfData[word];
            if (!meaning) continue;

            const match = rightCards.find(rc => {
                const rText = rc.querySelector('.match-text div');
                if (!rText) return false;

                const cleanRight = cleanText(rText.innerText).replace(/\s/g, '');
                const cleanTarget = meaning.replace(/\s/g, '').replace(/[0-9]/g, '');

                return cleanTarget.includes(cleanRight) || cleanRight.includes(cleanTarget);
            });

            if (match) {
                queue.push([leftCard, match]);
            }
        }

        return queue;
    }

    let running = false;

    async function mainLoop() {
        if (running) return;
        running = true;

        while (true) {
            if (autoNext()) {
                await sleep(800);
                continue;
            }

            const queue = buildQueue();

            if (queue.length === 0) {
                await sleep(300);
                continue;
            }

            for (let [left, right] of queue) {
                console.log("[Match]", left.innerText, "→", right.innerText);

                heavyClick(left);
                await sleep(250 + Math.random() * 150);

                heavyClick(right);

                await waitUntilGone(left, right);

                await sleep(200);
            }
        }
    }

    mainLoop();
})();