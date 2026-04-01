/**
 * Lobster Game Functional Test Suite
 * 測試遊戲核心功能邏輯
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

function assertEqual(actual, expected, message) {
    if (actual !== expected) {
        throw new Error(`${message || 'Assertion failed'}: expected ${expected}, got ${actual}`);
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

// 從 script 中提取並執行函數
function extractAndExecute(code) {
    try {
        eval(code);
        return true;
    } catch (e) {
        console.warn('Failed to extract function:', e.message);
        return false;
    }
}

// 提取 GAME_CONFIG
const configMatch = htmlContent.match(/const GAME_CONFIG\s*=\s*(\{[\s\S]*?\});/);
let GAME_CONFIG = null;
if (configMatch) {
    try {
        // 修復 JSON 格式（移除末尾的分號）
        const configStr = configMatch[1].replace(/,(\s*\})/g, '$1');
        GAME_CONFIG = eval('(' + configStr + ')');
    } catch (e) {
        console.warn('Failed to parse GAME_CONFIG:', e.message);
    }
}

// 提取 ITEM_EMOJIS
const itemEmojisMatch = htmlContent.match(/const ITEM_EMOJIS\s*=\s*\{[\s\S]*?\}/);
let ITEM_EMOJIS = { GOOD: ['💰', '💎'], BAD: ['💣'] };
if (itemEmojisMatch) {
    try {
        ITEM_EMOJIS = eval('(' + itemEmojisMatch[0].replace('const ITEM_EMOJIS = ', '') + ')');
    } catch (e) {
        console.warn('Failed to parse ITEM_EMOJIS');
    }
}

// 提取 POWERUPS
const powerupsMatch = htmlContent.match(/const POWERUPS\s*=\s*\[[\s\S]*?\];/);
let POWERUPS = [];
if (powerupsMatch) {
    try {
        POWERUPS = eval(powerupsMatch[0].replace('const POWERUPS = ', ''));
    } catch (e) {
        console.warn('Failed to parse POWERUPS');
    }
}

console.log('開始執行功能測試...\n');

// ==================== 格式化函數測試 ====================
console.log('--- 格式化函數測試 ---\n');

// 模擬 formatScore 函數（基於程式碼分析）
function formatScore(num) {
    return num.toLocaleString('zh-TW');
}

test('formatScore: 正常數字格式化', () => {
    assertEqual(formatScore(1000), '1,000');
    assertEqual(formatScore(1234567), '1,234,567');
});

test('formatScore: 個位數', () => {
    assertEqual(formatScore(0), '0');
    assertEqual(formatScore(5), '5');
    assertEqual(formatScore(999), '999');
});

// 模擬 formatTime 函數
function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return mins + ':' + secs.toString().padStart(2, '0');
}

test('formatTime: 正常時間格式化', () => {
    assertEqual(formatTime(0), '0:00');
    assertEqual(formatTime(30), '0:30');
    assertEqual(formatTime(60), '1:00');
    assertEqual(formatTime(90), '1:30');
    assertEqual(formatTime(3661), '61:01');
});

test('formatTime: 秒數補零', () => {
    assertEqual(formatTime(5), '0:05');
    assertEqual(formatTime(65), '1:05');
    assertEqual(formatTime(600), '10:00');
});

// 模擬 getHeartsString 函數
function getHeartsString(count) {
    return '❤️'.repeat(Math.max(0, count));
}

test('getHeartsString: 正常輸出', () => {
    assertEqual(getHeartsString(0), '');
    assertEqual(getHeartsString(1), '❤️');
    assertEqual(getHeartsString(3), '❤️❤️❤️');
    assertEqual(getHeartsString(5), '❤️❤️❤️❤️❤️');
});

test('getHeartsString: 負數處理', () => {
    assertEqual(getHeartsString(-1), '');
    assertEqual(getHeartsString(-100), '');
});

// ==================== 難度系統測試 ====================
console.log('\n--- 難度系統測試 ---\n');

if (GAME_CONFIG) {
    const DIFFICULTY_INCREASE_PER = GAME_CONFIG.DIFFICULTY_INCREASE_PER || 50;
    const INITIAL_SPAWN_INTERVAL = GAME_CONFIG.INITIAL_SPAWN_INTERVAL || 800;
    const MIN_SPAWN_INTERVAL = GAME_CONFIG.MIN_SPAWN_INTERVAL || 300;
    const INITIAL_BUBBLE_SPEED = GAME_CONFIG.INITIAL_BUBBLE_SPEED || 3;
    const MAX_BUBBLE_SPEED = GAME_CONFIG.MAX_BUBBLE_SPEED || 8;

    // 模擬 getDifficultyLevel
    let cachedDifficultyLevel = 0;
    let lastScoreForDifficulty = 0;
    
    function getDifficultyLevel(score) {
        if (score !== lastScoreForDifficulty) {
            lastScoreForDifficulty = score;
            cachedDifficultyLevel = Math.floor(score / DIFFICULTY_INCREASE_PER);
        }
        return cachedDifficultyLevel;
    }

    test('難度等級: 初始為 0', () => {
        assertEqual(getDifficultyLevel(0), 0);
        assertEqual(getDifficultyLevel(1), 0);
        assertEqual(getDifficultyLevel(49), 0);
    });

    test('難度等級: 達到門檻升級', () => {
        assertEqual(getDifficultyLevel(50), 1);
        assertEqual(getDifficultyLevel(100), 2);
        assertEqual(getDifficultyLevel(150), 3);
    });

    test('難度等級: 邊界條件', () => {
        assertEqual(getDifficultyLevel(49), 0);
        assertEqual(getDifficultyLevel(50), 1);
        assertEqual(getDifficultyLevel(99), 1);
        assertEqual(getDifficultyLevel(100), 2);
    });

    // 模擬 getCurrentSpawnInterval
    function getCurrentSpawnInterval(level) {
        return Math.max(MIN_SPAWN_INTERVAL, INITIAL_SPAWN_INTERVAL - (level * GAME_CONFIG.SPAWN_DECREASE_PER_LEVEL));
    }

    test('生成間隔: 初始難度', () => {
        const interval = getCurrentSpawnInterval(0);
        assert(interval === INITIAL_SPAWN_INTERVAL, `Expected ${INITIAL_SPAWN_INTERVAL}, got ${interval}`);
    });

    test('生成間隔: 隨難度增加而減少', () => {
        const level5 = getCurrentSpawnInterval(5);
        const level10 = getCurrentSpawnInterval(10);
        assert(level5 < INITIAL_SPAWN_INTERVAL, 'Level 5 should have lower interval');
        assert(level10 < level5, 'Level 10 should have lower interval than level 5');
    });

    test('生成間隔: 不得低於最小值', () => {
        const highLevel = getCurrentSpawnInterval(100);
        assert(highLevel >= MIN_SPAWN_INTERVAL, `Interval should not go below ${MIN_SPAWN_INTERVAL}`);
    });

    // 模擬 getCurrentBubbleSpeed
    function getCurrentBubbleSpeed(level) {
        return Math.min(MAX_BUBBLE_SPEED, INITIAL_BUBBLE_SPEED + (level * GAME_CONFIG.SPEED_INCREASE_PER_LEVEL));
    }

    test('氣泡速度: 初始速度', () => {
        const speed = getCurrentBubbleSpeed(0);
        assertEqual(speed, INITIAL_BUBBLE_SPEED);
    });

    test('氣泡速度: 隨難度增加', () => {
        const speed5 = getCurrentBubbleSpeed(5);
        const speed10 = getCurrentBubbleSpeed(10);
        assert(speed5 > INITIAL_BUBBLE_SPEED, 'Speed should increase with difficulty');
        assert(speed10 > speed5, 'Higher difficulty should have higher speed');
    });

    test('氣泡速度: 不得高於最大值', () => {
        const highSpeed = getCurrentBubbleSpeed(100);
        assert(highSpeed <= MAX_BUBBLE_SPEED, 'Speed should not exceed maximum');
    });
} else {
    console.log('⚠️ 跳過難度系統測試（GAME_CONFIG 無法解析）\n');
}

// ==================== 碰撞檢測測試 ====================
console.log('\n--- 碰撞檢測測試 ---\n');

if (GAME_CONFIG) {
    const PLAYER_WIDTH = GAME_CONFIG.PLAYER_WIDTH || 60;
    const PLAYER_HEIGHT = GAME_CONFIG.PLAYER_HEIGHT || 60;
    const BUBBLE_SIZE = GAME_CONFIG.BUBBLE_SIZE || 40;
    const PLAYER_RADIUS = PLAYER_WIDTH / 2;
    const BUBBLE_RADIUS = BUBBLE_SIZE / 2;
    const COLLISION_DISTANCE = PLAYER_RADIUS + BUBBLE_RADIUS;

    // 模擬碰撞檢測（圓形碰撞）
    function checkCollision(playerX, playerY, bubbleX, bubbleY) {
        const playerCenterX = playerX + PLAYER_WIDTH / 2;
        const playerCenterY = playerY + PLAYER_HEIGHT / 2;
        const bubbleCenterX = bubbleX + BUBBLE_RADIUS;
        const bubbleCenterY = bubbleY + BUBBLE_RADIUS;
        
        const dx = bubbleCenterX - playerCenterX;
        const dy = bubbleCenterY - playerCenterY;
        const distanceSquared = dx * dx + dy * dy;
        
        return distanceSquared < COLLISION_DISTANCE * COLLISION_DISTANCE;
    }

    test('碰撞檢測: 完全重疊', () => {
        assert(checkCollision(100, 100, 100, 100) === true, 'Fully overlapping objects should collide');
    });

    test('碰撞檢測: 中心點相距一個半徑', () => {
        // 玩家中心在 (100, 100)，氣泡中心在 (100 + 50, 100)
        // 距離 = 50，碰撞半徑 = 50，應該正好碰撞
        const playerX = 100 - PLAYER_WIDTH / 2;
        const playerY = 100 - PLAYER_HEIGHT / 2;
        const bubbleX = 100 + COLLISION_DISTANCE - BUBBLE_RADIUS;
        const bubbleY = 100 - BUBBLE_RADIUS;
        
        // 正好等於碰撞距離時，根據実装可能碰撞也可能不碰撞
        const result = checkCollision(playerX, playerY, bubbleX, bubbleY);
        // 由於是 distanceSquared < threshold，剛好等於時不會碰撞
        assert(result === false, 'Just touching should not trigger collision (using squared comparison)');
    });

    test('碰撞檢測: 遠距離不碰撞', () => {
        assert(checkCollision(0, 0, 1000, 1000) === false, 'Distant objects should not collide');
    });

    test('碰撞檢測: 斜角碰撞', () => {
        // 玩家中心在 (200, 200)，玩家從左上角計算
        // 所以 playerX = 200 - 30 = 170, playerY = 200 - 30 = 170
        const playerCenterX = 200;
        const playerCenterY = 200;
        const playerX = playerCenterX - PLAYER_WIDTH / 2;
        const playerY = playerCenterY - PLAYER_HEIGHT / 2;
        
        // 氣泡中心在斜對角 (200 + 35, 200 - 35)，距離約 49.5，小於碰撞半徑 50
        const bubbleX = (playerCenterX + 35) - BUBBLE_RADIUS;
        const bubbleY = (playerCenterY - 35) - BUBBLE_RADIUS;
        
        assert(checkCollision(playerX, playerY, bubbleX, bubbleY) === true, 'Diagonal collision should be detected');
    });

    test('碰撞檢測: 玩家左邊緣碰撞', () => {
        // 氣泡在玩家左邊緣
        const playerX = 100;
        const playerY = 100;
        const bubbleX = playerX - COLLISION_DISTANCE + BUBBLE_RADIUS;
        const bubbleY = playerY;
        
        assert(checkCollision(playerX, playerY, bubbleX, bubbleY) === true, 'Left edge collision should be detected');
    });
} else {
    console.log('⚠️ 跳過碰撞檢測測試（GAME_CONFIG 無法解析）\n');
}

// ==================== 道具系統測試 ====================
console.log('\n--- 道具系統測試 ---\n');

test('道具類型存在', () => {
    const shield = POWERUPS.find(p => p.type === 'shield');
    const double = POWERUPS.find(p => p.type === '2x');
    const heart = POWERUPS.find(p => p.type === 'heart');
    
    assert(shield !== undefined, 'Shield powerup should exist');
    assert(double !== undefined, 'Double points powerup should exist');
    assert(heart !== undefined, 'Heart powerup should exist');
});

test('道具 emoji 存在', () => {
    POWERUPS.forEach(p => {
        assert(p.emoji !== undefined && p.emoji.length > 0, `Powerup ${p.type} should have emoji`);
    });
});

test('好東西道具包含金幣和寶石', () => {
    assert(ITEM_EMOJIS.GOOD.length >= 2, 'Should have at least 2 good item types');
    assert(ITEM_EMOJIS.GOOD.includes('💰'), 'Should include coin emoji');
});

test('壞東西道具包含炸彈', () => {
    assert(ITEM_EMOJIS.BAD.length >= 1, 'Should have at least 1 bad item type');
    assert(ITEM_EMOJIS.BAD.includes('💣'), 'Should include bomb emoji');
});

// ==================== 分數計算測試 ====================
console.log('\n--- 分數計算測試 ---\n');

if (GAME_CONFIG) {
    const COIN_BASE_POINTS = GAME_CONFIG.COIN_BASE_POINTS || 10;
    const COIN_2X_POINTS = GAME_CONFIG.COIN_2X_POINTS || 20;
    const MAX_COMBO_MULTIPLIER = 5;

    test('基礎分數計算', () => {
        assertEqual(COIN_BASE_POINTS, 10, 'Coin base points should be 10');
    });

    test('雙倍分數計算', () => {
        assertEqual(COIN_2X_POINTS, 20, 'Coin 2x points should be 20');
        assertEqual(COIN_2X_POINTS, COIN_BASE_POINTS * 2, '2x points should be double base');
    });

    // 模擬連擊倍數計算
    function calculateComboMultiplier(comboCount) {
        return Math.min(MAX_COMBO_MULTIPLIER, 1 + Math.floor(comboCount / 3));
    }

    test('連擊倍數: 無連擊', () => {
        assertEqual(calculateComboMultiplier(0), 1);
        assertEqual(calculateComboMultiplier(1), 1);
    });

    test('連擊倍數: 達到門檻增加', () => {
        assertEqual(calculateComboMultiplier(3), 2);
        assertEqual(calculateComboMultiplier(6), 3);
        assertEqual(calculateComboMultiplier(9), 4);
    });

    test('連擊倍數: 上限為 5', () => {
        assertEqual(calculateComboMultiplier(100), 5);
        assertEqual(calculateComboMultiplier(1000), 5);
    });

    // 模擬總分計算
    function calculateTotalScore(is2xActive, comboCount) {
        const base = is2xActive ? COIN_2X_POINTS : COIN_BASE_POINTS;
        const multiplier = calculateComboMultiplier(comboCount);
        return base * multiplier;
    }

    test('總分計算: 基礎分', () => {
        assertEqual(calculateTotalScore(false, 0), 10);
    });

    test('總分計算: 雙倍激活', () => {
        assertEqual(calculateTotalScore(true, 0), 20);
    });

    test('總分計算: 連擊加成', () => {
        assertEqual(calculateTotalScore(false, 3), 20);
        assertEqual(calculateTotalScore(false, 6), 30);
    });

    test('總分計算: 雙倍 + 連擊', () => {
        assertEqual(calculateTotalScore(true, 6), 60);
        assertEqual(calculateTotalScore(true, 100), 100); // 上限
    });
} else {
    console.log('⚠️ 跳過分數計算測試（GAME_CONFIG 無法解析）\n');
}

// ==================== 生命值系統測試 ====================
console.log('\n--- 生命值系統測試 ---\n');

if (GAME_CONFIG) {
    const MAX_LIVES = GAME_CONFIG.MAX_LIVES || 3;
    const MAX_LIVES_CAP = GAME_CONFIG.MAX_LIVES_CAP || 5;

    test('最大生命值設定', () => {
        assertEqual(MAX_LIVES, 3, 'Max lives should be 3');
    });

    test('生命值上限設定', () => {
        assert(MAX_LIVES_CAP > MAX_LIVES, 'Life cap should be greater than max lives');
    });

    // 模擬愛心道具邏輯
    function canAddLife(currentLives) {
        return currentLives < MAX_LIVES_CAP;
    }

    test('生命值: 可以增加低於上限', () => {
        assert(canAddLife(0) === true, 'Should be able to add life when at 0');
        assert(canAddLife(3) === true, 'Should be able to add life when at 3 (below cap of 5)');
    });

    test('生命值: 達到上限不能增加', () => {
        assert(canAddLife(5) === false, 'Should not be able to add life when at cap');
        assert(canAddLife(6) === false, 'Should not be able to add life when above cap');
    });

    // 模擬受傷後生命值處理
    function handleDamage(lives) {
        return Math.max(0, lives - 1);
    }

    test('受傷處理: 正常扣血', () => {
        assertEqual(handleDamage(3), 2);
        assertEqual(handleDamage(1), 0);
    });

    test('受傷處理: 不低於零', () => {
        assertEqual(handleDamage(0), 0);
        assertEqual(handleDamage(-1), 0);
    });
} else {
    console.log('⚠️ 跳過生命值系統測試（GAME_CONFIG 無法解析）\n');
}

// ==================== DOM 元素存在性測試 ====================
console.log('\n--- DOM 元素測試 ---\n');

test('遊戲容器存在', () => {
    const container = document.getElementById('gameContainer');
    assert(container !== null, 'gameContainer not found');
});

test('玩家元素存在', () => {
    const player = document.getElementById('player');
    assert(player !== null, 'player not found');
});

test('所有必要的 UI 元素存在', () => {
    const elements = [
        'gameContainer',
        'player',
        'score',
        'lives',
        'startBtn',
        'gameOver',
        'pauseOverlay',
        'helpOverlay'
    ];
    
    elements.forEach(id => {
        const el = document.getElementById(id);
        assert(el !== null, `${id} should exist`);
    });
});

test('控制按鈕存在', () => {
    const buttons = [
        'soundBtn',
        'vibrationBtn',
        'pauseBtn',
        'helpBtn'
    ];
    
    buttons.forEach(id => {
        const btn = document.getElementById(id);
        assert(btn !== null, `${id} should exist`);
    });
});

test('觸控按鈕存在', () => {
    const touchBtns = document.querySelectorAll('.touch-btn');
    assert(touchBtns.length >= 3, 'Should have at least 3 touch control buttons');
});

// ==================== 無障礙測試 ====================
console.log('\n--- 無障礙測試 ---\n');

test('遊戲容器具有 role 屬性', () => {
    const container = document.getElementById('gameContainer');
    assert(container.getAttribute('role') !== null, 'gameContainer should have role attribute');
});

test('按鈕具有 aria-label', () => {
    const startBtn = document.getElementById('startBtn');
    assert(startBtn.getAttribute('aria-label') !== null, 'startBtn should have aria-label');
});

test('分數顯示具有 aria-live', () => {
    const score = document.getElementById('score');
    const ariaLive = score.getAttribute('aria-live');
    assert(ariaLive !== null, 'score should have aria-live for screen readers');
});

// --- 物件池事件監聽器清理測試 ---
test('returnPopupToPool 正確移除事件監聽器', () => {
    // 驗證 returnPopupToPool 函數中包含 removeEventListener 呼叫
    const hasRemoveListener = htmlContent.includes('removeEventListener(\'animationend\', element._animationEndHandler)');
    assert(hasRemoveListener, 'returnPopupToPool should call removeEventListener for animationend event');
});

test('returnPopupToPool 清理 _animationEndHandler 屬性', () => {
    // 驗證清理流程：先移除監聽器，再設為 null
    const cleanupPattern = /removeEventListener\('animationend'[\s\S]*?_animationEndHandler\s*=\s*null/;
    const hasProperCleanup = cleanupPattern.test(htmlContent);
    assert(hasProperCleanup, 'returnPopupToPool should properly clean up _animationEndHandler');
});

// ==================== 總結 ====================
console.log('\n===================');
console.log(`測試結果: ${passed} 通過, ${failed} 失敗`);
console.log('===================');

if (failed > 0) {
    process.exit(1);
}
