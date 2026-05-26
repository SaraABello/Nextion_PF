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
let currentTeacher = null;  // perfil de teachers (solo si type = docente)

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
  if (screenId === 'register')         loadGroupsForRegister();
  if (screenId === 'calificaciones')   loadSubjectsForGrades();
  if (screenId === 'asistencias')      loadSubjectsForAttendance();
  if (screenId === 'teacher-subjects')   loadTeacherSubjectsScreen();
  if (screenId === 'teacher-grades')     loadTeacherGradesScreen();
  if (screenId === 'teacher-attendance') loadTeacherAttendanceScreen();
  if (screenId === 'teacher-students')   loadTeacherStudentsScreen();
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

  // 2) Cargar perfil según rol
  if (userRow.type === false) {
    // Estudiante
    const { data: studentRow, error: studErr } = await supabaseClient
      .from('students')
      .select('id, id_document, name, last_name, status, groups(id, name, grade, year)')
      .eq('id_user', userRow.id)
      .maybeSingle();

    if (studErr) {
      error.textContent = 'Error cargando el perfil del estudiante';
      console.error(studErr);
      return;
    }
    currentStudent = studentRow;
    currentTeacher = null;
  } else {
    // Docente
    const { data: teacherRow, error: tErr } = await supabaseClient
      .from('teachers')
      .select('id, name, last_name')
      .eq('id_user', userRow.id)
      .maybeSingle();

    if (tErr) {
      error.textContent = 'Error cargando el perfil del docente';
      console.error(tErr);
      return;
    }
    currentTeacher = teacherRow;
    currentStudent = null;
  }

  // 3) Routing por rol
  error.textContent = '';
  refreshProfile();
  const homeScreen = currentTeacher ? 'teacher-home' : 'home';
  history = ['login', homeScreen];
  showScreen(homeScreen);
}

function refreshProfile() {
  // Nombre que se muestra en el saludo de cualquier home
  let displayName = currentUser?.username || 'usuario';
  if (currentStudent) displayName = `${currentStudent.name} ${currentStudent.last_name}`;
  if (currentTeacher) displayName = `${currentTeacher.name} ${currentTeacher.last_name}`;

  const initials = displayName
    .split(' ')
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  // Saludo en TODOS los home (estudiante y docente)
  document.querySelectorAll('.welcome-name').forEach(el => el.textContent = displayName);

  // Avatar y nombre del perfil
  setProfileField('profileAvatar', initials);
  setProfileField('profileName', displayName);

  // Campos de "Datos personales" — varían según rol
  if (currentStudent) {
    const grupo = currentStudent.groups
      ? `${currentStudent.groups.grade} · ${currentStudent.groups.name} · ${currentStudent.groups.year}`
      : '—';
    setProfileField('profileDocumento', currentStudent.id_document);
    setProfileField('profileGrupo', currentStudent.groups?.name ?? '—');
    setProfileField('profileAnio', currentStudent.groups?.year ?? '—');
    setProfileField('profileEstado', currentStudent.status ? 'Activo' : 'Inactivo');
    setProfileField('profileMeta', `Estudiante · ${grupo}`);
  } else if (currentTeacher) {
    setProfileField('profileDocumento', '—');
    setProfileField('profileGrupo', '—');
    setProfileField('profileAnio', '—');
    setProfileField('profileEstado', 'Activo');
    setProfileField('profileMeta', 'Docente');
  }

  // Correo derivado del username (la tabla aún no lo almacena)
  const fallbackEmail = `${(currentUser?.username || 'usuario').toLowerCase()}@nextion.edu.co`;
  setProfileField('profileEmail', fallbackEmail);
}

