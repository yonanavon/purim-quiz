let adminToken = sessionStorage.getItem('adminToken') || null;

// Hebrew letter labels
const LETTER_MAP = { a: 'א׳', b: 'ב׳', c: 'ג׳', d: 'ד׳' };

function showAlert(id, msg, type) {
  const el = document.getElementById(id);
  el.textContent = msg;
  el.className = `alert alert-${type} show`;
  setTimeout(() => el.classList.remove('show'), 5000);
}

// ===== LOGIN =====
async function login() {
  const password = document.getElementById('loginPassword').value;
  if (!password) return;

  try {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });
    const data = await res.json();

    if (!res.ok) {
      const errEl = document.getElementById('loginError');
      errEl.textContent = data.error || 'שגיאת כניסה';
      errEl.classList.add('show');
      return;
    }

    adminToken = data.token;
    sessionStorage.setItem('adminToken', adminToken);
    showAdminPanel();
  } catch (err) {
    console.error(err);
  }
}

function logout() {
  adminToken = null;
  sessionStorage.removeItem('adminToken');
  document.getElementById('adminPanel').classList.add('hidden');
  document.getElementById('loginScreen').classList.remove('hidden');
  document.getElementById('loginPassword').value = '';
}

function showAdminPanel() {
  document.getElementById('loginScreen').classList.add('hidden');
  document.getElementById('adminPanel').classList.remove('hidden');
  loadQuestions();
}

// Auto-login if token exists
if (adminToken) {
  showAdminPanel();
}

// ===== LOAD QUESTIONS =====
async function loadQuestions() {
  const container = document.getElementById('questionsTableContainer');
  container.innerHTML = '<div class="loading"><div class="spinner"></div>טוען...</div>';

  try {
    const res = await fetch('/api/admin/questions', {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });

    if (res.status === 401) {
      logout();
      return;
    }

    const questions = await res.json();
    document.getElementById('questionCount').textContent = `${questions.length} שאלות`;
    renderTable(questions);
  } catch (err) {
    container.innerHTML = '<div class="alert alert-error show">שגיאה בטעינת שאלות</div>';
  }
}

