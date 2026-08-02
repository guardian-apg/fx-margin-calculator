// ===== 定数定義 =====
const CURRENCY_PAIRS = [
  { code: 'USD/JPY', name: '米ドル/円', type: 'jpy', pipSize: 0.01, defaultRate: 150.00 },
  { code: 'EUR/JPY', name: 'ユーロ/円', type: 'jpy', pipSize: 0.01, defaultRate: 162.50 },
  { code: 'GBP/JPY', name: 'ポンド/円', type: 'jpy', pipSize: 0.01, defaultRate: 191.00 },
  { code: 'AUD/JPY', name: '豪ドル/円', type: 'jpy', pipSize: 0.01, defaultRate: 98.20 },
  { code: 'NZD/JPY', name: 'NZドル/円', type: 'jpy', pipSize: 0.01, defaultRate: 88.50 },
  { code: 'CAD/JPY', name: '加ドル/円', type: 'jpy', pipSize: 0.01, defaultRate: 109.00 },
  { code: 'CHF/JPY', name: 'スイスフラン/円', type: 'jpy', pipSize: 0.01, defaultRate: 171.20 },
  { code: 'ZAR/JPY', name: '南アランド/円', type: 'jpy', pipSize: 0.01, defaultRate: 8.15 },
  { code: 'MXN/JPY', name: 'メキシコペソ/円', type: 'jpy', pipSize: 0.01, defaultRate: 8.80 },
  { code: 'EUR/USD', name: 'ユーロ/米ドル', type: 'usd', pipSize: 0.0001, defaultRate: 1.0830 },
  { code: 'GBP/USD', name: 'ポンド/米ドル', type: 'usd', pipSize: 0.0001, defaultRate: 1.2750 },
  { code: 'AUD/USD', name: '豪ドル/米ドル', type: 'usd', pipSize: 0.0001, defaultRate: 0.6550 }
];

// ===== 状態管理 =====
let state = {
  accountBalance: 1000000,
  leverage: 25,
  lotSize: 10000,
  rates: {},
  positions: [
    { id: 1, pair: 'USD/JPY', direction: 'buy', lots: 1.0, profit: -5000, swap: 1200 }
  ],
  newOrder: {
    pair: 'USD/JPY',
    direction: 'buy',
    lots: 1.0,
    price: 150.00
  },
  losscutThreshold: 100,
  swapSim: {
    pair: 'MXN/JPY',
    lots: 10.0,
    point: 280.0
  }
};

let assetChart = null;

// ===== DOM要素の取得 =====
const els = {
  accountBalance: document.getElementById('account-balance'),
  leverageSelect: document.getElementById('leverage-select'),
  leverageCustom: document.getElementById('leverage-custom'),
  lotSizeSelect: document.getElementById('lot-size-select'),
  lotSizeCustom: document.getElementById('lot-size-custom'),
  positionTableBody: document.getElementById('position-table-body'),
  addPositionBtn: document.getElementById('add-position-btn'),
  newPair: document.getElementById('new-pair'),
  newLots: document.getElementById('new-lots'),
  newPrice: document.getElementById('new-price'),
  ratesAccordionToggle: document.getElementById('rates-accordion-toggle'),
  ratesAccordionContent: document.getElementById('rates-accordion-content'),
  ratesAccordionCard: document.querySelector('.card-rates'),
  ratesInputGrid: document.getElementById('rates-input-grid'),
  
  // レート更新DOM
  fetchRatesBtn: document.getElementById('fetch-rates-btn'),
  ratesUpdateTime: document.getElementById('rates-update-time'),
  
  // 想定スワップシミュレーターDOM
  swapSimPair: document.getElementById('swap-sim-pair'),
  swapSimLots: document.getElementById('swap-sim-lots'),
  swapSimPoint: document.getElementById('swap-sim-point'),
  swapSimNote: document.getElementById('swap-sim-note'),
  swapResDay: document.getElementById('swap-res-day'),
  swapResMonth: document.getElementById('swap-res-month'),
  swapResYear: document.getElementById('swap-res-year'),
  
  // 保存状態インジケーター
  saveStatusText: document.getElementById('save-status-text'),
  
  // 計算結果DOM
  calcEquity: document.getElementById('calc-equity'),
  calcMargin: document.getElementById('calc-margin'),
  calcRatio: document.getElementById('sim-ratio'), // 想定維持率 (ハイライト)
  calcRatioText: document.getElementById('calc-ratio-text'), // 現在維持率
  simEquity: document.getElementById('sim-equity'),
  simMargin: document.getElementById('sim-margin'),
  simRatioText: document.getElementById('sim-ratio-text'), // ゲージ内テキスト
  ratioChange: document.getElementById('ratio-change'),
  safetyBadge: document.getElementById('safety-badge'),
  simGaugeCircle: document.getElementById('sim-gauge-circle'),
  
  // ロスカットシミュレーションDOM
  losscutThreshold: document.getElementById('losscut-threshold'),
  simTargetPair: document.getElementById('sim-target-pair'),
  losscutRate: document.getElementById('losscut-rate'),
  losscutDistance: document.getElementById('losscut-distance')
};

