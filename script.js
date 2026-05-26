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

function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const target = document.getElementById('screen-' + screenId);
  if (target) target.classList.add('active');
}

function navigate(screenId) {
  history.push(screenId);
  showScreen(screenId);
  // Hook por pantalla: cargar datos justo cuando se abre
  if (screenId === 'register') loadGroupsForRegister();
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
