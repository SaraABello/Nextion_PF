// ============ SUPABASE CLIENT ============
// Las claves "publishable" (anon) están diseñadas para usarse en el cliente.
// La seguridad real se aplica con Row Level Security (RLS) en Supabase.
const SUPABASE_URL = 'https://vhwnvubpqrqmqgwwctdp.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_khyd4TR1-QMTuUSaV76nDA_-r29uFuJ';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

// ============ ESTADO DE SESIÓN ============
// Aquí guardamos los datos del usuario logueado durante la sesión actual.
let currentUser = null;     // fila de la tabla users
let currentStudent = null;  // perfil de students + group (solo si type = estudiante)

// ============ NAVIGATION ============
let history = ['login'];

// Pantallas que se muestran angostas (login, registro). El resto va ancho.
const NARROW_SCREENS = ['login', 'register'];

function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const target = document.getElementById('screen-' + screenId);
  if (target) target.classList.add('active');

  // Expandir contenedor en pantallas internas (post-login)
  const appEl = document.querySelector('.app');
  if (appEl) appEl.classList.toggle('app-wide', !NARROW_SCREENS.includes(screenId));
}

function navigate(screenId) {
  history.push(screenId);
  showScreen(screenId);
  // Hook por pantalla: cargar datos justo cuando se abre
  if (screenId === 'register')      loadGroupsForRegister();
  if (screenId === 'calificaciones') loadSubjectsForGrades();
  if (screenId === 'asistencias')    loadSubjectsForAttendance();
}

function goBack() {
  if (history.length > 1) {
    history.pop();
    showScreen(history[history.length - 1]);
  }
}

// ============ LOGIN HANDLER ============
async function handleLogin(e) {
  e.preventDefault();
  const username = document.getElementById('user').value.trim();
  const password = document.getElementById('pass').value.trim();
  const error = document.getElementById('loginError');

  if (!username || !password) {
    error.textContent = 'Por favor completa ambos campos';
    return;
  }

  error.textContent = 'Validando…';

  // 1) Buscar el usuario en la tabla users por username + password
  //    (Demo: contraseña en texto plano. En producción se debe hashear.)
  const { data: userRow, error: userErr } = await supabaseClient
    .from('users')
    .select('id, username, type')
    .eq('username', username)
    .eq('password', password)
    .maybeSingle();

  if (userErr) {
    error.textContent = 'Error consultando la base de datos';
    console.error(userErr);
    return;
  }
  if (!userRow) {
    error.textContent = 'Credenciales incorrectas';
    return;
  }

  currentUser = userRow;

  // 2) Si es estudiante (type = FALSE), traer su perfil de students + groups
  if (userRow.type === false) {
    const { data: studentRow, error: studErr } = await supabaseClient
      .from('students')
      .select('id, id_document, name, last_name, status, groups(name, grade, year)')
      .eq('id_user', userRow.id)
      .maybeSingle();

    if (studErr) {
      error.textContent = 'Error cargando el perfil del estudiante';
      console.error(studErr);
      return;
    }
    currentStudent = studentRow;
  } else {
    currentStudent = null;
  }

  // 3) Listo: limpiar y entrar al home
  error.textContent = '';
  refreshProfile();
  history = ['login', 'home'];
  showScreen('home');
}

function refreshProfile() {
  // Nombre que se muestra en el saludo del home
  const displayName = currentStudent
    ? `${currentStudent.name} ${currentStudent.last_name}`
    : (currentUser?.username || 'estudiante');

  const initials = displayName
    .split(' ')
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  document.getElementById('welcomeName').textContent = displayName;
  document.getElementById('profileAvatar').textContent = initials;
  document.getElementById('profileName').textContent = displayName;

  // Pantalla "Datos personales" — solo si es estudiante
  if (currentStudent) {
    const grupo = currentStudent.groups
      ? `${currentStudent.groups.grade} · ${currentStudent.groups.name} · ${currentStudent.groups.year}`
      : '—';

    setProfileField('profileDocumento', currentStudent.id_document);
    setProfileField('profileGrupo', currentStudent.groups?.name ?? '—');
    setProfileField('profileAnio', currentStudent.groups?.year ?? '—');
    setProfileField('profileEstado', currentStudent.status ? 'Activo' : 'Inactivo');
    setProfileField('profileMeta', `Estudiante · ${grupo}`);
  }

  // Correo: aún no está en la tabla, lo derivamos del username
  const fallbackEmail = `${(currentUser?.username || 'estudiante').toLowerCase()}@nextion.edu.co`;
  setProfileField('profileEmail', fallbackEmail);
}

