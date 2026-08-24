import { TILE_LABELS } from './engine.js';
import { tileFaceMarkup } from './tiles.js';
import { FullGameSession } from './full-game.js';
import { SanmaGameSession } from './sanma-game.js';
import { WIND_LABELS, coreTileToNumber, meldTiles, tableSnapshot } from './full-game-view.js';
import { QUESTIONS } from './questions.js';

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
let game = null;
let botBusy = false;
let lastDiscardPlayer = null;
let riichiArmed = false;
let audioContext = null;
let quizIndex = Number(localStorage.getItem('jpmahjong-quiz-index') || 0) % QUESTIONS.length;
let quizDone = JSON.parse(localStorage.getItem('jpmahjong-quiz-done') || '[]');
let selectedPlayerCount = Number(localStorage.getItem('jpmahjong-player-count')) === 3 ? 3 : 4;

function tileMarkup(tile, className = '') {
  return `<button class="tile ${className}" data-tile="${tile}" aria-label="${TILE_LABELS[tile]}">${tileFaceMarkup(tile)}</button>`;
}

function buildTableFurniture() {
  const back = '<span class="wall-tile"><img src="assets/tiles/regular/Back.svg" alt=""></span>';
  ['#wallTop', '#wallLeft', '#wallRight', '#wallBottom'].forEach(selector => {
    $(selector).innerHTML = back.repeat(17);
  });
  $('#doraTile').innerHTML = tileFaceMarkup(3);
}

const delay = milliseconds => new Promise(resolve => window.setTimeout(resolve, milliseconds));

function playTileSound() {
  try {
    audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === 'suspended') audioContext.resume();
    const duration = .055;
    const buffer = audioContext.createBuffer(1, audioContext.sampleRate * duration, audioContext.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (data.length * .16));
    const source = audioContext.createBufferSource();
    const filter = audioContext.createBiquadFilter();
    const gain = audioContext.createGain();
    filter.type = 'bandpass'; filter.frequency.value = 920; filter.Q.value = .75;
    gain.gain.setValueAtTime(.17, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(.001, audioContext.currentTime + duration);
    source.buffer = buffer; source.connect(filter); filter.connect(gain); gain.connect(audioContext.destination); source.start();
  } catch { /* Sound is optional when the browser blocks Web Audio. */ }
}

function nextRiverRect(player) {
  const river = $(`#river${player}`);
  const target = document.createElement('span');
  target.className = 'river-tile flight-target';
  target.style.visibility = 'hidden';
  river.append(target);
  const rect = target.getBoundingClientRect();
  target.remove();
  return rect;
}

async function flyTile(faceMarkup, startRect, player) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const targetRect = nextRiverRect(player);
  const flyer = document.createElement('span');
  flyer.className = 'flying-tile';
  flyer.innerHTML = faceMarkup;
  Object.assign(flyer.style, { left: `${startRect.left}px`, top: `${startRect.top}px`, width: `${startRect.width}px`, height: `${startRect.height}px` });
  document.body.append(flyer);
  const dx = targetRect.left - startRect.left;
  const dy = targetRect.top - startRect.top;
  const scale = Math.max(.42, targetRect.width / Math.max(1, startRect.width));
  const rotation = player === 1 ? -90 : player === 2 ? 180 : player === 3 ? 90 : -2;
  const animation = flyer.animate([
    { transform: 'translate3d(0,0,0) rotate(0deg) scale(1)', filter: 'brightness(1)', offset: 0 },
    { transform: `translate3d(${dx * .68}px,${dy * .68 - 22}px,0) rotate(${rotation * .6}deg) scale(${Math.max(scale, .72)})`, filter: 'brightness(1.06)', offset: .68 },
    { transform: `translate3d(${dx}px,${dy}px,0) rotate(${rotation}deg) scale(${scale})`, filter: 'brightness(.98)', offset: 1 }
  ], { duration: 310, easing: 'cubic-bezier(.2,.72,.25,1)', fill: 'forwards' });
  await animation.finished.catch(() => {});
  flyer.remove();
}

async function animateWallDraw(player) {
  const wall = $({ 1: '#wallRight', 2: '#wallTop', 3: '#wallLeft' }[player]);
  wall?.classList.add('drawing');
  await delay(170);
  wall?.classList.remove('drawing');
}

