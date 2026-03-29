/**
 * Lobster Game Test Suite
 * 測試遊戲配置和核心功能
 */
const { JSDOM } = require('jsdom');
const fs = require('fs');

let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        fn();
        console.log(`✅ ${name}`);
        passed++;
    } catch (e) {
        console.error(`❌ ${name}`);
        console.error(`   Error: ${e.message}`);
        failed++;
    }
}

function assert(condition, message) {
    if (!condition) {
        throw new Error(message || 'Assertion failed');
    }
}

// 讀取 HTML 檔案
const htmlContent = fs.readFileSync('lobster-game.html', 'utf8');

// 建立 JSDOM 環境
const dom = new JSDOM(htmlContent, {
    runScripts: "dangerously",
    resources: "usable"
});

const { window } = dom;
const { document } = window;

console.log('開始執行測試...\n');

// 測試 1: HTML 結構存在
test('遊戲容器存在', () => {
    const container = document.getElementById('gameContainer');
    assert(container !== null, 'gameContainer not found');
});

test('玩家元素存在', () => {
    const player = document.getElementById('player');
    assert(player !== null, 'player element not found');
});

test('開始按鈕存在', () => {
    const startBtn = document.getElementById('startBtn');
    assert(startBtn !== null, 'startBtn not found');
});

test('分數顯示存在', () => {
    const score = document.getElementById('score');
    assert(score !== null, 'score display not found');
});

test('生命顯示存在', () => {
    const lives = document.getElementById('lives');
    assert(lives !== null, 'lives display not found');
});