// ===== 初期化関数 =====
async function init() {
  // レート初期設定（API取得前のフォールバック値）
  CURRENCY_PAIRS.forEach(pair => {
    state.rates[pair.code] = pair.defaultRate;
  });

  // メモリ機能：LocalStorageから前回状態を復元
  loadStateFromLocalStorage();

  // 通貨ペア選択肢の生成
  buildPairSelectors();
  buildSwapSimPairSelector();
  
  // レート設定入力フォームの生成
  buildRatesInputs();
  
  // ポジションテーブルの描画
  renderPositions();
  
  // 資産推移面グラフの初期化
  initChart();
  
  // イベントリスナー登録
  registerEventListeners();
  
  // 初期計算とスワップ計算とグラフ描画
  updateDisplay();
  
  // リアルタイム為替レートの取得
  await fetchRealtimeRates();
}

// ===== ユーティリティ（カンマフォーマット） =====

// 数値文字列のカンマ除去と数値パース
function parseFormattedNumber(valStr) {
  if (valStr === undefined || valStr === null) return 0;
  const clean = valStr.toString().replace(/,/g, '');
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
}

// 数値を3桁カンマ付き文字列に変換
function formatNumberWithCommas(num) {
  if (num === undefined || num === null || isNaN(num)) return '0';
  const parts = num.toString().split('.');
  parts[0] = parseFloat(parts[0]).toLocaleString('ja-JP');
  return parts.join('.');
}

// テキスト入力欄への双方向カンマフォーマット適用ヘルパー
function setupCommaFormatting(inputEl, valueUpdateCallback) {
  // 初期表示のフォーマット
  const initialRawVal = parseFormattedNumber(inputEl.value);
  inputEl.value = formatNumberWithCommas(initialRawVal);

  // フォーカス時にカンマを除去して数値入力可能にする
  inputEl.addEventListener('focus', (e) => {
    const rawVal = parseFormattedNumber(e.target.value);
    e.target.value = rawVal === 0 ? '' : rawVal;
  });

  // フォーカスアウト（確定）時にカンマを再適用し、状態を確定
  inputEl.addEventListener('blur', (e) => {
    const rawVal = parseFormattedNumber(e.target.value);
    e.target.value = formatNumberWithCommas(rawVal);
    valueUpdateCallback(rawVal);
  });

  // 入力中に即時反映
  inputEl.addEventListener('input', (e) => {
    const rawVal = parseFormattedNumber(e.target.value);
    valueUpdateCallback(rawVal);
  });
}

// ===== 機能別の関数群 =====

// メモリ機能：LocalStorageへの保存
let saveTimeout;
function saveStateToLocalStorage(showIndicator = false) {
  localStorage.setItem('fx_margin_calc_state', JSON.stringify(state));
  
  if (showIndicator && els.saveStatusText) {
    els.saveStatusText.classList.remove('hidden');
    els.saveStatusText.style.opacity = '1';
    
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
      els.saveStatusText.style.opacity = '0';
      setTimeout(() => {
        els.saveStatusText.classList.add('hidden');
      }, 250);
    }, 1000);
  }
}

// メモリ機能：LocalStorageからの復元
function loadStateFromLocalStorage() {
  const saved = localStorage.getItem('fx_margin_calc_state');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      
      if (parsed.accountBalance !== undefined) state.accountBalance = parsed.accountBalance;
      if (parsed.leverage !== undefined) state.leverage = parsed.leverage;
      if (parsed.lotSize !== undefined) state.lotSize = parsed.lotSize;
      if (parsed.losscutThreshold !== undefined) state.losscutThreshold = parsed.losscutThreshold;
      
      if (parsed.positions) state.positions = parsed.positions;
      if (parsed.newOrder) state.newOrder = { ...state.newOrder, ...parsed.newOrder };
      if (parsed.rates) state.rates = { ...state.rates, ...parsed.rates };
      if (parsed.swapSim) state.swapSim = { ...state.swapSim, ...parsed.swapSim };
      
      // フォーム各値の復元（口座残高はカンマフォーマット）
      els.accountBalance.value = formatNumberWithCommas(state.accountBalance);
      
      els.leverageSelect.value = [25, 20, 10, 5, 1].includes(state.leverage) ? state.leverage : 'custom';
      if (els.leverageSelect.value === 'custom') {
        els.leverageCustom.classList.remove('hidden');
        els.leverageCustom.value = state.leverage;
      } else {
        els.leverageCustom.classList.add('hidden');
      }
      
      els.lotSizeSelect.value = [10000, 1000, 100000].includes(state.lotSize) ? state.lotSize : 'custom';
      if (els.lotSizeSelect.value === 'custom') {
        els.lotSizeCustom.classList.remove('hidden');
        els.lotSizeCustom.value = state.lotSize;
      } else {
        els.lotSizeCustom.classList.add('hidden');
      }
      
      els.newPair.value = state.newOrder.pair;
      els.newLots.value = state.newOrder.lots;
      els.newPrice.value = state.newOrder.price;
      if (state.newOrder.direction === 'buy') {
        document.getElementById('new-direction-buy').checked = true;
      } else {
        document.getElementById('new-direction-sell').checked = true;
      }
      
      els.losscutThreshold.value = state.losscutThreshold;
      
      if (els.swapSimPair) {
        els.swapSimPair.value = state.swapSim.pair;
        els.swapSimLots.value = state.swapSim.lots;
        els.swapSimPoint.value = state.swapSim.point;
      }
    } catch (e) {
      console.error('LocalStorage復元に失敗しました:', e);
    }
  }
}