async function animateAiDiscard(player, tile, red = false) {
  const plaque = $({ 1: '.plaque-right', 2: '.plaque-top', 3: '.plaque-left' }[player]);
  const wall = $({ 1: '#wallRight', 2: '#wallTop', 3: '#wallLeft' }[player]);
  const plaqueRect = plaque.getBoundingClientRect();
  const sourceRect = plaqueRect.width ? plaqueRect : wall.getBoundingClientRect();
  const startRect = { left: sourceRect.left + sourceRect.width / 2 - 22, top: sourceRect.top + sourceRect.height / 2 - 30, width: 44, height: 61 };
  await flyTile(tileFaceMarkup(tile, red), startRect, player);
}

function route(name) {
  document.body.dataset.view = name;
  $$('.view').forEach(view => view.classList.add('hidden'));
  $(`#${name}View`).classList.remove('hidden');
  $$('.nav-link').forEach(link => link.classList.toggle('active', link.dataset.route === name));
  if (name === 'table' && !game) startGame();
  if (name === 'quiz') renderQuiz();
  location.hash = name;
}

$$('[data-route]').forEach(control => control.addEventListener('click', event => {
  event.preventDefault();
  route(control.dataset.route);
}));

function updateModeUI() {
  $$('[data-player-count]').forEach(button => button.classList.toggle('active', Number(button.dataset.playerCount) === selectedPlayerCount));
}

function startGame() {
  game?.stop?.();
  document.body.dataset.players = String(selectedPlayerCount);
  botBusy = false;
  riichiArmed = false;
  $('#resultModal').classList.add('hidden');
  const Session = selectedPlayerCount === 3 ? SanmaGameSession : FullGameSession;
  const session = new Session({
    speed: selectedPlayerCount === 3 ? 380 : 2,
    onEvent: handleCoreEvent,
    onDecision: handleDecision,
    onComplete: paipu => { game.paipu = paipu; }
  });
  game = session;
  session.start();
}