// 測試 2: 從 HTML 中提取 GAME_CONFIG（使用正則表達式）
test('GAME_CONFIG 存在於程式碼中', () => {
    const configMatch = htmlContent.match(/const GAME_CONFIG\s*=\s*\{/);
    assert(configMatch !== null, 'GAME_CONFIG not found in HTML');
});

test('GAME_CONFIG 包含必要的遊戲參數', () => {
    const requiredKeys = [
        'CONTAINER_WIDTH',
        'CONTAINER_HEIGHT', 
        'PLAYER_WIDTH',
        'PLAYER_HEIGHT',
        'BUBBLE_SIZE',
        'MAX_LIVES',
        'INITIAL_SPAWN_INTERVAL',
        'MIN_SPAWN_INTERVAL',
        'COIN_BASE_POINTS'
    ];
    
    requiredKeys.forEach(key => {
        const keyRegex = new RegExp(`${key}\\s*:`);
        assert(keyRegex.test(htmlContent), `GAME_CONFIG.${key} not found`);
    });
});

test('GAME_CONFIG 的數值參數合理', () => {
    // 驗證容器尺寸
    const containerWidthMatch = htmlContent.match(/CONTAINER_WIDTH:\s*(\d+)/);
    const containerHeightMatch = htmlContent.match(/CONTAINER_HEIGHT:\s*(\d+)/);
    
    assert(containerWidthMatch !== null, 'CONTAINER_WIDTH not found');
    assert(containerHeightMatch !== null, 'CONTAINER_HEIGHT not found');
    
    const width = parseInt(containerWidthMatch[1]);
    const height = parseInt(containerHeightMatch[1]);
    
    assert(width > 0 && width <= 2000, `Invalid CONTAINER_WIDTH: ${width}`);
    assert(height > 0 && height <= 2000, `Invalid CONTAINER_HEIGHT: ${height}`);
});

test('道具持續時間設定合理', () => {
    const shieldDurationMatch = htmlContent.match(/SHIELD_DURATION:\s*(\d+)/);
    const doubleDurationMatch = htmlContent.match(/DOUBLE_DURATION:\s*(\d+)/);
    
    assert(shieldDurationMatch !== null, 'SHIELD_DURATION not found');
    assert(doubleDurationMatch !== null, 'DOUBLE_DURATION not found');
    
    const shieldDuration = parseInt(shieldDurationMatch[1]);
    const doubleDuration = parseInt(doubleDurationMatch[1]);
    
    assert(shieldDuration > 0 && shieldDuration <= 30000, `Invalid SHIELD_DURATION: ${shieldDuration}`);
    assert(doubleDuration > 0 && doubleDuration <= 30000, `Invalid DOUBLE_DURATION: ${doubleDuration}`);
});

// 測試 3: 核心函數存在
test('formatScore 函數存在', () => {
    const funcMatch = htmlContent.match(/function formatScore\s*\(/);
    assert(funcMatch !== null, 'formatScore function not found');
});

test('getDifficultyLevel 函數存在', () => {
    const funcMatch = htmlContent.match(/function getDifficultyLevel\s*\(/);
    assert(funcMatch !== null, 'getDifficultyLevel function not found');
});

test('updateBubbles 函數存在', () => {
    const funcMatch = htmlContent.match(/function updateBubbles\s*\(/);
    assert(funcMatch !== null, 'updateBubbles function not found');
});

test('spawnBubble 函數存在', () => {
    const funcMatch = htmlContent.match(/function spawnBubble\s*\(/);
    assert(funcMatch !== null, 'spawnBubble function not found');
});

test('startGame 函數存在', () => {
    const funcMatch = htmlContent.match(/function startGame\s*\(/);
    assert(funcMatch !== null, 'startGame function not found');
});

// 測試 4: CSS 樣式檢查
test('必要的 CSS 樣式存在', () => {
    const requiredStyles = [
        '#gameContainer',
        '#player',
        '.bubble',
        '#score',
        '#lives',
        '@keyframes'
    ];
    
    requiredStyles.forEach(style => {
        assert(htmlContent.includes(style), `CSS style '${style}' not found`);
    });
});

test('GPU 加速提示存在於 CSS 中', () => {
    const gpuHints = ['will-change', 'transform:', 'translate3d'];
    let foundCount = 0;
    gpuHints.forEach(hint => {
        if (htmlContent.includes(hint)) foundCount++;
    });
    assert(foundCount >= 2, 'Insufficient GPU acceleration hints found');
});

// 測試 5: 無障礙功能
test('無障礙屬性存在', () => {
    const ariaLabels = (htmlContent.match(/aria-label/g) || []).length;
    assert(ariaLabels >= 3, `Insufficient aria-label attributes: found ${ariaLabels}`);
});

test('鍵盤控制功能存在', () => {
    const keyHandlers = htmlContent.match(/keydown|keyup/g) || [];
    assert(keyHandlers.length >= 2, 'Keyboard event handlers not found');
});

// 測試 6: 本地存儲功能
test('localStorage 相關函數存在', () => {
    assert(htmlContent.includes('getStorageItem'), 'getStorageItem function not found');
    assert(htmlContent.includes('setStorageItem'), 'setStorageItem function not found');
});

test('最高分存儲 key 存在', () => {
    const keyMatch = htmlContent.match(/HIGH_SCORE_KEY:\s*['"]([^'"]+)['"]/);
    assert(keyMatch !== null, 'HIGH_SCORE_KEY not found');
    assert(keyMatch[1].length > 0, 'HIGH_SCORE_KEY is empty');
});

// 測試 7: 音效系統
test('音效播放函數存在', () => {
    const soundFunctions = ['playSound', 'playTone', 'initAudio'];
    soundFunctions.forEach(fn => {
        assert(htmlContent.includes(`function ${fn}`), `Sound function '${fn}' not found`);
    });
});

// 測試 8: PWA 功能
test('Service Worker 檔案存在', () => {
    assert(fs.existsSync('sw.js'), 'sw.js not found');
});

test('manifest.json 存在', () => {
    assert(fs.existsSync('manifest.json'), 'manifest.json not found');
});

test('HTML 包含 PWA meta 標籤', () => {
    assert(htmlContent.includes('apple-mobile-web-app-capable'), 'Apple PWA meta tag missing');
});

// 輸出測試結果
console.log('\n===================');
console.log(`測試結果: ${passed} 通過, ${failed} 失敗`);
console.log('===================');

if (failed > 0) {
    process.exit(1);
}