function renderTable(questions) {
  const container = document.getElementById('questionsTableContainer');

  if (questions.length === 0) {
    container.innerHTML = '<p style="color:rgba(255,255,255,0.5); text-align:center; padding:20px;">אין שאלות עדיין. הוסף שאלות למעלה!</p>';
    return;
  }

  const rows = questions.map(q => {
    const correctLabel = LETTER_MAP[q.correct_answer] || q.correct_answer;
    const options = ['a','b','c','d'].map(opt =>
      `<span style="color:rgba(255,255,255,0.6)">${LETTER_MAP[opt]}:</span> ${escHtml(q['option_' + opt])}${q.correct_answer === opt ? ' <span class="correct-badge">✓</span>' : ''}`
    ).join('<br>');

    return `
      <tr>
        <td style="color:rgba(255,255,255,0.4); font-size:0.8rem;">${q.id}</td>
        <td style="max-width:220px;">${escHtml(q.question)}</td>
        <td style="font-size:0.85rem; max-width:220px;">${options}</td>
        <td style="white-space:nowrap;">
          <button class="btn btn-sm btn-secondary" onclick="openEdit(${q.id})" style="margin-bottom:6px; display:block;">✏️ עריכה</button>
          <button class="btn btn-sm btn-danger" onclick="deleteQuestion(${q.id})">🗑️ מחיקה</button>
        </td>
      </tr>
    `;
  }).join('');

  container.innerHTML = `
    <div style="overflow-x:auto;">
      <table class="questions-table">
        <thead>
          <tr>
            <th>#</th>
            <th>שאלה</th>
            <th>אפשרויות</th>
            <th>פעולות</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ===== ADD QUESTION =====
async function addQuestion() {
  const question = document.getElementById('newQuestion').value.trim();
  const option_a = document.getElementById('newOptA').value.trim();
  const option_b = document.getElementById('newOptB').value.trim();
  const option_c = document.getElementById('newOptC').value.trim();
  const option_d = document.getElementById('newOptD').value.trim();
  const correctRadio = document.querySelector('input[name="newCorrect"]:checked');
  const correct_answer = correctRadio ? correctRadio.value : '';

  if (!question || !option_a || !option_b || !option_c || !option_d || !correct_answer) {
    showAlert('addAlert', 'יש למלא את כל השדות ולסמן תשובה נכונה', 'error');
    return;
  }

  try {
    const res = await fetch('/api/admin/questions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({ question, option_a, option_b, option_c, option_d, correct_answer })
    });

    const data = await res.json();
    if (!res.ok) {
      showAlert('addAlert', data.error || 'שגיאה בהוספת שאלה', 'error');
      return;
    }

    showAlert('addAlert', 'השאלה נוספה בהצלחה! ✅', 'success');

    // Clear form
    document.getElementById('newQuestion').value = '';
    document.getElementById('newOptA').value = '';
    document.getElementById('newOptB').value = '';
    document.getElementById('newOptC').value = '';
    document.getElementById('newOptD').value = '';
    if (correctRadio) correctRadio.checked = false;

    loadQuestions();
  } catch (err) {
    showAlert('addAlert', 'שגיאת רשת', 'error');
  }
}

// ===== DELETE QUESTION =====
async function deleteQuestion(id) {
  if (!confirm(`האם למחוק שאלה #${id}?`)) return;

  try {
    const res = await fetch(`/api/admin/questions/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });

    if (!res.ok) {
      const data = await res.json();
      showAlert('tableAlert', data.error || 'שגיאה במחיקה', 'error');
      return;
    }

    showAlert('tableAlert', 'השאלה נמחקה ✅', 'success');
    loadQuestions();
  } catch (err) {
    showAlert('tableAlert', 'שגיאת רשת', 'error');
  }
}

// ===== EDIT QUESTION =====
let allQuestions = [];

async function openEdit(id) {
  // Fetch fresh data
  try {
    const res = await fetch('/api/admin/questions', {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const questions = await res.json();
    const q = questions.find(q => q.id === id);
    if (!q) return;

    document.getElementById('editId').value = q.id;
    document.getElementById('editQuestion').value = q.question;
    document.getElementById('editOptA').value = q.option_a;
    document.getElementById('editOptB').value = q.option_b;
    document.getElementById('editOptC').value = q.option_c;
    document.getElementById('editOptD').value = q.option_d;

    const radio = document.querySelector(`input[name="editCorrect"][value="${q.correct_answer}"]`);
    if (radio) radio.checked = true;

    document.getElementById('editModal').classList.add('open');
  } catch (err) {
    console.error(err);
  }
}

function closeModal() {
  document.getElementById('editModal').classList.remove('open');
}

async function saveEdit() {
  const id = document.getElementById('editId').value;
  const question = document.getElementById('editQuestion').value.trim();
  const option_a = document.getElementById('editOptA').value.trim();
  const option_b = document.getElementById('editOptB').value.trim();
  const option_c = document.getElementById('editOptC').value.trim();
  const option_d = document.getElementById('editOptD').value.trim();
  const correctRadio = document.querySelector('input[name="editCorrect"]:checked');
  const correct_answer = correctRadio ? correctRadio.value : '';

  if (!question || !option_a || !option_b || !option_c || !option_d || !correct_answer) {
    alert('יש למלא את כל השדות');
    return;
  }

  try {
    const res = await fetch(`/api/admin/questions/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({ question, option_a, option_b, option_c, option_d, correct_answer })
    });

    const data = await res.json();
    if (!res.ok) {
      alert(data.error || 'שגיאה בעדכון');
      return;
    }

    closeModal();
    showAlert('tableAlert', 'השאלה עודכנה בהצלחה ✅', 'success');
    loadQuestions();
  } catch (err) {
    alert('שגיאת רשת');
  }
}

// Close modal on backdrop click
document.getElementById('editModal').addEventListener('click', function(e) {
  if (e.target === this) closeModal();
});

// ===== IMPORT CSV =====
async function importCSV() {
  const fileInput = document.getElementById('csvFile');
  const file = fileInput.files[0];

  if (!file) {
    showAlert('csvAlert', 'נא לבחור קובץ CSV', 'error');
    return;
  }

  const formData = new FormData();
  formData.append('csv', file);

  try {
    const res = await fetch('/api/admin/import-csv', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}` },
      body: formData
    });

    const data = await res.json();
    if (!res.ok) {
      showAlert('csvAlert', data.error || 'שגיאה בייבוא', 'error');
      return;
    }

    let msg = `יובאו ${data.inserted} שאלות בהצלחה ✅`;
    if (data.errors && data.errors.length > 0) {
      msg += ` | שגיאות: ${data.errors.join('; ')}`;
    }
    showAlert('csvAlert', msg, data.inserted > 0 ? 'success' : 'error');

    fileInput.value = '';
    loadQuestions();
  } catch (err) {
    showAlert('csvAlert', 'שגיאת רשת', 'error');
  }
}

// Enter key for login
document.getElementById('loginPassword').addEventListener('keypress', function(e) {
  if (e.key === 'Enter') login();
});

// Confetti
const confettiContainer = document.getElementById('confetti');
if (confettiContainer) {
  const colors = ['#f59e0b','#9333ea','#dc2626','#f97316','#fcd34d'];
  for (let i = 0; i < 12; i++) {
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