function setProfileField(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function logout() {
  currentUser = null;
  currentStudent = null;
  currentTeacher = null;
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

// ============ DOCENTE — MIS ASIGNATURAS ============
let subjectMode = 'existing'; // 'existing' | 'new'

function loadTeacherSubjectsScreen() {
  if (!currentTeacher) {
    document.getElementById('mySubjectsList').innerHTML =
      '<div class="my-subject-empty">Esta vista es solo para docentes</div>';
    return;
  }
  loadMySubjects();
  loadSubjectsDropdownForAssign();
  loadGroupsDropdownForAssign();
  setSubjectMode('existing');
  document.getElementById('assignMessage').textContent = '';
}

// Asignaturas que el docente actual tiene a su cargo
async function loadMySubjects() {
  const container = document.getElementById('mySubjectsList');
  container.innerHTML = '<div class="my-subject-empty">Cargando…</div>';

  const { data, error } = await supabaseClient
    .from('teacher_subject')
    .select('id, subject(name_subject), groups(name, grade, year)')
    .eq('id_teacher', currentTeacher.id)
    .order('id');

  if (error) {
    container.innerHTML = '<div class="my-subject-empty">Error cargando asignaturas</div>';
    console.error(error);
    return;
  }
  if (!data || data.length === 0) {
    container.innerHTML = '<div class="my-subject-empty">Aún no tienes asignaturas a tu cargo</div>';
    return;
  }

  container.innerHTML = data.map(row => `
    <div class="my-subject-item">
      <div class="ms-name">${row.subject?.name_subject ?? '—'}</div>
      <div class="ms-group">${row.groups ? `${row.groups.grade} · ${row.groups.name} · ${row.groups.year}` : '—'}</div>
      <button type="button" class="btn-ms-delete" onclick="unassignSubject(${row.id})" title="Quitar de mi cargo">
        <i class="bi bi-trash"></i>
      </button>
    </div>
  `).join('');
}

// Catálogo completo de materias (para el select "existente")
async function loadSubjectsDropdownForAssign() {
  const sel = document.getElementById('assign-subject');
  const { data, error } = await supabaseClient
    .from('subject')
    .select('id, name_subject')
    .order('name_subject');

  if (error) {
    sel.innerHTML = '<option value="">Error cargando materias</option>';
    console.error(error);
    return;
  }
  if (!data || data.length === 0) {
    sel.innerHTML = '<option value="">No hay materias creadas — usa "Crear nueva"</option>';
    return;
  }
  sel.innerHTML =
    '<option value="">Selecciona una materia…</option>' +
    data.map(s => `<option value="${s.id}">${s.name_subject}</option>`).join('');
}

// Grupos disponibles
async function loadGroupsDropdownForAssign() {
  const sel = document.getElementById('assign-group');
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

function setSubjectMode(mode) {
  subjectMode = mode;
  document.getElementById('tab-subj-existing').classList.toggle('active', mode === 'existing');
  document.getElementById('tab-subj-new').classList.toggle('active', mode === 'new');
  document.getElementById('subj-existing-fields').style.display = mode === 'existing' ? '' : 'none';
  document.getElementById('subj-new-fields').style.display      = mode === 'new'      ? '' : 'none';
}

async function handleAssignSubject(e) {
  e.preventDefault();
  const msg = document.getElementById('assignMessage');
  const groupId = parseInt(document.getElementById('assign-group').value, 10);

  if (!groupId) {
    msg.textContent = 'Selecciona un grupo';
    return;
  }

  let subjectId;

  // Paso 1: obtener o crear el subjectId
  if (subjectMode === 'new') {
    const name = document.getElementById('assign-new-subject').value.trim();
    if (!name) {
      msg.textContent = 'Escribe el nombre de la nueva materia';
      return;
    }

    msg.textContent = 'Creando materia…';
    const { data: newSubj, error: sErr } = await supabaseClient
      .from('subject')
      .insert({ name_subject: name })
      .select('id')
      .single();

    if (sErr) {
      msg.textContent = sErr.code === '23505'
        ? 'Ya existe una materia con ese nombre'
        : 'Error creando la materia';
      console.error(sErr);
      return;
    }
    subjectId = newSubj.id;
  } else {
    subjectId = parseInt(document.getElementById('assign-subject').value, 10);
    if (!subjectId) {
      msg.textContent = 'Selecciona una materia existente';
      return;
    }
  }

  // Paso 2: crear el vínculo teacher_subject
  msg.textContent = 'Asignando…';
  const { error: tsErr } = await supabaseClient
    .from('teacher_subject')
    .insert({
      id_teacher: currentTeacher.id,
      id_subject: subjectId,
      id_group:   groupId,
    });

  if (tsErr) {
    msg.textContent = tsErr.code === '23505'
      ? 'Ya tienes esa materia asignada con ese grupo'
      : 'Error asignando la materia';
    console.error(tsErr);
    return;
  }

  msg.textContent = '✓ Asignación creada';
  document.getElementById('assignSubjectForm').reset();
  setSubjectMode('existing');
  loadMySubjects();              // refresca lista de "a mi cargo"
  loadSubjectsDropdownForAssign(); // por si recién se creó una materia nueva
}

async function unassignSubject(teacherSubjectId) {
  if (!confirm('¿Quitar esta asignatura de tu cargo? Las notas y asistencias registradas no se borran.')) return;

  const { error } = await supabaseClient
    .from('teacher_subject')
    .delete()
    .eq('id', teacherSubjectId);

  if (error) {
    alert('Error al quitar la asignatura: ' + error.message);
    console.error(error);
    return;
  }
  loadMySubjects();
}

// ============ DOCENTE — CALIFICAR ============
// Contexto del editor que se está mostrando.
let currentGradingContext = null; // { subjectId, groupId, subjectName, groupName }

async function loadTeacherGradesScreen() {
  const sidebar = document.getElementById('teacherGradesSidebar');
  const content = document.getElementById('teacherGradesContent');

  if (!currentTeacher) {
    sidebar.innerHTML = '<div class="subject-item">Solo para docentes</div>';
    content.innerHTML = '';
    return;
  }

  // Cargar asignaturas del docente actual
  const { data, error } = await supabaseClient
    .from('teacher_subject')
    .select('id_subject, id_group, subject(name_subject), groups(name, grade, year)')
    .eq('id_teacher', currentTeacher.id)
    .order('id');

  if (error) {
    sidebar.innerHTML = '<div class="subject-item">Error cargando</div>';
    console.error(error);
    return;
  }
  if (!data || data.length === 0) {
    sidebar.innerHTML = '<div class="subject-item">Sin asignaturas</div>';
    content.innerHTML = '<div class="grades-empty">Aún no tienes asignaturas. Ve a "Mis Asignaturas" para crear una.</div>';
    return;
  }

  sidebar.innerHTML = data.map((row, i) => {
    const sName = row.subject?.name_subject ?? '—';
    const gName = row.groups?.name ?? '—';
    return `
      <div class="subject-item ${i === 0 ? 'active' : ''}"
           data-grade-subject-id="${row.id_subject}"
           data-grade-group-id="${row.id_group}"
           data-subject-name="${sName}"
           data-group-name="${gName}">
        ${sName}
        <span class="ts-group-label">${gName}</span>
      </div>`;
  }).join('');

  // Cargar la primera
  const first = data[0];
  loadGradesEditorFor(
    first.id_subject,
    first.id_group,
    first.subject?.name_subject ?? '',
    first.groups?.name ?? ''
  );
}

async function loadGradesEditorFor(subjectId, groupId, subjectName, groupName) {
  const content = document.getElementById('teacherGradesContent');
  content.innerHTML = '<div class="grades-empty">Cargando estudiantes…</div>';
  currentGradingContext = { subjectId, groupId, subjectName, groupName };

  // 1) Estudiantes activos del grupo
  const { data: students, error: sErr } = await supabaseClient
    .from('students')
    .select('id, name, last_name')
    .eq('group_id', groupId)
    .eq('status', true)
    .order('last_name')
    .order('name');

  if (sErr) {
    content.innerHTML = '<div class="grades-empty">Error cargando estudiantes</div>';
    console.error(sErr);
    return;
  }
  if (!students || students.length === 0) {
    content.innerHTML = `
      <div class="grades-editor-header"><strong>${subjectName}</strong> · Grupo ${groupName}</div>
      <div class="grades-empty">No hay estudiantes activos en este grupo</div>`;
    return;
  }

  // 2) Notas existentes
  const studentIds = students.map(s => s.id);
  const { data: scores, error: scErr } = await supabaseClient
    .from('score')
    .select('id_student, period, note')
    .eq('id_subject', subjectId)
    .in('id_student', studentIds);

  if (scErr) {
    content.innerHTML = '<div class="grades-empty">Error cargando notas</div>';
    console.error(scErr);
    return;
  }

  // Indexar notas: { studentId: { period: note } }
  const scoresMap = {};
  (scores || []).forEach(s => {
    if (!scoresMap[s.id_student]) scoresMap[s.id_student] = {};
    scoresMap[s.id_student][s.period] = s.note;
  });

  // 3) Render tabla
  const rowsHtml = students.map(stu => {
    const cells = [1, 2, 3, 4].map(p => {
      const v = scoresMap[stu.id]?.[p];
      const initial = v != null ? Number(v).toFixed(1) : '';
      return `<td>
        <input type="number" class="grade-input"
               min="0" max="5" step="0.1"
               data-student-id="${stu.id}" data-period="${p}" data-initial="${initial}"
               value="${initial}">
      </td>`;
    }).join('');
    return `<tr>
      <td>${stu.name} ${stu.last_name}</td>
      ${cells}
    </tr>`;
  }).join('');

  content.innerHTML = `
    <div class="grades-editor-header"><strong>${subjectName}</strong> · Grupo ${groupName}</div>
    <div class="grades-editor-wrap">
      <table class="grades-editor-table">
        <thead>
          <tr><th>Estudiante</th><th>P1</th><th>P2</th><th>P3</th><th>P4</th></tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </div>
    <button type="button" class="btn btn-nx-primary mt-3" onclick="saveGradesChanges()">Guardar cambios</button>
    <p class="login-error mt-2 mb-0" id="gradesMessage"></p>
  `;
}

// Marca celdas modificadas (delegación: un solo listener sobre el contenedor)
document.getElementById('teacherGradesContent')
  .addEventListener('input', (e) => {
    const inp = e.target.closest('.grade-input');
    if (!inp) return;
    inp.classList.toggle('dirty', inp.value.trim() !== inp.dataset.initial);
  });

async function saveGradesChanges() {
  const msg = document.getElementById('gradesMessage');
  if (!currentGradingContext) return;

  const inputs = document.querySelectorAll('#teacherGradesContent .grade-input');
  const subjectId = currentGradingContext.subjectId;

  const toUpsert = [];
  const toDelete = [];

  for (const inp of inputs) {
    const initial = inp.dataset.initial;
    const current = inp.value.trim();
    if (initial === current) continue;

    const studentId = parseInt(inp.dataset.studentId, 10);
    const period    = parseInt(inp.dataset.period, 10);

    if (current === '') {
      // Solo borrar si antes había nota
      if (initial !== '') toDelete.push({ studentId, period });
      continue;
    }

    const note = parseFloat(current);
    if (isNaN(note) || note < 0 || note > 5) {
      msg.textContent = `Nota inválida (${current}) — debe estar entre 0.0 y 5.0`;
      inp.focus();
      return;
    }

    toUpsert.push({
      id_student: studentId,
      id_subject: subjectId,
      period,
      note,
    });
  }

  if (toUpsert.length === 0 && toDelete.length === 0) {
    msg.textContent = 'No hay cambios para guardar';
    return;
  }

  msg.textContent = 'Guardando…';

  // Upsert: clave de conflicto = (id_student, id_subject, period) — coincide con el UNIQUE del schema
  if (toUpsert.length > 0) {
    const { error: upErr } = await supabaseClient
      .from('score')
      .upsert(toUpsert, { onConflict: 'id_student,id_subject,period' });

    if (upErr) {
      msg.textContent = 'Error guardando notas';
      console.error(upErr);
      return;
    }
  }

  // Borrar las que el docente vació
  for (const d of toDelete) {
    const { error: delErr } = await supabaseClient
      .from('score')
      .delete()
      .eq('id_student', d.studentId)
      .eq('id_subject', subjectId)
      .eq('period', d.period);

    if (delErr) {
      msg.textContent = 'Error borrando nota';
      console.error(delErr);
      return;
    }
  }

  msg.textContent = `✓ Guardado: ${toUpsert.length} actualizadas, ${toDelete.length} borradas`;

  // Recargar para reflejar nuevas "initial values" y limpiar el estado dirty
  loadGradesEditorFor(
    currentGradingContext.subjectId,
    currentGradingContext.groupId,
    currentGradingContext.subjectName,
    currentGradingContext.groupName
  );
}

// Delegación: click en sidebar de "mis asignaturas"
document.querySelector('#screen-teacher-grades .subjects-sidebar')
  .addEventListener('click', (e) => {
    const item = e.target.closest('[data-grade-subject-id]');
    if (!item) return;
    item.parentElement.querySelectorAll('.subject-item')
      .forEach(i => i.classList.remove('active'));
    item.classList.add('active');
    loadGradesEditorFor(
      parseInt(item.dataset.gradeSubjectId, 10),
      parseInt(item.dataset.gradeGroupId, 10),
      item.dataset.subjectName,
      item.dataset.groupName
    );
  });

// ============ DOCENTE — REGISTRAR ASISTENCIAS ============
let currentAttendanceContext = null;
// { subjectId, groupId, subjectName, groupName, dateIso }

function todayIso() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

async function loadTeacherAttendanceScreen() {
  const sidebar = document.getElementById('teacherAttendanceSidebar');
  const content = document.getElementById('teacherAttendanceContent');

  if (!currentTeacher) {
    sidebar.innerHTML = '<div class="subject-item">Solo para docentes</div>';
    content.innerHTML = '';
    return;
  }

  const { data, error } = await supabaseClient
    .from('teacher_subject')
    .select('id_subject, id_group, subject(name_subject), groups(name)')
    .eq('id_teacher', currentTeacher.id)
    .order('id');

  if (error) {
    sidebar.innerHTML = '<div class="subject-item">Error cargando</div>';
    console.error(error);
    return;
  }
  if (!data || data.length === 0) {
    sidebar.innerHTML = '<div class="subject-item">Sin asignaturas</div>';
    content.innerHTML = '<div class="grades-empty">Aún no tienes asignaturas. Ve a "Mis Asignaturas" para crear una.</div>';
    return;
  }

  sidebar.innerHTML = data.map((row, i) => {
    const sName = row.subject?.name_subject ?? '—';
    const gName = row.groups?.name ?? '—';
    return `
      <div class="subject-item ${i === 0 ? 'active' : ''}"
           data-att-teacher-subject-id="${row.id_subject}"
           data-att-teacher-group-id="${row.id_group}"
           data-subject-name="${sName}"
           data-group-name="${gName}">
        ${sName}
        <span class="ts-group-label">${gName}</span>
      </div>`;
  }).join('');

  const first = data[0];
  loadAttendanceEditorFor(
    first.id_subject,
    first.id_group,
    first.subject?.name_subject ?? '',
    first.groups?.name ?? '',
    todayIso()
  );
}

async function loadAttendanceEditorFor(subjectId, groupId, subjectName, groupName, dateIso) {
  const content = document.getElementById('teacherAttendanceContent');
  content.innerHTML = '<div class="grades-empty">Cargando…</div>';
  currentAttendanceContext = { subjectId, groupId, subjectName, groupName, dateIso };

  // 1) Estudiantes activos del grupo
  const { data: students, error: sErr } = await supabaseClient
    .from('students')
    .select('id, name, last_name')
    .eq('group_id', groupId)
    .eq('status', true)
    .order('last_name')
    .order('name');

  if (sErr) {
    content.innerHTML = '<div class="grades-empty">Error cargando estudiantes</div>';
    console.error(sErr);
    return;
  }

  // Header + toolbar SIEMPRE se muestran (aunque no haya estudiantes)
  const headerHtml = `
    <div class="grades-editor-header"><strong>${subjectName}</strong> · Grupo ${groupName}</div>
    <div class="att-toolbar">
      <label for="attDate">FECHA</label>
      <input type="date" id="attDate" value="${dateIso}">
    </div>`;

  if (!students || students.length === 0) {
    content.innerHTML = headerHtml +
      '<div class="grades-empty">No hay estudiantes activos en este grupo</div>';
    bindAttDateChange();
    return;
  }

  // 2) Asistencias ya registradas en esa fecha para esos estudiantes
  const studentIds = students.map(s => s.id);
  const { data: records, error: aErr } = await supabaseClient
    .from('attendance')
    .select('id_student, status')
    .eq('id_subject', subjectId)
    .eq('date', dateIso)
    .in('id_student', studentIds);

  if (aErr) {
    content.innerHTML = headerHtml + '<div class="grades-empty">Error cargando asistencias</div>';
    console.error(aErr);
    bindAttDateChange();
    return;
  }

  const statusMap = Object.fromEntries((records || []).map(r => [r.id_student, r.status]));

  // 3) Render filas con botones P/A/J
  const STATUSES = [
    { key: 'presente',    label: 'P' },
    { key: 'ausente',     label: 'A' },
    { key: 'justificado', label: 'J' },
  ];

  const rowsHtml = students.map(stu => {
    const initial = statusMap[stu.id] || '';
    const btns = STATUSES.map(s => `
      <button type="button" class="att-btn ${initial === s.key ? 'active' : ''}" data-status="${s.key}">${s.label}</button>
    `).join('');
    return `<tr>
      <td>${stu.name} ${stu.last_name}</td>
      <td>
        <div class="att-btn-group" data-student-id="${stu.id}" data-initial="${initial}">
          ${btns}
        </div>
      </td>
    </tr>`;
  }).join('');

  content.innerHTML = headerHtml + `
    <div class="grades-editor-wrap">
      <table class="grades-editor-table">
        <thead><tr><th>Estudiante</th><th>Estado</th></tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </div>
    <button type="button" class="btn btn-nx-primary mt-3" onclick="saveAttendanceChanges()">Guardar asistencia</button>
    <p class="login-error mt-2 mb-0" id="attendanceMessage"></p>`;

  bindAttDateChange();
}

function bindAttDateChange() {
  const dateInput = document.getElementById('attDate');
  if (!dateInput) return;
  dateInput.addEventListener('change', () => {
    if (hasDirtyAttendance() &&
        !confirm('Tienes cambios sin guardar. ¿Cargar otra fecha y perderlos?')) {
      dateInput.value = currentAttendanceContext.dateIso;
      return;
    }
    const ctx = currentAttendanceContext;
    loadAttendanceEditorFor(ctx.subjectId, ctx.groupId, ctx.subjectName, ctx.groupName, dateInput.value);
  });
}

function hasDirtyAttendance() {
  const groups = document.querySelectorAll('#teacherAttendanceContent .att-btn-group');
  for (const g of groups) {
    const initial = g.dataset.initial || '';
    const current = g.querySelector('.att-btn.active')?.dataset.status || '';
    if (initial !== current) return true;
  }
  return false;
}

// Delegación: click en cualquier botón P/A/J — alterna el activo dentro de su grupo
document.getElementById('teacherAttendanceContent')
  .addEventListener('click', (e) => {
    const btn = e.target.closest('.att-btn');
    if (!btn) return;
    const group = btn.closest('.att-btn-group');
    const wasActive = btn.classList.contains('active');
    group.querySelectorAll('.att-btn').forEach(b => b.classList.remove('active'));
    if (!wasActive) btn.classList.add('active'); // segundo click = deselecciona
  });

async function saveAttendanceChanges() {
  const msg = document.getElementById('attendanceMessage');
  if (!currentAttendanceContext) return;
  const ctx = currentAttendanceContext;

  const groups = document.querySelectorAll('#teacherAttendanceContent .att-btn-group');
  const toUpsert = [];
  const toDelete = [];

  groups.forEach(g => {
    const studentId = parseInt(g.dataset.studentId, 10);
    const initial   = g.dataset.initial || '';
    const current   = g.querySelector('.att-btn.active')?.dataset.status || '';
    if (initial === current) return;

    if (current === '') {
      if (initial !== '') toDelete.push({ studentId });
    } else {
      toUpsert.push({
        id_student: studentId,
        id_subject: ctx.subjectId,
        date:       ctx.dateIso,
        status:     current,
      });
    }
  });

  if (toUpsert.length === 0 && toDelete.length === 0) {
    msg.textContent = 'No hay cambios para guardar';
    return;
  }

  msg.textContent = 'Guardando…';

  if (toUpsert.length > 0) {
    const { error } = await supabaseClient
      .from('attendance')
      .upsert(toUpsert, { onConflict: 'id_student,id_subject,date' });
    if (error) {
      msg.textContent = 'Error guardando asistencias';
      console.error(error);
      return;
    }
  }

  for (const d of toDelete) {
    const { error } = await supabaseClient
      .from('attendance')
      .delete()
      .eq('id_student', d.studentId)
      .eq('id_subject', ctx.subjectId)
      .eq('date', ctx.dateIso);
    if (error) {
      msg.textContent = 'Error borrando asistencia';
      console.error(error);
      return;
    }
  }

  msg.textContent = `✓ Guardado: ${toUpsert.length} marcadas, ${toDelete.length} borradas`;

  // Recargar para reflejar los nuevos "initial values"
  loadAttendanceEditorFor(ctx.subjectId, ctx.groupId, ctx.subjectName, ctx.groupName, ctx.dateIso);
}

// Delegación: click en sidebar de asignaturas
document.querySelector('#screen-teacher-attendance .subjects-sidebar')
  .addEventListener('click', (e) => {
    const item = e.target.closest('[data-att-teacher-subject-id]');
    if (!item) return;

    if (hasDirtyAttendance() &&
        !confirm('Tienes cambios sin guardar. ¿Cambiar de asignatura y perderlos?')) return;

    item.parentElement.querySelectorAll('.subject-item')
      .forEach(i => i.classList.remove('active'));
    item.classList.add('active');

    loadAttendanceEditorFor(
      parseInt(item.dataset.attTeacherSubjectId, 10),
      parseInt(item.dataset.attTeacherGroupId, 10),
      item.dataset.subjectName,
      item.dataset.groupName,
      currentAttendanceContext?.dateIso || todayIso()
    );
  });

// ============ DOCENTE — LISTADO / EDICIÓN DE ESTUDIANTES ============
let cachedStudents = [];
let studentSearchTerm = '';
let includeInactiveStudents = false;
let editingStudentId = null;

// Escape minimal para inyectar valores en atributos HTML (name, document, etc.)
function escapeAttr(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

async function loadTeacherStudentsScreen() {
  const content = document.getElementById('teacherStudentsContent');

  if (!currentTeacher) {
    content.innerHTML = '<div class="grades-empty">Solo para docentes</div>';
    return;
  }

  content.innerHTML = '<div class="grades-empty">Cargando estudiantes…</div>';
  editingStudentId = null;

  const { data, error } = await supabaseClient
    .from('students')
    .select('id, id_document, name, last_name, status, users(username), groups(id, name, grade, year)')
    .order('last_name')
    .order('name');

  if (error) {
    content.innerHTML = '<div class="grades-empty">Error cargando estudiantes</div>';
    console.error(error);
    return;
  }

  cachedStudents = data || [];
  renderStudentsList();
}

function renderStudentsList() {
  const content = document.getElementById('teacherStudentsContent');

  content.innerHTML = `
    <div class="students-toolbar">
      <input type="text" id="studentSearch" placeholder="Buscar por nombre, apellido o documento…"
             value="${escapeAttr(studentSearchTerm)}">
      <label class="students-filter">
        <input type="checkbox" id="includeInactive" ${includeInactiveStudents ? 'checked' : ''}>
        <span>Mostrar inactivos</span>
      </label>
    </div>
    <div class="grades-editor-wrap">
      <table class="grades-editor-table students-table">
        <thead>
          <tr>
            <th>Estudiante</th>
            <th>Documento</th>
            <th>Grupo</th>
            <th>Estado</th>
            <th></th>
          </tr>
        </thead>
        <tbody id="studentsTableBody"></tbody>
      </table>
    </div>
  `;

  updateStudentsTbody();

  // Filtros en vivo (sin re-renderizar todo el HTML — preserva el foco del input)
  document.getElementById('studentSearch').addEventListener('input', (e) => {
    studentSearchTerm = e.target.value;
    updateStudentsTbody();
  });
  document.getElementById('includeInactive').addEventListener('change', (e) => {
    includeInactiveStudents = e.target.checked;
    updateStudentsTbody();
  });
}

function updateStudentsTbody() {
  const tbody = document.getElementById('studentsTableBody');
  if (!tbody) return;

  const term = studentSearchTerm.trim().toLowerCase();
  const filtered = cachedStudents.filter(s => {
    if (!includeInactiveStudents && !s.status) return false;
    if (term) {
      const hay = `${s.name} ${s.last_name} ${s.id_document}`.toLowerCase();
      if (!hay.includes(term)) return false;
    }
    return true;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="td-empty">Sin resultados</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map(s => `
    <tr>
      <td>
        <div class="st-name">${escapeAttr(s.name)} ${escapeAttr(s.last_name)}</div>
        <div class="st-meta">@${escapeAttr(s.users?.username ?? '—')}</div>
      </td>
      <td>${escapeAttr(s.id_document)}</td>
      <td>${escapeAttr(s.groups?.name ?? '—')}</td>
      <td>
        <span class="att-badge ${s.status ? 'att-presente' : 'att-ausente'}">
          ${s.status ? 'Activo' : 'Inactivo'}
        </span>
      </td>
      <td class="td-action">
        <button type="button" class="btn-st-edit" onclick="openStudentEdit(${s.id})">
          <i class="bi bi-pencil"></i> Editar
        </button>
      </td>
    </tr>
  `).join('');
}

async function openStudentEdit(studentId) {
  const stu = cachedStudents.find(x => x.id === studentId);
  if (!stu) return;
  editingStudentId = studentId;

  const content = document.getElementById('teacherStudentsContent');
  content.innerHTML = '<div class="grades-empty">Cargando…</div>';

  const { data: groups, error } = await supabaseClient
    .from('groups')
    .select('id, name, grade, year')
    .order('year', { ascending: false })
    .order('name');

  if (error) {
    content.innerHTML = '<div class="grades-empty">Error cargando grupos</div>';
    console.error(error);
    return;
  }

  const groupOpts = (groups || []).map(g => `
    <option value="${g.id}" ${g.id === stu.groups?.id ? 'selected' : ''}>
      ${g.grade} · ${g.name} · ${g.year}
    </option>
  `).join('');

  content.innerHTML = `
    <button type="button" class="btn btn-back align-self-start mb-3" onclick="closeStudentEdit()">
      <i class="bi bi-arrow-left"></i> Volver al listado
    </button>

    <h6 class="section-title">Editar estudiante</h6>

    <form class="register-card" id="editStudentForm" onsubmit="handleSaveStudent(event)">
      <div class="mb-2">
        <label class="form-label">Usuario (no editable)</label>
        <input class="form-control" type="text" value="${escapeAttr(stu.users?.username ?? '')}" disabled>
      </div>
      <div class="mb-2">
        <label class="form-label" for="edit-name">Nombre</label>
        <input class="form-control" id="edit-name" type="text" value="${escapeAttr(stu.name)}">
      </div>
      <div class="mb-2">
        <label class="form-label" for="edit-lastname">Apellido</label>
        <input class="form-control" id="edit-lastname" type="text" value="${escapeAttr(stu.last_name)}">
      </div>
      <div class="mb-2">
        <label class="form-label" for="edit-document">Documento</label>
        <input class="form-control" id="edit-document" type="text" inputmode="numeric"
               value="${escapeAttr(stu.id_document)}">
      </div>
      <div class="mb-2">
        <label class="form-label" for="edit-group">Grupo</label>
        <select class="form-control form-select" id="edit-group">${groupOpts}</select>
      </div>
      <div class="mb-2">
        <label class="form-label" for="edit-status">Estado</label>
        <select class="form-control form-select" id="edit-status">
          <option value="true"  ${stu.status ? 'selected' : ''}>Activo</option>
          <option value="false" ${!stu.status ? 'selected' : ''}>Inactivo</option>
        </select>
      </div>
      <button type="submit" class="btn btn-nx-primary w-100 mt-2">Guardar cambios</button>
    </form>

    <p class="login-error mt-3 mb-0" id="editStudentMessage"></p>
  `;
}

function closeStudentEdit() {
  editingStudentId = null;
  renderStudentsList();
}

async function handleSaveStudent(e) {
  e.preventDefault();
  const msg = document.getElementById('editStudentMessage');

  const name      = document.getElementById('edit-name').value.trim();
  const lastname  = document.getElementById('edit-lastname').value.trim();
  const idDoc     = document.getElementById('edit-document').value.trim();
  const groupId   = parseInt(document.getElementById('edit-group').value, 10);
  const status    = document.getElementById('edit-status').value === 'true';

  if (!name || !lastname || !idDoc || !groupId) {
    msg.textContent = 'Todos los campos son obligatorios';
    return;
  }

  msg.textContent = 'Guardando…';

  const { error } = await supabaseClient
    .from('students')
    .update({
      name,
      last_name:   lastname,
      id_document: idDoc,
      group_id:    groupId,
      status,
    })
    .eq('id', editingStudentId);

  if (error) {
    msg.textContent = error.code === '23505'
      ? 'Ese documento ya está usado por otro estudiante'
      : 'Error guardando los cambios';
    console.error(error);
    return;
  }

  msg.textContent = '✓ Cambios guardados';

  // Refrescar caché y volver al listado
  await loadTeacherStudentsScreen();
}