// リアルタイム為替レートの取得 (API接続)
async function fetchRealtimeRates() {
  const btn = els.fetchRatesBtn;
  const updateTimeEl = els.ratesUpdateTime;
  
  if (btn) {
    btn.disabled = true;
    btn.textContent = '取得中...';
  }
  if (updateTimeEl) {
    updateTimeEl.textContent = 'レート取得中...';
  }

  try {
    const response = await fetch('https://open.er-api.com/v6/latest/USD');
    if (!response.ok) throw new Error('レート取得リクエストエラー');
    const data = await response.json();
    
    if (data && data.rates) {
      const usdRates = data.rates;
      
      CURRENCY_PAIRS.forEach(pair => {
        let rate = pair.defaultRate;
        
        if (pair.code === 'USD/JPY') {
          rate = usdRates.JPY;
        } else if (pair.code === 'EUR/JPY') {
          rate = (1 / usdRates.EUR) * usdRates.JPY;
        } else if (pair.code === 'GBP/JPY') {
          rate = (1 / usdRates.GBP) * usdRates.JPY;
        } else if (pair.code === 'AUD/JPY') {
          rate = (1 / usdRates.AUD) * usdRates.JPY;
        } else if (pair.code === 'NZD/JPY') {
          rate = (1 / usdRates.NZD) * usdRates.JPY;
        } else if (pair.code === 'CAD/JPY') {
          rate = (1 / usdRates.CAD) * usdRates.JPY;
        } else if (pair.code === 'CHF/JPY') {
          rate = (1 / usdRates.CHF) * usdRates.JPY;
        } else if (pair.code === 'ZAR/JPY') {
          rate = (1 / usdRates.ZAR) * usdRates.JPY;
        } else if (pair.code === 'MXN/JPY') {
          rate = (1 / usdRates.MXN) * usdRates.JPY;
        } else if (pair.code === 'EUR/USD') {
          rate = 1 / usdRates.EUR;
        } else if (pair.code === 'GBP/USD') {
          rate = 1 / usdRates.GBP;
        } else if (pair.code === 'AUD/USD') {
          rate = 1 / usdRates.AUD;
        }
        
        if (rate && !isNaN(rate)) {
          const decimals = pair.pipSize === 0.01 ? 3 : 4;
          state.rates[pair.code] = parseFloat(rate.toFixed(decimals));
        }
      });
      
      // 入力フォーム側の表示を更新
      CURRENCY_PAIRS.forEach(pair => {
        const inputEl = document.getElementById(`rate-input-${pair.code.replace('/', '-')}`);
        if (inputEl) {
          inputEl.value = state.rates[pair.code];
        }
      });
      
      // 新規シミュレーション注文の単価も現在のペアレートへ同期
      state.newOrder.price = state.rates[state.newOrder.pair];
      els.newPrice.value = state.rates[state.newOrder.pair];
      
      // 更新日時の反映
      const now = new Date();
      const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
      if (updateTimeEl) {
        updateTimeEl.textContent = `レート最終更新: ${timeStr}`;
      }
      
      saveStateToLocalStorage(false);
    }
  } catch (error) {
    console.error('リアルタイム為替レートの取得に失敗しました:', error);
    if (updateTimeEl) {
      updateTimeEl.textContent = '取得失敗（手動設定を使用）';
    }
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="btn-icon">
          <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"></path>
        </svg>
        レート更新
      `;
    }
    updateDisplay();
  }
}

// 通貨ペア選択肢の生成
function buildPairSelectors() {
  els.newPair.innerHTML = '';
  CURRENCY_PAIRS.forEach(pair => {
    const opt = document.createElement('option');
    opt.value = pair.code;
    opt.textContent = `${pair.code} (${pair.name})`;
    els.newPair.appendChild(opt);
  });
  
  els.newPair.value = state.newOrder.pair;
  els.newPrice.value = state.newOrder.price;
}

// 想定スワップ通貨ペア選択肢の生成
function buildSwapSimPairSelector() {
  if (!els.swapSimPair) return;
  els.swapSimPair.innerHTML = '';
  CURRENCY_PAIRS.forEach(pair => {
    const opt = document.createElement('option');
    opt.value = pair.code;
    opt.textContent = `${pair.code} (${pair.name})`;
    els.swapSimPair.appendChild(opt);
  });
  els.swapSimPair.value = state.swapSim.pair;
}

// レート入力フォームの生成
function buildRatesInputs() {
  els.ratesInputGrid.innerHTML = '';
  CURRENCY_PAIRS.forEach(pair => {
    const group = document.createElement('div');
    group.className = 'form-group';
    
    const label = document.createElement('label');
    label.className = 'form-label';
    label.setAttribute('for', `rate-input-${pair.code.replace('/', '-')}`);
    label.textContent = pair.code;
    
    const input = document.createElement('input');
    input.type = 'number';
    input.id = `rate-input-${pair.code.replace('/', '-')}`;
    input.className = 'form-input';
    input.value = state.rates[pair.code];
    input.step = pair.pipSize === 0.01 ? '0.001' : '0.0001';
    input.min = '0.001';
    
    input.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      if (!isNaN(val) && val > 0) {
        state.rates[pair.code] = val;
        if (state.newOrder.pair === pair.code) {
          state.newOrder.price = val;
          els.newPrice.value = val;
        }
        updateDisplay();
        saveStateToLocalStorage(true);
      }
    });
    
    group.appendChild(label);
    group.appendChild(input);
    els.ratesInputGrid.appendChild(group);
  });
}

// ポジションリストの描画
function renderPositions() {
  els.positionTableBody.innerHTML = '';
  
  if (state.positions.length === 0) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 6;
    td.style.textAlign = 'center';
    td.style.color = 'var(--text-dim)';
    td.textContent = '現在保有中のポジションはありません';
    tr.appendChild(td);
    els.positionTableBody.appendChild(tr);
    return;
  }
  
  state.positions.forEach(pos => {
    const tr = document.createElement('tr');
    tr.dataset.id = pos.id;
    
    // 通貨ペアセル
    const tdPair = document.createElement('td');
    const selectPair = document.createElement('select');
    selectPair.className = 'table-select';
    CURRENCY_PAIRS.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.code;
      opt.textContent = p.code;
      selectPair.appendChild(opt);
    });
    selectPair.value = pos.pair;
    selectPair.addEventListener('change', (e) => {
      pos.pair = e.target.value;
      updateDisplay();
      saveStateToLocalStorage(true);
    });
    tdPair.appendChild(selectPair);
    
    // 売買セル
    const tdDir = document.createElement('td');
    const selectDir = document.createElement('select');
    selectDir.className = 'table-select';
    
    const optBuy = document.createElement('option');
    optBuy.value = 'buy';
    optBuy.textContent = '買 (Buy)';
    const optSell = document.createElement('option');
    optSell.value = 'sell';
    optSell.textContent = '売 (Sell)';
    
    selectDir.appendChild(optBuy);
    selectDir.appendChild(optSell);
    selectDir.value = pos.direction;
    selectDir.addEventListener('change', (e) => {
      pos.direction = e.target.value;
      updateDisplay();
      saveStateToLocalStorage(true);
    });
    tdDir.appendChild(selectDir);
    
    // ロット数セル
    const tdLots = document.createElement('td');
    const inputLots = document.createElement('input');
    inputLots.type = 'number';
    inputLots.className = 'table-input';
    inputLots.value = pos.lots;
    inputLots.min = '0.01';
    inputLots.step = '0.1';
    inputLots.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      if (!isNaN(val) && val >= 0) {
        pos.lots = val;
        updateDisplay();
        saveStateToLocalStorage(true);
      }
    });
    tdLots.appendChild(inputLots);
    
    // 評価損益セル（カンマフォーマット適用）
    const tdProfit = document.createElement('td');
    const inputProfit = document.createElement('input');
    inputProfit.type = 'text';
    inputProfit.className = 'table-input';
    inputProfit.value = formatNumberWithCommas(pos.profit);
    setupCommaFormatting(inputProfit, (val) => {
      pos.profit = val;
      updateDisplay();
      saveStateToLocalStorage(true);
    });
    tdProfit.appendChild(inputProfit);
    
    // スワップセル（カンマフォーマット適用）
    const tdSwap = document.createElement('td');
    const inputSwap = document.createElement('input');
    inputSwap.type = 'text';
    inputSwap.className = 'table-input';
    inputSwap.value = formatNumberWithCommas(pos.swap);
    setupCommaFormatting(inputSwap, (val) => {
      pos.swap = val;
      updateDisplay();
      saveStateToLocalStorage(true);
    });
    tdSwap.appendChild(inputSwap);
    
    // 操作削除セル
    const tdAction = document.createElement('td');
    const btnDel = document.createElement('button');
    btnDel.className = 'btn-icon-only';
    btnDel.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="3 6 5 6 21 6"></polyline>
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        <line x1="10" y1="11" x2="10" y2="17"></line>
        <line x1="14" y1="11" x2="14" y2="17"></line>
      </svg>
    `;
    btnDel.addEventListener('click', () => {
      removePosition(pos.id);
      saveStateToLocalStorage(true);
    });
    tdAction.appendChild(btnDel);
    
    tr.appendChild(tdPair);
    tr.appendChild(tdDir);
    tr.appendChild(tdLots);
    tr.appendChild(tdProfit);
    tr.appendChild(tdSwap);
    tr.appendChild(tdAction);
    
    els.positionTableBody.appendChild(tr);
  });
}