function renderGame() {
  const snapshot = tableSnapshot(game);
  if (!snapshot) return;
  const pending = game.human.pending;
  const discardTurn = ['draw', 'post-call-discard'].includes(pending?.kind);
  const responseTurn = ['discard-response', 'kan-response', 'kita-choice'].includes(pending?.kind);
  const currentSeat = snapshot.seats.find(seat => seat.position === snapshot.currentPosition);
  $('#roundText').textContent = snapshot.roundLabel;
  $('.sidebar-content h2').textContent = snapshot.roundLabel;
  $('.table-center b').textContent = snapshot.roundLabel;
  $('.table-center span').textContent = `供托 × ${snapshot.riichiSticks}　 本场 × ${snapshot.honba}`;
  $('#wallText').textContent = `${game.mode === 'sanma' ? '三麻' : '四麻'} · 牌山 ${snapshot.wallRemaining}`;
  $('#centerWall').textContent = snapshot.wallRemaining;
  $('.rule-note span').innerHTML = game.mode === 'sanma'
    ? '三人立直麻将<br>无二万至八万 · 拔北 · 三麻自摸损'
    : '完整四人立直麻将<br>半庄 · 赤牌 · 食断 · 途中流局';
  $('#turnSeal').textContent = currentSeat?.windLabel || snapshot.seats[0].windLabel;
  $('#turnLabel').textContent = discardTurn ? 'YOUR TURN' : 'MATCH IN PROGRESS';
  $('#turnName').textContent = `你 · ${WIND_LABELS[snapshot.humanWind]}家${snapshot.seats[0].kitaCount ? ` · 北×${snapshot.seats[0].kitaCount}` : ''}`;
  $('#turnMessage').textContent = pending?.kind === 'kita-choice' ? '选择拔北，或把北留在手牌中' : responseTurn ? '可以和牌或鸣牌，也可以跳过' : discardTurn ? (riichiArmed ? '选择立直宣言牌' : '选择一张牌打出') : '电脑雀士正在行动…';
  $('.player-score').textContent = snapshot.seats[0].score.toLocaleString('zh-CN');

  const plaqueSelectors = { 1: '.plaque-right', 2: '.plaque-top', 3: '.plaque-left' };
  const markerSelectors = { 0: '.marker-bottom', 1: '.marker-right', 2: '.marker-top', 3: '.marker-left' };
  snapshot.seats.forEach(seat => {
    $(markerSelectors[seat.position]).textContent = seat.windLabel;
    const plaque = plaqueSelectors[seat.position] && $(plaqueSelectors[seat.position]);
    if (plaque) {
      plaque.querySelector('b').textContent = seat.windLabel;
      plaque.querySelector('span').textContent = ['你', '竹林の道', '静寂の庭', '月下の牌'][seat.playerId] + (seat.kitaCount ? ` · 北×${seat.kitaCount}` : '');
      plaque.querySelector('strong').textContent = seat.score.toLocaleString('zh-CN');
    }
    $(`#river${seat.position}`).innerHTML = seat.river.map((tile, index) => `<span class="river-tile ${tile.red ? 'red-five' : ''} ${tile.riichi ? 'riichi' : ''} ${tile.claimed ? 'claimed' : ''} ${seat.position === lastDiscardPlayer && index === seat.river.length - 1 ? 'land' : ''}">${tileFaceMarkup(tile.tile, tile.red)}</span>`).join('');
  });
  $('#seatList').innerHTML = snapshot.seats.map(seat => `<li class="${seat.position === snapshot.currentPosition ? 'current' : ''}"><b>${seat.human ? '你' : ['你', '竹林', '静寂', '月下'][seat.playerId]} · ${seat.windLabel}家${seat.kitaCount ? ` · 北×${seat.kitaCount}` : ''}</b><span>${seat.score.toLocaleString('zh-CN')} 点</span></li>`).join('');
  $('#doraTile').innerHTML = snapshot.doraIndicators.map(tile => `<span>${tileFaceMarkup(tile.tile)}</span>`).join('');
  const humanSeat = snapshot.seats[0];
  $('#meldArea').innerHTML = humanSeat.melds.map(meld => `<span class="meld-group">${meld.tiles.map(tile => `<i>${tileFaceMarkup(tile.tile, tile.red)}</i>`).join('')}</span>`).join('');
  $('#hand').classList.toggle('waiting', !discardTurn);
  $('#hand').innerHTML = snapshot.hand.map((item, index) => `<button class="tile ${item.drawn ? 'drawn' : ''} ${item.red ? 'red-five' : ''}" data-index="${index}" data-code="${item.code}" data-tile="${item.tile}" data-red="${item.red}" data-drawn="${item.drawn}" aria-label="${TILE_LABELS[item.tile]}">${tileFaceMarkup(item.tile, item.red)}</button>`).join('');

  const calls = pending?.options?.fulou || [];
  $('#chiButton').disabled = !calls.some(meld => meldType(meld) === 'chi');
  $('#ponButton').disabled = !calls.some(meld => meldType(meld) === 'pon');
  const kans = [...calls.filter(meld => meldType(meld) === 'kan'), ...(pending?.options?.gang || [])];
  $('#kanButton').disabled = !kans.length;
  $('#kitaButton').classList.toggle('hidden', game.mode !== 'sanma');
  $('#kitaButton').disabled = !pending?.options?.kita;
  $('#riichiButton').disabled = !(pending?.options?.riichi?.length);
  $('#riichiButton').classList.toggle('active', riichiArmed);
  $('#ronButton').disabled = !(responseTurn && pending?.options?.hule);
  $('#tsumoButton').classList.toggle('hidden', !(pending?.kind === 'draw' && pending.options.hule));
  $('#abortButton').classList.toggle('hidden', !(pending?.kind === 'draw' && pending.options.daopai));
  $('#sortButton').disabled = true;
  $('#sortButton').textContent = '已自动理牌';
  $('#skipCallButton').classList.toggle('hidden', !responseTurn);
  $('#skipCallButton').textContent = pending?.kind === 'kita-choice' ? '保留北' : '跳过';
  $('#callStatus').textContent = pending?.kind === 'kita-choice' ? '拔北选择' : responseTurn ? '鸣牌机会' : '鸣牌';
  $('.hand-actions').classList.toggle('call-ready', responseTurn);
  bindHand();
  lastDiscardPlayer = null;
}

function bindHand() {
  $$('#hand .tile').forEach(tile => tile.addEventListener('click', async () => {
    const pending = game.human.pending;
    if (botBusy || !['draw', 'post-call-discard'].includes(pending?.kind)) return;
    const code = tile.dataset.code;
    const drawn = tile.dataset.drawn === 'true';
    const legal = pending.options.dapai || [];
    let discardCode = game.mode === 'sanma'
      ? legal.find(option => option === code)
      : legal.find(option => option.slice(0, 2) === code && option.includes('_') === drawn)
        || legal.find(option => option.slice(0, 2) === code);
    if (!discardCode) return;
    if (riichiArmed) {
      if (!pending.options.riichi.includes(discardCode)) return;
      discardCode += '*';
    }
    botBusy = true;
    tile.classList.add('discarding');
    await flyTile(tileFaceMarkup(Number(tile.dataset.tile), tile.dataset.red === 'true'), tile.getBoundingClientRect(), 0).catch(() => {});
    game.submit({ dapai: discardCode });
    lastDiscardPlayer = 0;
    riichiArmed = false;
    playTileSound();
    botBusy = false;
    renderGame();
  }));
}

