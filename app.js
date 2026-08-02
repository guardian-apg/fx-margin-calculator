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
  losscutThreshold: 100
};

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

  // 通貨ペア選択肢の生成
  buildPairSelectors();
  
  // レート設定入力フォームの生成
  buildRatesInputs();
  
  // ポジションテーブルの描画
  renderPositions();
  
  // イベントリスナー登録
  registerEventListeners();
  
  // 初期計算
  updateDisplay();
  
  // リアルタイム為替レートの取得
  await fetchRealtimeRates();
}

// ===== 機能別の関数群 =====

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
    // ExchangeRate-API (無料・CORS対応) を使用
    const response = await fetch('https://open.er-api.com/v6/latest/USD');
    if (!response.ok) throw new Error('レート取得リクエストエラー');
    const data = await response.json();
    
    if (data && data.rates) {
      const usdRates = data.rates;
      
      CURRENCY_PAIRS.forEach(pair => {
        let rate = pair.defaultRate;
        
        // 各通貨ペアの対円/対ドルレートを算出
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
          // pipsサイズに応じた精度で丸める
          // 対円は小数点以下3桁、ドルストレートは4桁
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
  
  // 初期値の同期
  els.newPair.value = state.newOrder.pair;
  els.newPrice.value = state.rates[state.newOrder.pair];
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
        // 新規注文単価が現在ペアと同じなら同期する
        if (state.newOrder.pair === pair.code) {
          state.newOrder.price = val;
          els.newPrice.value = val;
        }
        updateDisplay();
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
      }
    });
    tdLots.appendChild(inputLots);
    
    // 評価損益セル
    const tdProfit = document.createElement('td');
    const inputProfit = document.createElement('input');
    inputProfit.type = 'number';
    inputProfit.className = 'table-input';
    inputProfit.value = pos.profit;
    inputProfit.step = '100';
    inputProfit.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      if (!isNaN(val)) {
        pos.profit = val;
        updateDisplay();
      }
    });
    tdProfit.appendChild(inputProfit);
    
    // スワップセル
    const tdSwap = document.createElement('td');
    const inputSwap = document.createElement('input');
    inputSwap.type = 'number';
    inputSwap.className = 'table-input';
    inputSwap.value = pos.swap;
    inputSwap.step = '100';
    inputSwap.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      if (!isNaN(val)) {
        pos.swap = val;
        updateDisplay();
      }
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
    // 決済通貨がUSDのため、米ドル/円(USD/JPY)のレートを掛けることで対円レートを算出
    const usdjpyRate = state.rates['USD/JPY'] || 150.00;
    return currentRateValue * usdjpyRate;
  }
  return 0;
}