// ポジション追加
function addPosition() {
  const newId = state.positions.length > 0 ? Math.max(...state.positions.map(p => p.id)) + 1 : 1;
  state.positions.push({
    id: newId,
    pair: 'USD/JPY',
    direction: 'buy',
    lots: 1.0,
    profit: 0,
    swap: 0
  });
  renderPositions();
  updateDisplay();
}

// ポジション削除
function removePosition(id) {
  state.positions = state.positions.filter(p => p.id !== id);
  renderPositions();
  updateDisplay();
}

// 通貨ペアの円換算レートの解決
function getJpyConversionRate(pairCode, currentRateValue) {
  const pair = CURRENCY_PAIRS.find(p => p.code === pairCode);
  if (!pair) return 0;
  
  if (pair.type === 'jpy') {
    return currentRateValue; // 直接対円
  } else if (pair.type === 'usd') {
    const usdjpyRate = state.rates['USD/JPY'] || 150.00;
    return currentRateValue * usdjpyRate;
  }
  return 0;
}

// 証拠金計算コアロジック
function calculateMargins() {
  const leverage = state.leverage;
  const lotSize = state.lotSize;
  
  let currentTotalMargin = 0;
  let totalProfit = 0;
  let totalSwap = 0;
  
  state.positions.forEach(pos => {
    const currentRate = state.rates[pos.pair] || 0;
    const jpyRate = getJpyConversionRate(pos.pair, currentRate);
    
    const margin = (pos.lots * lotSize * jpyRate) / leverage;
    currentTotalMargin += margin;
    
    totalProfit += pos.profit;
    totalSwap += pos.swap;
  });
  
  const currentEquity = state.accountBalance + totalProfit + totalSwap;
  
  let currentRatio = 0;
  if (currentTotalMargin > 0) {
    currentRatio = (currentEquity / currentTotalMargin) * 100;
  }
  
  const newPriceJpy = getJpyConversionRate(state.newOrder.pair, state.newOrder.price);
  const newOrderMargin = (state.newOrder.lots * lotSize * newPriceJpy) / leverage;
  
  const simTotalMargin = currentTotalMargin + newOrderMargin;
  const simEquity = currentEquity;
  
  let simRatio = 0;
  if (simTotalMargin > 0) {
    simRatio = (simEquity / simTotalMargin) * 100;
  }
  
  return {
    currentEquity,
    currentTotalMargin,
    currentRatio,
    simEquity,
    simTotalMargin,
    simRatio,
    newOrderMargin
  };
}

