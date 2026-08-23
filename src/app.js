import { TILE_LABELS } from './engine.js';
import { tileFaceMarkup } from './tiles.js';
import { createGame, discard, canTsumo, declareTsumo, chooseBotDiscard, WINDS } from './game-core.js';
import { QUESTIONS } from './questions.js';

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
let game = null;
let botBusy = false;
let quizIndex = Number(localStorage.getItem('jpmahjong-quiz-index') || 0) % QUESTIONS.length;
let quizDone = JSON.parse(localStorage.getItem('jpmahjong-quiz-done') || '[]');

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

function route(name) {
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

function startGame() {
  game = createGame();
  botBusy = false;
  $('#resultModal').classList.add('hidden');
  renderGame();
}

function renderGame() {
  $('#wallText').textContent = `牌山 ${game.wall.length}`;
  $('#centerWall').textContent = game.wall.length;
  const humanTurn = game.current === 0;
  $('#turnSeal').textContent = WINDS[game.current];
  $('#turnName').textContent = humanTurn ? '你 · 東家' : `AI · ${WINDS[game.current]}家`;
  $('#turnMessage').textContent = game.phase === 'draw' ? '牌山已尽' : humanTurn ? '选择一张牌打出' : '电脑雀士正在思考…';
  $('#seatList').innerHTML = WINDS.map((wind, i) => `<li class="${i === game.current ? 'current' : ''}"><b>${i === 0 ? '你' : `AI ${wind}家`}</b><span>${game.rivers[i].length} 枚切牌</span></li>`).join('');
  game.rivers.forEach((river, i) => {
    $(`#river${i}`).innerHTML = river.map(tile => `<span class="river-tile">${tileFaceMarkup(tile)}</span>`).join('');
  });
  const hand = game.hands[0];
  $('#hand').classList.toggle('waiting', !humanTurn);
  $('#hand').innerHTML = hand.map((tile, index) => tileMarkup(tile, humanTurn && tile === game.drawn && index === hand.lastIndexOf(tile) ? 'drawn' : '')).join('');
  $('#tsumoButton').classList.toggle('hidden', !humanTurn || !canTsumo(game));
  $('#sortButton').disabled = !humanTurn;
  if (game.phase === 'draw') showResult('荒牌流局', '牌山已经摸完。本版暂不计算听牌罚符。');
  bindHand();
}

function bindHand() {
  $$('#hand .tile').forEach((tile, index) => tile.addEventListener('click', () => {
    if (botBusy || game.current !== 0 || game.phase !== 'playing') return;
    tile.classList.add('discarding');
    setTimeout(() => {
      discard(game, index);
      renderGame();
      botBusy = true;
      window.setTimeout(runBotTurn, 520);
    }, 130);
  }));
}

function runBotTurn() {
  if (game.phase !== 'playing' || game.current === 0) {
    botBusy = false;
    renderGame();
    return;
  }
  if (canTsumo(game)) {
    const winner = declareTsumo(game);
    botBusy = false;
    renderGame();
    showResult(`${WINDS[winner]}家 AI 自摸`, '电脑雀士完成了和牌形。本版不会向玩家提供任何出牌建议。');
    return;
  }
  discard(game, chooseBotDiscard(game));
  renderGame();
  if (game.phase === 'playing' && game.current !== 0) window.setTimeout(runBotTurn, 520);
  else botBusy = false;
}

$('#sortButton').addEventListener('click', () => {
  if (game.current !== 0 || botBusy) return;
  game.hands[game.current].sort((a, b) => a - b);
  renderGame();
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
route(initial);
