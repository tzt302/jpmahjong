import { TILE_LABELS } from './engine.js';
import { tileFaceMarkup } from './tiles.js';
import { createGame, discard, canTsumo, declareTsumo, chooseBotDiscard, getHumanCallOptions, claimHumanCall, skipHumanCall, WINDS } from './game-core.js';
import { QUESTIONS } from './questions.js';

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
let game = null;
let botBusy = false;
let lastDiscardPlayer = null;
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

async function animateAiDiscard(player, tile) {
  const plaque = $({ 1: '.plaque-right', 2: '.plaque-top', 3: '.plaque-left' }[player]);
  const wall = $({ 1: '#wallRight', 2: '#wallTop', 3: '#wallLeft' }[player]);
  const plaqueRect = plaque.getBoundingClientRect();
  const sourceRect = plaqueRect.width ? plaqueRect : wall.getBoundingClientRect();
  const startRect = { left: sourceRect.left + sourceRect.width / 2 - 22, top: sourceRect.top + sourceRect.height / 2 - 30, width: 44, height: 61 };
  await flyTile(tileFaceMarkup(tile), startRect, player);
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
  game = createGame(Math.random, selectedPlayerCount);
  document.body.dataset.players = String(selectedPlayerCount);
  botBusy = false;
  $('#resultModal').classList.add('hidden');
  renderGame();
}

function renderGame() {
  $('#wallText').textContent = `${game.playerCount === 3 ? '三麻' : '四麻'} · 牌山 ${game.wall.length}`;
  $('.rule-note span').innerHTML = `玩家对战${game.playerCount === 3 ? '两位' : '三位'} AI<br>${game.playerCount === 3 ? '三麻 · 无二万至八万' : '四麻 · 标准牌组'}`;
  $('#centerWall').textContent = game.wall.length;
  const callOptions = getHumanCallOptions(game);
  const callPending = Boolean(game.pendingCall);
  const humanTurn = game.current === 0 && !callPending;
  $('#turnSeal').textContent = WINDS[game.current];
  $('#turnLabel').textContent = humanTurn ? 'YOUR SEAT' : 'OPPONENT TURN';
  $('#turnName').textContent = humanTurn ? '你 · 東家' : `AI · ${WINDS[game.current]}家`;
  $('#turnMessage').textContent = game.phase === 'draw' ? '牌山已尽' : callPending ? '可以鸣牌，或选择跳过' : humanTurn ? '选择一张牌打出' : '电脑雀士正在思考…';
  $('#seatList').innerHTML = WINDS.slice(0, game.playerCount).map((wind, i) => `<li class="${i === game.current ? 'current' : ''}"><b>${i === 0 ? '你' : `AI ${wind}家`}</b><span>${game.rivers[i].length} 枚切牌</span></li>`).join('');
  game.rivers.forEach((river, i) => {
    $(`#river${i}`).innerHTML = river.map((tile, index) => `<span class="river-tile ${i === lastDiscardPlayer && index === river.length - 1 ? 'land' : ''}">${tileFaceMarkup(tile)}</span>`).join('');
  });
  const hand = game.hands[0];
  $('#meldArea').innerHTML = game.melds[0].map(meld => `<span class="meld-group" data-meld="${meld.type}">${meld.tiles.map(tile => `<i>${tileFaceMarkup(tile)}</i>`).join('')}</span>`).join('');
  $('#hand').classList.toggle('waiting', !humanTurn);
  $('#hand').innerHTML = hand.map((tile, index) => tileMarkup(tile, humanTurn && tile === game.drawn && index === hand.lastIndexOf(tile) ? 'drawn' : '')).join('');
  $('#tsumoButton').classList.toggle('hidden', !humanTurn || !canTsumo(game));
  $('#sortButton').disabled = !humanTurn;
  $('#chiButton').disabled = !callOptions.chi.length;
  $('#ponButton').disabled = !callOptions.pon;
  $('#kanButton').disabled = !callOptions.kan;
  $('#skipCallButton').classList.toggle('hidden', !callPending);
  $('#callStatus').textContent = callPending ? '鸣牌机会' : '鸣牌';
  $('.hand-actions').classList.toggle('call-ready', callPending);
  if (game.phase === 'draw') showResult('荒牌流局', '牌山已经摸完。本版暂不计算听牌罚符。');
  bindHand();
  lastDiscardPlayer = null;
}

function bindHand() {
  $$('#hand .tile').forEach((tile, index) => tile.addEventListener('click', async () => {
    if (botBusy || game.current !== 0 || game.phase !== 'playing') return;
    botBusy = true;
    tile.classList.add('discarding');
    const selectedTile = game.hands[0][index];
    await flyTile(tileFaceMarkup(selectedTile), tile.getBoundingClientRect(), 0);
    discard(game, index);
    lastDiscardPlayer = 0;
    playTileSound();
    renderGame();
    window.setTimeout(runBotTurn, 360);
  }));
}

async function runBotTurn() {
  if (game.phase !== 'playing' || game.current === 0) {
    botBusy = false;
    renderGame();
    return;
  }
  const player = game.current;
  await animateWallDraw(player);
  if (canTsumo(game)) {
    const winner = declareTsumo(game);
    botBusy = false;
    renderGame();
    showResult(`${WINDS[winner]}家 AI 自摸`, '电脑雀士完成了和牌形。本版不会向玩家提供任何出牌建议。');
    return;
  }
  const discardIndex = chooseBotDiscard(game);
  const discardedTile = game.hands[player][discardIndex];
  await animateAiDiscard(player, discardedTile);
  discard(game, discardIndex, { deferAdvance: true });
  lastDiscardPlayer = player;
  playTileSound();
  const options = getHumanCallOptions(game);
  if (options.chi.length || options.pon || options.kan) {
    botBusy = false;
    renderGame();
    return;
  }
  skipHumanCall(game);
  if (game.current === 0) botBusy = false;
  renderGame();
  if (game.phase === 'playing' && game.current !== 0) window.setTimeout(runBotTurn, 280);
}

$('#sortButton').addEventListener('click', () => {
  if (game.current !== 0 || botBusy) return;
  game.hands[game.current].sort((a, b) => a - b);
  renderGame();
});

function useCall(type) {
  claimHumanCall(game, type);
  botBusy = false;
  renderGame();
}

$('#chiButton').addEventListener('click', () => useCall('chi'));
$('#ponButton').addEventListener('click', () => useCall('pon'));
$('#kanButton').addEventListener('click', () => useCall('kan'));
$('#skipCallButton').addEventListener('click', () => {
  skipHumanCall(game);
  botBusy = game.current !== 0;
  renderGame();
  if (botBusy) window.setTimeout(runBotTurn, 180);
});

$('#tsumoButton').addEventListener('click', () => {
  const winner = declareTsumo(game);
  showResult(`${WINDS[winner]}家 自摸`, '手牌已经组成四组面子与一组雀头。本版先完成和牌形判定，役种与点数将在后续版本接入。');
});

function showResult(title, copy) {
  $('#resultTitle').textContent = title;
  $('#resultCopy').textContent = copy;
  $('#resultModal').classList.remove('hidden');
}

$('#newRoundButton').addEventListener('click', startGame);
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