// ロスカットレート計算シミュレーション
function calculateLosscutRate(metrics) {
  const targetPairCode = state.newOrder.pair;
  const targetPair = CURRENCY_PAIRS.find(p => p.code === targetPairCode);
  if (!targetPair) return null;
  
  const lotSize = state.lotSize;
  const usdjpyRate = state.rates['USD/JPY'] || 150.00;
  
  let netLots = 0;
  
  state.positions.forEach(pos => {
    if (pos.pair === targetPairCode) {
      if (pos.direction === 'buy') {
        netLots += pos.lots;
      } else {
        netLots -= pos.lots;
      }
    }
  });
  
  if (state.newOrder.direction === 'buy') {
    netLots += state.newOrder.lots;
  } else {
    netLots -= state.newOrder.lots;
  }
  
  if (Math.abs(netLots) < 0.0001) {
    return {
      type: 'hedged',
      netLots: 0
    };
  }
  
  const losscutThresholdRatio = state.losscutThreshold / 100;
  const targetEquityLc = metrics.simTotalMargin * losscutThresholdRatio;
  const allowLoss = metrics.simEquity - targetEquityLc;
  
  if (allowLoss < 0) {
    return {
      type: 'already_liquidated',
      allowLoss: allowLoss
    };
  }
  
  let allowedDeltaPrice = 0;
  
  if (targetPair.type === 'jpy') {
    allowedDeltaPrice = allowLoss / (netLots * lotSize);
  } else if (targetPair.type === 'usd') {
    allowedDeltaPrice = allowLoss / (netLots * lotSize * usdjpyRate);
  }
  
  const referencePrice = state.newOrder.price;
  const losscutRate = referencePrice - allowedDeltaPrice;
  const distance = Math.abs(allowedDeltaPrice);
  const pips = distance / targetPair.pipSize;
  
  return {
    type: 'normal',
    netLots: netLots,
    direction: netLots > 0 ? 'buy' : 'sell',
    losscutRate: losscutRate,
    distance: distance,
    pips: pips
  };
}