function setProfileField(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function logout() {
  currentUser = null;
  currentStudent = null;
  document.getElementById('user').value = '';
  document.getElementById('pass').value = '';
  document.getElementById('loginError').textContent = '';
  history = ['login'];
  showScreen('login');
}

// ============ REGISTER ============
// Contraseña requerida para crear cuentas de docente (demo).
// Ojo: está en el JS del navegador, así que cualquiera puede verla en el código fuente.
// En producción esta validación debe correr en el servidor.
const ADMIN_PASSWORD = 'admin1234';

let registerRole = 'student'; // 'student' | 'teacher'

function setRole(role) {
  registerRole = role;
  document.getElementById('tab-student').classList.toggle('active', role === 'student');
  document.getElementById('tab-teacher').classList.toggle('active', role === 'teacher');
  document.getElementById('student-fields').style.display = role === 'student' ? '' : 'none';
  document.getElementById('teacher-fields').style.display = role === 'teacher' ? '' : 'none';
}

async function loadGroupsForRegister() {
  const sel = document.getElementById('reg-group');
  const { data, error } = await supabaseClient
    .from('groups')
    .select('id, name, grade, year')
    .order('year', { ascending: false })
    .order('name');

  if (error) {
    sel.innerHTML = '<option value="">Error cargando grupos</option>';
    console.error(error);
    return;
  }
  if (!data || data.length === 0) {
    sel.innerHTML = '<option value="">No hay grupos creados</option>';
    return;
  }
  sel.innerHTML =
    '<option value="">Selecciona un grupo…</option>' +
    data.map(g => `<option value="${g.id}">${g.grade} · ${g.name} · ${g.year}</option>`).join('');
}

async function handleRegister(e) {
  e.preventDefault();
  const msg = document.getElementById('registerMessage');
  const name     = document.getElementById('reg-name').value.trim();
  const lastname = document.getElementById('reg-lastname').value.trim();
  const username = document.getElementById('reg-username').value.trim();
  const password = document.getElementById('reg-password').value.trim();

  if (!name || !lastname || !username || !password) {
    msg.textContent = 'Por favor completa nombre, apellido, usuario y contraseña';
    return;
  }

  // Campos extra según rol
  let idDocument = null;
  let groupId = null;

  if (registerRole === 'student') {
    idDocument = document.getElementById('reg-document').value.trim();
    groupId    = parseInt(document.getElementById('reg-group').value, 10);
    if (!idDocument || !groupId) {
      msg.textContent = 'Estudiantes: documento y grupo son obligatorios';
      return;
    }
  } else {
    const admin = document.getElementById('reg-admin').value;
    if (admin !== ADMIN_PASSWORD) {
      msg.textContent = 'Contraseña de administrador incorrecta';
      return;
    }
  }

  msg.textContent = 'Creando cuenta…';

  // 1) Insertar en users — el id se genera solo (BIGSERIAL)
  const { data: userRow, error: userErr } = await supabaseClient
    .from('users')
    .insert({
      username,
      password,
      type: registerRole === 'teacher', // FALSE = estudiante, TRUE = docente
    })
    .select('id')
    .single();

  if (userErr) {
    if (userErr.code === '23505') {
      msg.textContent = 'Ese nombre de usuario ya existe';
    } else {
      msg.textContent = 'Error creando el usuario';
      console.error(userErr);
    }
    return;
  }

  // 2) Insertar el perfil correspondiente (students o teachers)
  const profileTable = registerRole === 'student' ? 'students' : 'teachers';
  const profileData = registerRole === 'student'
    ? {
        id_user: userRow.id,
        group_id: groupId,
        id_document: idDocument,
        name,
        last_name: lastname,
      }
    : {
        id_user: userRow.id,
        name,
        last_name: lastname,
      };

  const { error: profErr } = await supabaseClient
    .from(profileTable)
    .insert(profileData);

  if (profErr) {
    // Si falla el perfil, el usuario quedó huérfano. En una app real esto
    // debería ser una transacción (Edge Function o RPC) para garantizar
    // que ambas inserciones tengan éxito o ninguna.
    if (profErr.code === '23505') {
      msg.textContent = 'Ya existe un perfil con ese documento';
    } else {
      msg.textContent = 'Usuario creado pero falló el perfil';
      console.error(profErr);
    }
    return;
  }

  // Éxito
  msg.textContent = `✓ Cuenta de ${registerRole === 'teacher' ? 'docente' : 'estudiante'} creada. Ya puedes iniciar sesión.`;
  document.getElementById('registerForm').reset();
  setRole('student');
}

// ============ CALIFICACIONES ============
// Carga la lista de materias en la sidebar y selecciona la primera por defecto.
async function loadSubjectsForGrades() {
  const sidebar   = document.querySelector('#screen-calificaciones .subjects-sidebar');
  const tableBody = document.getElementById('gradesBody');

  if (!currentStudent) {
    sidebar.innerHTML   = '<div class="subject-item">Vista solo para estudiantes</div>';
    tableBody.innerHTML = '';
    return;
  }

  const { data, error } = await supabaseClient
    .from('subject')
    .select('id, name_subject')
    .order('name_subject');

  if (error) {
    sidebar.innerHTML = '<div class="subject-item">Error cargando materias</div>';
    console.error(error);
    return;
  }
  if (!data || data.length === 0) {
    sidebar.innerHTML   = '<div class="subject-item">Sin materias registradas</div>';
    tableBody.innerHTML = '';
    return;
  }

  sidebar.innerHTML = data.map((s, i) =>
    `<div class="subject-item ${i === 0 ? 'active' : ''}" data-subject-id="${s.id}">${s.name_subject}</div>`
  ).join('');

  loadGradesFor(data[0].id);
}

// Trae las notas del estudiante actual para una materia y arma 4 períodos + promedio.
async function loadGradesFor(subjectId) {
  const tableBody = document.getElementById('gradesBody');

  const { data, error } = await supabaseClient
    .from('score')
    .select('period, note')
    .eq('id_student', currentStudent.id)
    .eq('id_subject', subjectId)
    .order('period');

  if (error) {
    tableBody.innerHTML = '<tr><td colspan="2">Error cargando notas</td></tr>';
    console.error(error);
    return;
  }

  const byPeriod = Object.fromEntries((data || []).map(r => [r.period, Number(r.note)]));
  const html = [];
  let sum = 0, count = 0;

  for (let p = 1; p <= 4; p++) {
    const note = byPeriod[p];
    html.push(`<tr><td>${p}° Período</td><td>${note != null ? note.toFixed(1) : '—'}</td></tr>`);
    if (note != null) { sum += note; count++; }
  }
  const avg = count ? (sum / count).toFixed(1) : '—';
  html.push(`<tr><td>Promedio</td><td>${avg}</td></tr>`);

  tableBody.innerHTML = html.join('');
}

// Delegación: un solo listener en la sidebar maneja clicks sobre items dinámicos
document.querySelector('#screen-calificaciones .subjects-sidebar')
  .addEventListener('click', (e) => {
    const item = e.target.closest('[data-subject-id]');
    if (!item) return;
    item.parentElement.querySelectorAll('.subject-item')
      .forEach(i => i.classList.remove('active'));
    item.classList.add('active');
    loadGradesFor(parseInt(item.dataset.subjectId, 10));
  });

// ============ ASISTENCIAS ============
async function loadSubjectsForAttendance() {
  const sidebar = document.querySelector('#screen-asistencias .subjects-sidebar');
  const body    = document.getElementById('attendanceBody');

  if (!currentStudent) {
    sidebar.innerHTML = '<div class="subject-item">Vista solo para estudiantes</div>';
    body.innerHTML    = '';
    resetAttendanceTally();
    return;
  }

  const { data, error } = await supabaseClient
    .from('subject')
    .select('id, name_subject')
    .order('name_subject');

  if (error) {
    sidebar.innerHTML = '<div class="subject-item">Error cargando materias</div>';
    console.error(error);
    return;
  }
  if (!data || data.length === 0) {
    sidebar.innerHTML = '<div class="subject-item">Sin materias registradas</div>';
    body.innerHTML    = '';
    resetAttendanceTally();
    return;
  }

  sidebar.innerHTML = data.map((s, i) =>
    `<div class="subject-item ${i === 0 ? 'active' : ''}" data-att-subject-id="${s.id}">${s.name_subject}</div>`
  ).join('');

  loadAttendanceFor(data[0].id);
}

async function loadAttendanceFor(subjectId) {
  const body = document.getElementById('attendanceBody');

  const { data, error } = await supabaseClient
    .from('attendance')
    .select('date, status')
    .eq('id_student', currentStudent.id)
    .eq('id_subject', subjectId)
    .order('date');

  if (error) {
    body.innerHTML = '<tr><td colspan="2">Error cargando asistencias</td></tr>';
    console.error(error);
    return;
  }

  const rows  = data || [];
  const tally = { presente: 0, ausente: 0, justificado: 0 };
  rows.forEach(r => { tally[r.status] = (tally[r.status] || 0) + 1; });

  document.getElementById('attCountPresente').textContent    = tally.presente;
  document.getElementById('attCountAusente').textContent     = tally.ausente;
  document.getElementById('attCountJustificado').textContent = tally.justificado;

  body.innerHTML = rows.map(r => {
    const label = r.status.charAt(0).toUpperCase() + r.status.slice(1);
    // Los valores en DB ('presente'/'ausente'/'justificado') coinciden con las clases CSS
    return `<tr><td>${formatAttendanceDate(r.date)}</td><td><span class="att-badge att-${r.status}">${label}</span></td></tr>`;
  }).join('');
}

function resetAttendanceTally() {
  document.getElementById('attCountPresente').textContent    = 0;
  document.getElementById('attCountAusente').textContent     = 0;
  document.getElementById('attCountJustificado').textContent = 0;
}

// 'YYYY-MM-DD' → 'lun, 4 mar 2026'
function formatAttendanceDate(isoDate) {
  const d = new Date(isoDate + 'T00:00:00');
  return d.toLocaleDateString('es-CO', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
  });
}

document.querySelector('#screen-asistencias .subjects-sidebar')
  .addEventListener('click', (e) => {
    const item = e.target.closest('[data-att-subject-id]');
    if (!item) return;
    item.parentElement.querySelectorAll('.subject-item')
      .forEach(i => i.classList.remove('active'));
    item.classList.add('active');
    loadAttendanceFor(parseInt(item.dataset.attSubjectId, 10));
  });