function meldType(meld) {
  if (meld.startsWith('pon:')) return 'pon';
  if (meld.startsWith('daiminkan:') || meld.startsWith('ankan:') || meld.startsWith('kakan:')) return 'kan';
  const digits = meld.replace(/[^0-9]/g, '').replace(/0/g, '5');
  if (digits.length === 4) return 'kan';
  if (new Set(digits).size === 1) return 'pon';
  return 'chi';
}

function useCall(type) {
  const pending = game.human.pending;
  if (!pending) return;
  const source = type === 'kan' && pending.options.gang?.length
    ? pending.options.gang.map(code => ({ code, reply: { gang: code } }))
    : (pending.options.fulou || []).filter(code => meldType(code) === type).map(code => ({ code, reply: { fulou: code } }));
  showChoices(source);
}

function showChoices(choices) {
  if (!choices.length) return;
  if (choices.length === 1) return game.submit(choices[0].reply);
  const panel = $('#choicePanel');
  panel.innerHTML = choices.map((choice, index) => `<button data-choice="${index}">${choiceMarkup(choice.code)}</button>`).join('');
  panel.classList.remove('hidden');
  $$('[data-choice]').forEach(button => button.addEventListener('click', () => {
    panel.classList.add('hidden');
    game.submit(choices[Number(button.dataset.choice)].reply);
  }));
}

function choiceMarkup(code) {
  if (code.includes(':')) {
    const [kind, value] = code.split(':');
    const count = kind === 'pon' ? 3 : 4;
    const red = value.endsWith('r');
    return tileFaceMarkup(Number(value.replace('r', '')), red).repeat(count);
  }
  return meldTiles(code).map(tile => tileFaceMarkup(tile.tile, tile.red)).join('');
}

$('#chiButton').addEventListener('click', () => useCall('chi'));
$('#ponButton').addEventListener('click', () => useCall('pon'));
$('#kanButton').addEventListener('click', () => useCall('kan'));
$('#kitaButton').addEventListener('click', () => game.submit({ kita: true }));
$('#skipCallButton').addEventListener('click', () => {
  game.submit({});
});
$('#riichiButton').addEventListener('click', () => { riichiArmed = !riichiArmed; renderGame(); });
$('#ronButton').addEventListener('click', () => game.submit({ hule: '-' }));
$('#tsumoButton').addEventListener('click', () => game.submit({ hule: '-' }));
$('#abortButton').addEventListener('click', () => game.submit({ daopai: '-' }));

async function handleCoreEvent(event) {
  const snapshot = tableSnapshot(game);
  const actorPosition = event.payload?.l == null ? null
    : snapshot?.seats.find(seat => game.mode === 'sanma' ? seat.playerId === event.payload.l : seat.wind === event.payload.l)?.position;
  if ((event.type === 'zimo' || event.type === 'gangzimo') && actorPosition > 0) {
    await animateWallDraw(actorPosition);
  }
  if (event.type === 'dapai') {
    lastDiscardPlayer = actorPosition ?? null;
    if (actorPosition > 0) {
      const tile = game.mode === 'sanma' ? event.payload.p : coreTileToNumber(event.payload.p);
      await animateAiDiscard(actorPosition, tile, Boolean(event.payload.action?.aka));
    }
    playTileSound();
  }
  renderGame();
}

function handleDecision(decision) {
  botBusy = false;
  riichiArmed = false;
  if (decision.kind === 'round-result') {
    if (decision.options.hule) showHuleResult(decision.options.hule);
    else if (decision.options.sanmaResult) showSanmaResult(decision.options.sanmaResult);
    else showResult(decision.options.pingju.name || '荒牌流局', '听牌罚符、本场与供托已由完整规则核心结算。');
  }
  else if (decision.kind === 'match-result') {
    const scores = decision.payload.defen || decision.options.ranking?.map(item => item.score) || [];
    showResult('半庄结束', scores.map((score, index) => `${index + 1}位 ${score.toLocaleString('zh-CN')}点`).join('　'));
  }
  renderGame();
}

function showSanmaResult(result) {
  const winner = result.winners[0];
  const yaku = (winner.yakuList || winner.yaku || []).map(item => item.name).join(' · ');
  const dora = winner.doraCount ? ` · 宝牌×${winner.doraCount}` : '';
  const title = result.type === 'nagashi' ? '流し満貫'
    : result.type === 'tsumo' ? `${WIND_LABELS[(winner.winner + 3 - game.state.dealer) % 3]}家 自摸`
    : `${result.winners.length > 1 ? '双响' : '荣和'}`;
  showResult(title, `${yaku || '和牌'}${dora}　${winner.fu || 0}符 ${winner.totalHan || winner.han || 0}番`);
}