// 想定スワップシミュレーションの計算
function calculateSwapSimulation() {
  if (!els.swapSimPair) return;
  
  const pairCode = state.swapSim.pair;
  const lots = state.swapSim.lots;
  const point = state.swapSim.point;
  
  // ルールに基づく単位自動補正判定：MXN/JPYとZAR/JPYは10万通貨表記のため10で除算
  let isCorrected = false;
  let noteText = '※1ロット（1万通貨）あたりのスワップ値を入力';
  
  if (pairCode === 'MXN/JPY' || pairCode === 'ZAR/JPY') {
    isCorrected = true;
    noteText = '※10万通貨の掲載値を自動で 1/10 補正（1万通貨あたり）';
  }
  
  els.swapSimNote.textContent = noteText;
  
  const pointNormalized = isCorrected ? (point / 10) : point;
  
  const dailyAmount = lots * pointNormalized;
  const monthlyAmount = dailyAmount * 30;
  const yearlyAmount = dailyAmount * 365;
  
  // カンマ付きで表示
  els.swapResDay.textContent = formatNumberWithCommas(Math.round(dailyAmount));
  els.swapResMonth.textContent = formatNumberWithCommas(Math.round(monthlyAmount));
  els.swapResYear.textContent = formatNumberWithCommas(Math.round(yearlyAmount));
}

// ===== 積み上げ面グラフ (Chart.js) =====

// グラフ初期化
function initChart() {
  const canvas = document.getElementById('asset-chart');
  if (!canvas) return;
  
  const ctx = canvas.getContext('2d');
  const labels = ['初期', '1ヶ月', '2ヶ月', '3ヶ月', '4ヶ月', '5ヶ月', '6ヶ月', '7ヶ月', '8ヶ月', '9ヶ月', '10ヶ月', '11ヶ月', '12ヶ月'];
  
  assetChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: '口座残高 (元本)',
          data: Array(13).fill(0),
          borderColor: '#2563eb',
          backgroundColor: 'rgba(37, 99, 235, 0.12)',
          fill: 'origin',
          tension: 0.1,
          pointRadius: 4,
          pointHoverRadius: 6,
          borderWidth: 2
        },
        {
          label: 'スワップ積立累計',
          data: Array(13).fill(0),
          borderColor: '#059669',
          backgroundColor: 'rgba(5, 150, 105, 0.18)',
          fill: '-1', // 下のデータセットから積み上げ
          tension: 0.1,
          pointRadius: 4,
          pointHoverRadius: 6,
          borderWidth: 2
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
          labels: {
            color: '#475569',
            font: {
              family: 'Inter, sans-serif',
              weight: '600'
            }
          }
        },
        tooltip: {
          mode: 'index',
          intersect: false,
          callbacks: {
            label: function(context) {
              let label = context.dataset.label || '';
              if (label) {
                label += ': ';
              }
              if (context.parsed.y !== null) {
                label += Math.round(context.parsed.y).toLocaleString('ja-JP') + ' 円';
              }
              return label;
            }
          }
        }
      },
      interaction: {
        mode: 'nearest',
        axis: 'x',
        intersect: false
      },
      scales: {
        x: {
          grid: {
            color: 'rgba(0, 0, 0, 0.04)'
          },
          ticks: {
            color: '#64748b'
          }
        },
        y: {
          min: 0, // Y軸を0スタートに強制設定
          stacked: true, // 積み上げを設定
          grid: {
            color: 'rgba(0, 0, 0, 0.04)'
          },
          ticks: {
            color: '#64748b',
            callback: function(value) {
              return (value / 10000).toLocaleString('ja-JP') + ' 万';
            }
          }
        }
      }
    }
  });
}

// グラフデータの更新
function updateChart() {
  if (!assetChart) return;
  
  const balance = state.accountBalance;
  
  // 想定スワップシミュレーターに入力された「1日スワップ」から推移データを生成
  const pairCode = state.swapSim.pair;
  const lots = state.swapSim.lots;
  const point = state.swapSim.point;
  
  let isCorrected = false;
  if (pairCode === 'MXN/JPY' || pairCode === 'ZAR/JPY') {
    isCorrected = true;
  }
  const pointNormalized = isCorrected ? (point / 10) : point;
  const dailySwap = lots * pointNormalized;
  
  const balanceData = [];
  const swapAccumData = [];
  
  for (let i = 0; i <= 12; i++) {
    balanceData.push(balance);
    swapAccumData.push(dailySwap * 30 * i);
  }
  
  assetChart.data.datasets[0].data = balanceData;
  assetChart.data.datasets[1].data = swapAccumData;
  assetChart.update();
}

