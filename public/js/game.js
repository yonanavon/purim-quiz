const GRADE_CONFIG = {
  'א': { required: 6 },
  'ב': { required: 6 },
  'ג': { required: 12 },
  'ד': { required: 12 },
  'ה': { required: 20 },
  'ו': { required: 30 },
  'ז': { required: 30 },
  'ח': { required: 30 },
  'פסיפס': { required: 5 },
};

const MAX_LIVES = 3;
const TOTAL_GALLOWS_ELEMENTS = 30;

let playerName = '';
let playerGrade = '';
let requiredCorrect = 6;
let lives = MAX_LIVES;
let correctAnswers = 0;
let wrongAnswers = 0;
let askedIds = [];
let currentQuestion = null;
let answering = false;
let hasWon = false;

// Hebrew letter labels for options
const OPTION_LABELS = { a: 'א', b: 'ב', c: 'ג', d: 'ד' };

function init() {
  playerName = localStorage.getItem('playerName') || 'שחקן';
  playerGrade = localStorage.getItem('playerGrade') || 'א';
  const config = GRADE_CONFIG[playerGrade] || { required: 6 };
  requiredCorrect = config.required;

  updateUI();
  loadNextQuestion();
}

function updateUI() {
  // Correct / wrong counters
  document.getElementById('correctCount').textContent = correctAnswers;
  document.getElementById('wrongCount').textContent = wrongAnswers;

  // Lives
  for (let i = 1; i <= MAX_LIVES; i++) {
    const lifeEl = document.getElementById(`life${i}`);
    if (i <= lives) {
      lifeEl.classList.remove('lost');
    } else {
      lifeEl.classList.add('lost');
    }
  }

  // Progress
  const pct = Math.min((correctAnswers / requiredCorrect) * 100, 100);
  document.getElementById('progressFill').style.width = pct + '%';
  if (hasWon) {
    document.getElementById('progressLabel').textContent =
      `🎉 ניצחת! המשך לשאלות בונוס — ${correctAnswers} נכונות`;
  } else {
    document.getElementById('progressLabel').textContent =
      `${correctAnswers} / ${requiredCorrect} שאלות נכונות לניצחון`;
  }

  // Gallows SVG
  const elementsToShow = Math.floor((correctAnswers / requiredCorrect) * TOTAL_GALLOWS_ELEMENTS);
  for (let i = 1; i <= TOTAL_GALLOWS_ELEMENTS; i++) {
    const el = document.getElementById(`gp${i}`);
    if (el) {
      el.style.opacity = i <= elementsToShow ? '1' : '0';
      if (i <= elementsToShow && parseFloat(el.style.opacity) === 0) {
        el.style.transition = 'opacity 0.4s ease';
      }
    }
  }
}

function showAllGallows() {
  for (let i = 1; i <= TOTAL_GALLOWS_ELEMENTS; i++) {
    const el = document.getElementById(`gp${i}`);
    if (el) {
      el.style.transition = `opacity 0.08s ease ${(i - 1) * 0.06}s`;
      el.style.opacity = '1';
    }
  }
  // Start Haman's swing animation
  const swing = document.getElementById('hamanSwing');
  if (swing) swing.beginElement();
}

async function loadNextQuestion() {
  answering = false;
  const questionText = document.getElementById('questionText');
  questionText.innerHTML = '<div class="spinner"></div>';

  // Disable buttons
  ['a', 'b', 'c', 'd'].forEach(opt => {
    const btn = document.getElementById(`btn${opt.toUpperCase()}`);
    btn.disabled = true;
    btn.textContent = '';
    btn.className = 'answer-btn';
  });

  try {
    const excludeParam = askedIds.join(',');
    const url = `/api/questions/random${excludeParam ? '?exclude=' + excludeParam : ''}`;
    const res = await fetch(url);

    if (res.status === 404) {
      // No more questions left
      questionText.textContent = 'אין עוד שאלות! סיימת את כל בנק השאלות 🏆';
      ['a', 'b', 'c', 'd'].forEach(opt => {
        const btn = document.getElementById(`btn${opt.toUpperCase()}`);
        btn.disabled = true;
        btn.innerHTML = '';
      });
      return;
    }

    if (!res.ok) throw new Error('Server error');

    currentQuestion = await res.json();
    askedIds.push(currentQuestion.id);

    displayQuestion(currentQuestion);
  } catch (err) {
    questionText.textContent = 'שגיאה בטעינת שאלה. נסה לרענן.';
    console.error(err);
  }
}