// 証拠金計算コアロジック
function calculateMargins() {
  const leverage = state.leverage;
  const lotSize = state.lotSize;
  
  // 1. 現在のポジション集計
  let currentTotalMargin = 0;
  let totalProfit = 0;
  let totalSwap = 0;
  
  state.positions.forEach(pos => {
    const currentRate = state.rates[pos.pair] || 0;
    const jpyRate = getJpyConversionRate(pos.pair, currentRate);
    
    // 必要証拠金 = 取引金額 (ロット数 * 1ロット通貨数 * 円換算レート) / レバレッジ
    const margin = (pos.lots * lotSize * jpyRate) / leverage;
    currentTotalMargin += margin;
    
    totalProfit += pos.profit;
    totalSwap += pos.swap;
  });
  
  // 現在の有効有高 = 口座残高 + 評価損益 + スワップ
  const currentEquity = state.accountBalance + totalProfit + totalSwap;
  
  // 現在の証拠金維持率
  let currentRatio = 0;
  if (currentTotalMargin > 0) {
    currentRatio = (currentEquity / currentTotalMargin) * 100;
  }
  
  // 2. 新規シミュレーション注文の計算
  const newPairObj = CURRENCY_PAIRS.find(p => p.code === state.newOrder.pair);
  const newPriceJpy = getJpyConversionRate(state.newOrder.pair, state.newOrder.price);
  const newOrderMargin = (state.newOrder.lots * lotSize * newPriceJpy) / leverage;
  
  // 想定必要証拠金 = 現在の必要証拠金 + 新規注文の必要証拠金
  const simTotalMargin = currentTotalMargin + newOrderMargin;
  
  // 想定有効有高（新規注文時の含み損益は最初は0と想定）
  const simEquity = currentEquity;
  
  // 想定証拠金維持率
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
  
  // 現在ポジションの集計
  state.positions.forEach(pos => {
    if (pos.pair === targetPairCode) {
      if (pos.direction === 'buy') {
        netLots += pos.lots;
      } else {
        netLots -= pos.lots;
      }
    }
  });
  
  // 新規ポジションの加算
  if (state.newOrder.direction === 'buy') {
    netLots += state.newOrder.lots;
  } else {
    netLots -= state.newOrder.lots;
  }
  
  // ネットロットが0の場合は両建て状態
  if (Math.abs(netLots) < 0.0001) {
    return {
      type: 'hedged',
      netLots: 0
    };
  }
  
  // ロスカット発生基準額 (必要証拠金 * 基準維持率)
  const losscutThresholdRatio = state.losscutThreshold / 100;
  const targetEquityLc = metrics.simTotalMargin * losscutThresholdRatio;
  
  // 許容される損失額
  const allowLoss = metrics.simEquity - targetEquityLc;
  
  // 既にロスカット基準を下回っている場合
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

// 画面全体の表示更新
function updateDisplay() {
  const metrics = calculateMargins();
  
  // 現在保有状況
  els.calcEquity.textContent = Math.round(metrics.currentEquity).toLocaleString();
  els.calcMargin.textContent = Math.round(metrics.currentTotalMargin).toLocaleString();
  els.calcRatioText.textContent = metrics.currentTotalMargin > 0 ? metrics.currentRatio.toFixed(2) + '%' : '---';
  
  // 新規注文追加後
  els.simEquity.textContent = Math.round(metrics.simEquity).toLocaleString();
  els.simMargin.textContent = Math.round(metrics.simTotalMargin).toLocaleString();
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
    
    els.losscutRate.textContent = lcInfo.losscutRate.toFixed(decimals);
    els.losscutDistance.textContent = `${lcInfo.distance.toFixed(decimals)}${unit} (${lcInfo.pips.toFixed(1)} pips)`;
  }
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
  // 口座残高変更
  els.accountBalance.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    if (!isNaN(val) && val >= 0) {
      state.accountBalance = val;
      updateDisplay();
    }
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
  });
  
  els.leverageCustom.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    if (!isNaN(val) && val > 0) {
      state.leverage = val;
      updateDisplay();
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
  });
  
  els.lotSizeCustom.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    if (!isNaN(val) && val > 0) {
      state.lotSize = val;
      updateDisplay();
    }
  });
  
  // ポジション追加ボタン
  els.addPositionBtn.addEventListener('click', addPosition);
  
  // 新規シミュレーション通貨ペア変更
  els.newPair.addEventListener('change', (e) => {
    const code = e.target.value;
    state.newOrder.pair = code;
    
    // 設定されている現在レートに同期
    const currentPrice = state.rates[code] || 0;
    state.newOrder.price = currentPrice;
    els.newPrice.value = currentPrice;
    
    updateDisplay();
  });
  
  // 新規シミュレーション売買方向変更
  document.getElementsByName('new-direction').forEach(radio => {
    radio.addEventListener('change', (e) => {
      state.newOrder.direction = e.target.value;
      updateDisplay();
    });
  });
  
  // 新規シミュレーションロット数変更
  els.newLots.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    if (!isNaN(val) && val >= 0) {
      state.newOrder.lots = val;
      updateDisplay();
    }
  });
  
  // 新規シミュレーション注文単価変更
  els.newPrice.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    if (!isNaN(val) && val >= 0) {
      state.newOrder.price = val;
      updateDisplay();
    }
  });
  
  // ロスカット基準維持率変更
  els.losscutThreshold.addEventListener('change', (e) => {
    state.losscutThreshold = parseFloat(e.target.value);
    updateDisplay();
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
}

// ===== 起動 =====
document.addEventListener('DOMContentLoaded', init);