// 画面全体の表示更新
function updateDisplay() {
  const metrics = calculateMargins();
  
  // 現在保有状況 (カンマフォーマット適用)
  els.calcEquity.textContent = formatNumberWithCommas(Math.round(metrics.currentEquity));
  els.calcMargin.textContent = formatNumberWithCommas(Math.round(metrics.currentTotalMargin));
  els.calcRatioText.textContent = metrics.currentTotalMargin > 0 ? metrics.currentRatio.toFixed(2) + '%' : '---';
  
  // 新規注文追加後 (カンマフォーマット適用)
  els.simEquity.textContent = formatNumberWithCommas(Math.round(metrics.simEquity));
  els.simMargin.textContent = formatNumberWithCommas(Math.round(metrics.simTotalMargin));
  els.calcRatio.textContent = metrics.simTotalMargin > 0 ? metrics.simRatio.toFixed(2) + '%' : '---';
  
  // ゲージ内テキストとゲージ描画
  if (metrics.simTotalMargin > 0) {
    els.simRatioText.textContent = metrics.simRatio.toFixed(1) + '%';
    updateGauge(metrics.simRatio);
  } else {
    els.simRatioText.textContent = '0.0%';
    updateGauge(0);
  }
  
  // 変化の差分
  if (metrics.currentTotalMargin > 0 && metrics.simTotalMargin > 0) {
    const diff = metrics.simRatio - metrics.currentRatio;
    els.ratioChange.textContent = (diff >= 0 ? '+' : '') + diff.toFixed(2) + '%';
    els.ratioChange.className = diff >= 0 ? 'positive' : 'negative';
  } else {
    els.ratioChange.textContent = '---';
    els.ratioChange.className = '';
  }
  
  // 安全度バッジとゲージ色の決定
  updateSafetyIndicator(metrics.simRatio, metrics.simTotalMargin);
  
  // ロスカットシミュレーション
  const lcInfo = calculateLosscutRate(metrics);
  els.simTargetPair.textContent = state.newOrder.pair;
  
  if (!lcInfo) {
    els.losscutRate.textContent = '-';
    els.losscutDistance.textContent = '-';
  } else if (lcInfo.type === 'hedged') {
    els.losscutRate.textContent = 'ロスカットなし';
    els.losscutDistance.textContent = '両建て(ネット数量0)';
  } else if (lcInfo.type === 'already_liquidated') {
    els.losscutRate.textContent = '即時ロスカット';
    els.losscutDistance.textContent = '資金不足';
  } else {
    const targetPair = CURRENCY_PAIRS.find(p => p.code === state.newOrder.pair);
    const decimals = targetPair.pipSize === 0.01 ? 3 : 4;
    const unit = targetPair.type === 'jpy' ? '円' : 'ドル';
    
    // レートも適宜カンマ適用（ドルはそのまま、円はカンマ）
    els.losscutRate.textContent = targetPair.type === 'jpy' ? formatNumberWithCommas(parseFloat(lcInfo.losscutRate.toFixed(decimals))) : lcInfo.losscutRate.toFixed(decimals);
    els.losscutDistance.textContent = `${targetPair.type === 'jpy' ? formatNumberWithCommas(parseFloat(lcInfo.distance.toFixed(decimals))) : lcInfo.distance.toFixed(decimals)}${unit} (${lcInfo.pips.toFixed(1)} pips)`;
  }
  
  // スワップシミュレーション計算
  calculateSwapSimulation();
  
  // 積み上げ面グラフ更新
  updateChart();
}

// ゲージ描画の更新
function updateGauge(ratio) {
  const circle = els.simGaugeCircle;
  const radius = circle.r.baseVal.value;
  const circumference = 2 * Math.PI * radius;
  
  circle.style.strokeDasharray = circumference;
  
  const maxPercent = 500;
  const percent = Math.min(ratio, maxPercent) / maxPercent;
  const offset = circumference - (percent * circumference);
  
  circle.style.strokeDashoffset = offset;
}

// 安全度インジケーターの更新
function updateSafetyIndicator(ratio, margin) {
  const badge = els.safetyBadge;
  const circle = els.simGaugeCircle;
  
  if (margin === 0) {
    badge.textContent = 'ポジションなし';
    badge.className = 'summary-status-badge safe';
    circle.style.stroke = 'var(--accent)';
    return;
  }
  
  if (ratio >= 300) {
    badge.textContent = '安全';
    badge.className = 'summary-status-badge safe';
    circle.style.stroke = 'var(--success)';
  } else if (ratio >= 150) {
    badge.textContent = '注意';
    badge.className = 'summary-status-badge warning';
    circle.style.stroke = 'var(--warning)';
  } else {
    badge.textContent = '危険 (ロスカット懸念)';
    badge.className = 'summary-status-badge danger';
    circle.style.stroke = 'var(--danger)';
  }
}

