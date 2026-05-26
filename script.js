// ============ NAVIGATION ============
let history = ['login'];

function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const target = document.getElementById('screen-' + screenId);
  if (target) target.classList.add('active');
}

function navigate(screenId) {
  history.push(screenId);
  showScreen(screenId);
}

function goBack() {
  if (history.length > 1) {
    history.pop();
    showScreen(history[history.length - 1]);
  }
}

// ============ LOGIN HANDLER ============
function handleLogin(e) {
  e.preventDefault();
  const user = document.getElementById('user').value.trim();
  const pass = document.getElementById('pass').value.trim();
  const error = document.getElementById('loginError');

  if (!user || !pass) {
    error.textContent = 'Por favor completa ambos campos';
    return;
  }

  // Demo: cualquier combinación de usuario+contraseña funciona
  if ((user === 'estudiante' && pass === '1234') || (user.length > 0 && pass.length > 0)) {
    error.textContent = '';
    document.getElementById('welcomeName').textContent = user;
    refreshProfile(user);
    history = ['login', 'home'];
    showScreen('home');
  } else {
    error.textContent = 'Credenciales incorrectas';
  }
}

function refreshProfile(user) {
  const name = user || 'estudiante';
  const initials = name.slice(0, 2).toUpperCase();
  const displayName = name === 'estudiante' ? 'Sara Álvarez' : name;
  document.getElementById('profileAvatar').textContent = initials;
  document.getElementById('profileName').textContent = displayName;
  document.getElementById('profileEmail').textContent = `${name.toLowerCase()}@nextion.edu.co`;
}

function logout() {
  document.getElementById('user').value = '';
  document.getElementById('pass').value = '';
  document.getElementById('loginError').textContent = '';
  history = ['login'];
  showScreen('login');
}

// ============ CALIFICACIONES ============
const subjectGrades = {
  'Matemáticas': [['1° Período','4.5'],['2° Período','4.2'],['3° Período','4.7'],['4° Período','4.3'],['Promedio','4.4']],
  'Lenguaje':    [['1° Período','4.0'],['2° Período','4.3'],['3° Período','4.1'],['4° Período','4.5'],['Promedio','4.2']],
  'Biología':    [['1° Período','3.8'],['2° Período','4.0'],['3° Período','4.2'],['4° Período','4.4'],['Promedio','4.1']],
  'Historia':    [['1° Período','4.6'],['2° Período','4.5'],['3° Período','4.7'],['4° Período','4.8'],['Promedio','4.7']],
  'Inglés':      [['1° Período','3.9'],['2° Período','4.1'],['3° Período','4.0'],['4° Período','4.2'],['Promedio','4.1']],
};

document.querySelectorAll('[data-subject]').forEach(item => {
  item.addEventListener('click', () => {
    document.querySelectorAll('[data-subject]').forEach(i => i.classList.remove('active'));
    item.classList.add('active');
    const data = subjectGrades[item.dataset.subject] || [];
    document.getElementById('gradesBody').innerHTML = data.map(
      ([periodo, nota]) => `<tr><td>${periodo}</td><td>${nota}</td></tr>`
    ).join('');
  });
});

// ============ ASISTENCIAS ============
const subjectAttendance = {
  'Matemáticas': [
    ['lun 4 mar 2026',  'Presente'],
    ['mié 6 mar 2026',  'Presente'],
    ['lun 11 mar 2026', 'Ausente'],
    ['mié 13 mar 2026', 'Justificado'],
    ['lun 18 mar 2026', 'Presente'],
    ['mié 20 mar 2026', 'Presente'],
  ],
  'Lenguaje': [
    ['mar 5 mar 2026',  'Presente'],
    ['jue 7 mar 2026',  'Presente'],
    ['mar 12 mar 2026', 'Presente'],
    ['jue 14 mar 2026', 'Ausente'],
    ['mar 19 mar 2026', 'Presente'],
  ],
  'Biología': [
    ['lun 4 mar 2026',  'Presente'],
    ['mié 6 mar 2026',  'Presente'],
    ['lun 11 mar 2026', 'Presente'],
  ],
  'Historia': [
    ['mar 5 mar 2026',  'Justificado'],
    ['jue 7 mar 2026',  'Presente'],
    ['mar 12 mar 2026', 'Presente'],
  ],
  'Inglés': [
    ['mié 6 mar 2026',  'Presente'],
    ['vie 8 mar 2026',  'Ausente'],
    ['mié 13 mar 2026', 'Presente'],
  ],
};

const ATT_BADGE_CLASS = {
  'Presente':    'att-presente',
  'Ausente':     'att-ausente',
  'Justificado': 'att-justificado',
};

function renderAttendance(subject) {
  const rows = subjectAttendance[subject] || [];
  const tally = { Presente: 0, Ausente: 0, Justificado: 0 };
  rows.forEach(([, s]) => { tally[s] = (tally[s] || 0) + 1; });

  document.getElementById('attCountPresente').textContent    = tally.Presente;
  document.getElementById('attCountAusente').textContent     = tally.Ausente;
  document.getElementById('attCountJustificado').textContent = tally.Justificado;

  document.getElementById('attendanceBody').innerHTML = rows.map(
    ([fecha, estado]) =>
      `<tr><td>${fecha}</td><td><span class="att-badge ${ATT_BADGE_CLASS[estado] || ''}">${estado}</span></td></tr>`
  ).join('');
}

document.querySelectorAll('[data-att-subject]').forEach(item => {
  item.addEventListener('click', () => {
    document.querySelectorAll('[data-att-subject]').forEach(i => i.classList.remove('active'));
    item.classList.add('active');
    renderAttendance(item.dataset.attSubject);
  });
});

renderAttendance('Matemáticas');