function showHuleResult(result) {
  const yakus = (result.hupai || []).map(yaku => yaku.name).join(' · ');
  const limit = result.damanguan ? `${result.damanguan}倍役满` : `${result.fu || 0}符 ${result.fanshu || 0}番`;
  showResult(`${WIND_LABELS[result.l]}家 ${result.baojia == null ? '自摸' : '荣和'}`, `${yakus || '和牌'}　${limit}　${Number(result.defen || 0).toLocaleString('zh-CN')}点`);
}

function showResult(title, copy) {
  $('#resultTitle').textContent = title;
  $('#resultCopy').textContent = copy;
  $('#resultModal').classList.remove('hidden');
}

$('#newRoundButton').addEventListener('click', () => {
  $('#resultModal').classList.add('hidden');
  if (game?.human?.pending?.kind === 'match-result') game.submit({});
  else if (game?.human?.pending?.kind === 'round-result') game.submit({});
  else startGame();
});
$('#restartButton').addEventListener('click', startGame);
$$('[data-player-count]').forEach(button => button.addEventListener('click', () => {
  selectedPlayerCount = Number(button.dataset.playerCount);
  localStorage.setItem('jpmahjong-player-count', String(selectedPlayerCount));
  updateModeUI();
  route('table');
  startGame();
}));
$('#sidebarToggle').addEventListener('click', () => {
  const sidebar = $('#tableSidebar');
  const collapsed = sidebar.classList.toggle('collapsed');
  $('#sidebarToggle').textContent = collapsed ? '›' : '‹';
  $('#sidebarToggle').setAttribute('aria-expanded', String(!collapsed));
  $('#sidebarToggle').setAttribute('aria-label', collapsed ? '展开牌局信息' : '收起牌局信息');
});

function renderQuiz() {
  const question = QUESTIONS[quizIndex];
  $('#quizProgress').textContent = `第 ${quizIndex + 1} / ${QUESTIONS.length} 题`;
  $('#quizRound').textContent = question.round;
  $('#quizDora').textContent = `宝牌表示：${TILE_LABELS[question.dora]}`;
  $('#quizHand').innerHTML = question.hand.map(tile => `<span class="tile">${tileFaceMarkup(tile)}</span>`).join('');
  $('#quizOptions').innerHTML = question.options.map(tile => `<button data-answer="${tile}">${TILE_LABELS[tile]}</button>`).join('');
  $('#quizResult').classList.add('hidden');
  $('#nextQuestion').classList.add('hidden');
  $('#quizOptions').classList.remove('answered');
  $('#quizOptions').querySelectorAll('button').forEach(button => button.addEventListener('click', () => answerQuiz(Number(button.dataset.answer))));
  updateQuizStats();
}

function answerQuiz(answer) {
  const question = QUESTIONS[quizIndex];
  const correct = answer === question.answer;
  const buttons = $('#quizOptions').querySelectorAll('button');
  buttons.forEach(button => {
    button.disabled = true;
    if (Number(button.dataset.answer) === question.answer) button.classList.add('correct');
    if (Number(button.dataset.answer) === answer && !correct) button.classList.add('wrong');
  });
  $('#quizOptions').classList.add('answered');
  $('#quizResult').innerHTML = `<strong>${correct ? '正解' : '再想一步'} · ${question.title}</strong><p>${question.explanation}</p>`;
  $('#quizResult').classList.remove('hidden');
  $('#nextQuestion').classList.remove('hidden');
  if (!quizDone.includes(quizIndex)) {
    quizDone.push(quizIndex);
    localStorage.setItem('jpmahjong-quiz-done', JSON.stringify(quizDone));
  }
  const today = new Date().toISOString().slice(0, 10);
  localStorage.setItem('jpmahjong-last-day', today);
  updateQuizStats();
}

function updateQuizStats() {
  const completed = quizDone.length;
  $('#chapterScore').textContent = `${completed} / ${QUESTIONS.length} 完成`;
  $('#chapterProgress').style.width = `${Math.min(100, completed / QUESTIONS.length * 100)}%`;
  $('#streakValue').textContent = localStorage.getItem('jpmahjong-last-day') ? '1 日' : '0 日';
}

$('#nextQuestion').addEventListener('click', () => {
  quizIndex = (quizIndex + 1) % QUESTIONS.length;
  localStorage.setItem('jpmahjong-quiz-index', quizIndex);
  renderQuiz();
});

const initial = ['home', 'table', 'quiz'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'home';
buildTableFurniture();
updateModeUI();
route(initial);