// ===== イベントリスナー設定 =====
function registerEventListeners() {
  // 口座残高フォーマット＆変更適用
  setupCommaFormatting(els.accountBalance, (val) => {
    state.accountBalance = val;
    updateDisplay();
    saveStateToLocalStorage(true);
  });
  
  // レバレッジ変更
  els.leverageSelect.addEventListener('change', (e) => {
    if (e.target.value === 'custom') {
      els.leverageCustom.classList.remove('hidden');
      state.leverage = parseFloat(els.leverageCustom.value) || 25;
    } else {
      els.leverageCustom.classList.add('hidden');
      state.leverage = parseFloat(e.target.value);
    }
    updateDisplay();
    saveStateToLocalStorage(true);
  });
  
  els.leverageCustom.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    if (!isNaN(val) && val > 0) {
      state.leverage = val;
      updateDisplay();
      saveStateToLocalStorage(true);
    }
  });
  
  // 1ロットあたり通貨数変更
  els.lotSizeSelect.addEventListener('change', (e) => {
    if (e.target.value === 'custom') {
      els.lotSizeCustom.classList.remove('hidden');
      state.lotSize = parseFloat(els.lotSizeCustom.value) || 10000;
    } else {
      els.lotSizeCustom.classList.add('hidden');
      state.lotSize = parseFloat(e.target.value);
    }
    updateDisplay();
    saveStateToLocalStorage(true);
  });
  
  els.lotSizeCustom.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    if (!isNaN(val) && val > 0) {
      state.lotSize = val;
      updateDisplay();
      saveStateToLocalStorage(true);
    }
  });
  
  // ポジション追加ボタン
  els.addPositionBtn.addEventListener('click', () => {
    addPosition();
    saveStateToLocalStorage(true);
  });
  
  // 新規シミュレーション通貨ペア変更
  els.newPair.addEventListener('change', (e) => {
    const code = e.target.value;
    state.newOrder.pair = code;
    
    const currentPrice = state.rates[code] || 0;
    state.newOrder.price = currentPrice;
    els.newPrice.value = currentPrice;
    
    updateDisplay();
    saveStateToLocalStorage(true);
  });
  
  // 新規シミュレーション売買方向変更
  document.getElementsByName('new-direction').forEach(radio => {
    radio.addEventListener('change', (e) => {
      state.newOrder.direction = e.target.value;
      updateDisplay();
      saveStateToLocalStorage(true);
    });
  });
  
  // 新規シミュレーションロット数変更
  els.newLots.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    if (!isNaN(val) && val >= 0) {
      state.newOrder.lots = val;
      updateDisplay();
      saveStateToLocalStorage(true);
    }
  });
  
  // 新規シミュレーション注文単価変更
  els.newPrice.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    if (!isNaN(val) && val >= 0) {
      state.newOrder.price = val;
      updateDisplay();
      saveStateToLocalStorage(true);
    }
  });
  
  // ロスカット基準維持率変更
  els.losscutThreshold.addEventListener('change', (e) => {
    state.losscutThreshold = parseFloat(e.target.value);
    updateDisplay();
    saveStateToLocalStorage(true);
  });
  
  // レート設定アコーディオンの開閉
  els.ratesAccordionToggle.addEventListener('click', () => {
    const isOpen = els.ratesAccordionCard.classList.contains('open');
    if (isOpen) {
      els.ratesAccordionCard.classList.remove('open');
      els.ratesAccordionContent.classList.add('hidden');
    } else {
      els.ratesAccordionCard.classList.add('open');
      els.ratesAccordionContent.classList.remove('hidden');
    }
  });
  
  // リアルタイムレート手動更新ボタン
  if (els.fetchRatesBtn) {
    els.fetchRatesBtn.addEventListener('click', fetchRealtimeRates);
  }
  
  // 想定スワップシミュレーターペア変更
  if (els.swapSimPair) {
    els.swapSimPair.addEventListener('change', (e) => {
      state.swapSim.pair = e.target.value;
      if (e.target.value === 'MXN/JPY' || e.target.value === 'ZAR/JPY') {
        state.swapSim.point = 280.0;
      } else if (e.target.value === 'TRY/JPY') {
        state.swapSim.point = 1500.0;
      } else {
        state.swapSim.point = 230.0;
      }
      els.swapSimPoint.value = state.swapSim.point;
      
      updateDisplay();
      saveStateToLocalStorage(true);
    });
    
    // 想定スワップロット数変更
    els.swapSimLots.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      if (!isNaN(val) && val >= 0) {
        state.swapSim.lots = val;
        updateDisplay();
        saveStateToLocalStorage(true);
      }
    });
    
    // 想定スワップポイント（手動入力値）変更
    els.swapSimPoint.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      if (!isNaN(val) && val >= 0) {
        state.swapSim.point = val;
        updateDisplay();
        saveStateToLocalStorage(true);
      }
    });
  }
}

// ===== 起動 =====
document.addEventListener('DOMContentLoaded', init);