function displayQuestion(q) {
  document.getElementById('questionText').textContent = q.question;

  // Show/hide joke badge
  const jokeBadge = document.getElementById('jokeBadge');
  if (jokeBadge) {
    if (q.correct_answer === 'j') {
      jokeBadge.classList.remove('hidden');
    } else {
      jokeBadge.classList.add('hidden');
    }
  }

  const opts = ['a', 'b', 'c', 'd'];
  opts.forEach(opt => {
    const btn = document.getElementById(`btn${opt.toUpperCase()}`);
    btn.disabled = false;
    btn.className = 'answer-btn';
    btn.innerHTML = `<span class="letter-badge">${OPTION_LABELS[opt]}</span> ${q['option_' + opt]}`;
  });

  answering = true;
}

async function submitAnswer(chosen) {
  if (!answering || !currentQuestion) return;
  answering = false;

  const correct = currentQuestion.correct_answer;
  const isJoke = correct === 'j';
  const isCorrect = isJoke || chosen === correct;

  // Highlight buttons
  ['a', 'b', 'c', 'd'].forEach(opt => {
    const btn = document.getElementById(`btn${opt.toUpperCase()}`);
    btn.disabled = true;
    if (isJoke) {
      // All answers correct — light up all green
      btn.classList.add('correct');
    } else if (opt === correct) {
      btn.classList.add('correct');
    } else if (opt === chosen && !isCorrect) {
      btn.classList.add('wrong');
    }
  });

  if (isCorrect) {
    correctAnswers++;
    updateUI();

    if (!hasWon && correctAnswers >= requiredCorrect) {
      // WIN — show banner but keep playing
      hasWon = true;
      showAllGallows();
      showWinBanner();
    }
  } else {
    wrongAnswers++;
    lives--;
    updateUI();

    if (lives <= 0) {
      await delay(600);
      showGameOver();
      return;
    }
  }

  await delay(1200);
  loadNextQuestion();
}

function showWinBanner() {
  const banner = document.getElementById('winBanner');
  banner.classList.remove('hidden');
  banner.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  // Burst confetti
  const container = document.getElementById('confetti');
  const colors = ['#f59e0b','#fcd34d','#9333ea','#c084fc','#dc2626','#34d399'];
  for (let i = 0; i < 30; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    piece.style.cssText = `
      left: ${Math.random() * 100}%;
      background: ${colors[Math.floor(Math.random() * colors.length)]};
      animation-delay: ${Math.random() * 0.8}s;
      animation-duration: ${1.5 + Math.random() * 2}s;
      border-radius: ${Math.random() > 0.5 ? '50%' : '2px'};
      width: ${8 + Math.random() * 10}px;
      height: ${10 + Math.random() * 14}px;
      opacity: 1;
    `;
    container.appendChild(piece);
    setTimeout(() => piece.remove(), 3500);
  }
}

function showGameOver() {
  document.getElementById('gameOverOverlay').classList.remove('hidden');
}

function restartGame() {
  lives = MAX_LIVES;
  correctAnswers = 0;
  wrongAnswers = 0;
  askedIds = [];
  currentQuestion = null;
  hasWon = false;

  document.getElementById('gameOverOverlay').classList.add('hidden');
  document.getElementById('winBanner').classList.add('hidden');

  // Stop swing animation
  const swing = document.getElementById('hamanSwing');
  if (swing) swing.endElement();

  // Reset SVG
  for (let i = 1; i <= TOTAL_GALLOWS_ELEMENTS; i++) {
    const el = document.getElementById(`gp${i}`);
    if (el) { el.style.transition = 'none'; el.style.opacity = '0'; }
  }

  updateUI();
  loadNextQuestion();
}

function goToWin() {
  const params = new URLSearchParams({
    name: playerName,
    grade: playerGrade,
    correct: correctAnswers,
    wrong: wrongAnswers
  });
  window.location.href = `win.html?${params.toString()}`;
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Confetti background
const confettiContainer = document.getElementById('confetti');
if (confettiContainer) {
  const colors = ['#f59e0b','#9333ea','#dc2626','#f97316','#fcd34d','#c084fc'];
  for (let i = 0; i < 15; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    piece.style.cssText = `
      left: ${Math.random() * 100}%;
      background: ${colors[Math.floor(Math.random() * colors.length)]};
      animation-delay: ${Math.random() * 6}s;
      animation-duration: ${4 + Math.random() * 5}s;
      border-radius: ${Math.random() > 0.5 ? '50%' : '2px'};
      width: ${5 + Math.random() * 8}px;
      height: ${7 + Math.random() * 12}px;
      opacity: 1;
    `;
    confettiContainer.appendChild(piece);
  }
}

// Start
init();
