/* ================================================================
   PENCRAFT ACADEMY — Student Portal Client
   Secure authentication, Google Drive video embedding & class management
   ================================================================ */

document.addEventListener('DOMContentLoaded', () => {
  const authSection = document.getElementById('authSection');
  const portalSection = document.getElementById('portalSection');
  const loginAlert = document.getElementById('loginAlert');

  // Tabs
  const tabStudentBtn = document.getElementById('tabStudentBtn');
  const tabSignupBtn = document.getElementById('tabSignupBtn');
  const tabAdminBtn = document.getElementById('tabAdminBtn');

  // Forms
  const studentLoginForm = document.getElementById('studentLoginForm');
  const signupTabContent = document.getElementById('signupTabContent');
  const adminLoginForm = document.getElementById('adminLoginForm');

  // Student Info Displays
  const userGreeting = document.getElementById('userGreeting');
  const displayStudentId = document.getElementById('displayStudentId');
  const copyIdBtn = document.getElementById('copyIdBtn');
  const studentIdContainer = document.getElementById('studentIdContainer');
  const adminBadgeContainer = document.getElementById('adminBadgeContainer');
  const signOutBtn = document.getElementById('signOutBtn');

  // Links
  const recordingsFolderBtn = document.getElementById('recordingsFolderBtn');
  const assignmentFormHeaderBtn = document.getElementById('assignmentFormHeaderBtn');

  // Classes & Admin
  const classesList = document.getElementById('classesList');
  const adminPanel = document.getElementById('adminPanel');
  const toggleAddClassBtn = document.getElementById('toggleAddClassBtn');
  const classManagerForm = document.getElementById('classManagerForm');
  const formHeaderTitle = document.getElementById('formHeaderTitle');
  const editClassId = document.getElementById('editClassId');
  const classTitleInput = document.getElementById('classTitleInput');
  const classDateInput = document.getElementById('classDateInput');
  const classDriveUrlInput = document.getElementById('classDriveUrlInput');
  const classNotesInput = document.getElementById('classNotesInput');
  const cancelClassBtn = document.getElementById('cancelClassBtn');

  const STORAGE_KEY = 'pencraft_portal_token';
  const USER_KEY = 'pencraft_portal_user';

  // --- Tab switching ---
  function setTab(tab) {
    if (tabStudentBtn) tabStudentBtn.classList.remove('active');
    if (tabSignupBtn) tabSignupBtn.classList.remove('active');
    if (tabAdminBtn) tabAdminBtn.classList.remove('active');

    if (studentLoginForm) studentLoginForm.style.display = 'none';
    if (signupTabContent) signupTabContent.style.display = 'none';
    if (adminLoginForm) adminLoginForm.style.display = 'none';
    hideAlert();

    if (tab === 'student') {
      if (tabStudentBtn) tabStudentBtn.classList.add('active');
      if (studentLoginForm) studentLoginForm.style.display = 'block';
    } else if (tab === 'signup') {
      if (tabSignupBtn) tabSignupBtn.classList.add('active');
      if (signupTabContent) signupTabContent.style.display = 'block';
    } else if (tab === 'admin') {
      if (tabAdminBtn) tabAdminBtn.classList.add('active');
      if (adminLoginForm) adminLoginForm.style.display = 'block';
    }
  }

  if (tabStudentBtn) tabStudentBtn.addEventListener('click', () => setTab('student'));
  if (tabSignupBtn) tabSignupBtn.addEventListener('click', () => setTab('signup'));
  if (tabAdminBtn) tabAdminBtn.addEventListener('click', () => setTab('admin'));

  function showAlert(msg, isError = true) {
    if (!loginAlert) return;
    loginAlert.textContent = msg;
    loginAlert.className = `portal-alert ${isError ? 'error' : 'success'}`;
    loginAlert.style.display = 'block';
  }

  function hideAlert() {
    if (loginAlert) loginAlert.style.display = 'none';
  }

  // --- Student Login ---
  if (studentLoginForm) {
    studentLoginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      hideAlert();

      const studentId = document.getElementById('studentIdInput').value.trim();
      const fullName = document.getElementById('studentNameInput').value.trim();
      const submitBtn = document.getElementById('studentSubmitBtn');

      if (!studentId || !fullName) {
        showAlert('Please enter both your Student ID and your registered Full Name.');
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = 'Verifying Records...';

      try {
        const res = await fetch('/api/portal/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ studentId, fullName })
        });

        const data = await res.json();
        submitBtn.disabled = false;
        submitBtn.textContent = 'Sign In to Portal →';

        if (!res.ok || !data.success) {
          showAlert(data.error || "We couldn't find you in our student records. Please check your Student ID and name, or contact the academy.");
          return;
        }

        // Save session
        localStorage.setItem(STORAGE_KEY, data.token);
        localStorage.setItem(USER_KEY, JSON.stringify(data.student));
        initPortalView(data.student);
      } catch (err) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Sign In to Portal →';
        showAlert("We couldn't find you in our student records. Please check your Student ID and name, or contact the academy.");
      }
    });
  }

  // --- Admin Login ---
  if (adminLoginForm) {
    adminLoginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      hideAlert();

      const password = document.getElementById('adminPasswordInput').value;
      const submitBtn = document.getElementById('adminSubmitBtn');

      submitBtn.disabled = true;
      submitBtn.textContent = 'Authenticating...';

      try {
        const res = await fetch('/api/portal/admin-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password })
        });

        const data = await res.json();
        submitBtn.disabled = false;
        submitBtn.textContent = 'Sign In as Admin →';

        if (!res.ok || !data.success) {
          showAlert(data.error || 'Invalid administrator password.');
          return;
        }

        localStorage.setItem(STORAGE_KEY, data.token);
        localStorage.setItem(USER_KEY, JSON.stringify(data.user));
        initPortalView(data.user);
      } catch (err) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Sign In as Admin →';
        showAlert('Unable to authenticate as admin. Please try again.');
      }
    });
  }

  // --- Copy Student ID ---
  if (copyIdBtn) {
    copyIdBtn.addEventListener('click', () => {
      const idText = displayStudentId.textContent;
      navigator.clipboard.writeText(idText).then(() => {
        copyIdBtn.textContent = 'Copied! ✓';
        setTimeout(() => { copyIdBtn.textContent = 'Copy'; }, 2000);
      });
    });
  }

  // --- Sign Out ---
  if (signOutBtn) {
    signOutBtn.addEventListener('click', () => {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(USER_KEY);
      authSection.style.display = 'block';
      portalSection.style.display = 'none';
      setTab('student');
    });
  }

  // --- Initialize Portal View ---
  async function initPortalView(user) {
    authSection.style.display = 'none';
    portalSection.style.display = 'block';

    if (user.role === 'admin') {
      userGreeting.textContent = 'Faculty Administrator Workspace';
      studentIdContainer.style.display = 'none';
      adminBadgeContainer.style.display = 'block';
      if (adminPanel) adminPanel.style.display = 'block';
    } else {
      userGreeting.textContent = `Welcome back, ${user.fullName}`;
      displayStudentId.textContent = user.studentId;
      studentIdContainer.style.display = 'inline-flex';
      adminBadgeContainer.style.display = 'none';
      if (adminPanel) adminPanel.style.display = 'none';
    }

    await loadClasses();
  }

  // --- Load Classes ---
  async function loadClasses() {
    const token = localStorage.getItem(STORAGE_KEY);
    if (!token) return;

    try {
      const res = await fetch('/api/portal/classes', {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.status === 401) {
        localStorage.removeItem(STORAGE_KEY);
        authSection.style.display = 'block';
        portalSection.style.display = 'none';
        return;
      }

      const data = await res.json();
      const classes = data.classes || [];

      // Update external links
      if (recordingsFolderBtn && data.driveFolderUrl) {
        recordingsFolderBtn.href = data.driveFolderUrl;
      }
      if (assignmentFormHeaderBtn && data.assignmentFormUrl) {
        assignmentFormHeaderBtn.href = data.assignmentFormUrl;
      }

      renderClasses(classes, data.assignmentFormUrl);
    } catch (err) {
      console.error('Error loading classes:', err);
    }
  }

  function renderClasses(classes, assignmentFormUrl) {
    if (!classesList) return;

    if (classes.length === 0) {
      classesList.innerHTML = `
        <div class="empty-classes">
          <div style="font-size: 2.5rem; margin-bottom: 0.75rem;">🎬</div>
          <h4 style="font-family: var(--font-heading); color: var(--navy-900); font-size: 1.2rem; margin-bottom: 0.5rem;">
            No Class Sessions Published Yet
          </h4>
          <p style="color: var(--text-secondary); max-width: 480px; margin: 0 auto;">
            Recordings and materials will appear here as live cohort sessions begin. Check back soon or reach out via WhatsApp!
          </p>
        </div>
      `;
      return;
    }

    const user = JSON.parse(localStorage.getItem(USER_KEY) || '{}');
    const isAdmin = user.role === 'admin';

    let html = '';
    classes.forEach(c => {
      const formattedDate = c.date ? new Date(c.date + 'T00:00:00').toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }) : 'Date to be announced';

      html += `
        <article class="class-card" id="${c.id}">
          <div class="class-header">
            <div>
              <h4 class="class-title">${escapeHtml(c.title)}</h4>
              <span class="class-date">📅 ${formattedDate}</span>
            </div>
            ${isAdmin ? `
              <div style="display: flex; gap: 0.4rem;">
                <button type="button" class="btn btn-sm btn-outline edit-class-btn" data-id="${c.id}" style="color: var(--navy-800); border-color: var(--light-gray); padding: 0.35rem 0.75rem;">Edit</button>
                <button type="button" class="btn btn-sm delete-class-btn" data-id="${c.id}" style="background: #FEE2E2; color: #991B1B; padding: 0.35rem 0.75rem;">Delete</button>
              </div>
            ` : ''}
          </div>

          ${c.embedUrl ? `
            <div class="video-wrapper">
              <iframe 
                src="${c.embedUrl}" 
                allow="autoplay; encrypted-media; fullscreen" 
                allowfullscreen="true" 
                title="${escapeHtml(c.title)}">
              </iframe>
            </div>
          ` : ''}

          <div class="class-body">
            ${c.notes ? `<div class="class-notes">${escapeHtml(c.notes)}</div>` : ''}
            
            <div class="class-actions">
              <a href="${assignmentFormUrl || 'https://forms.gle/1bzbqAZr9zzqfLmo9'}" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-primary">
                📝 Submit Assignment
              </a>
              ${c.driveUrl ? `
                <a href="${c.driveUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-outline" style="color: var(--navy-700); border-color: var(--light-gray);">
                  ↗ Open Recording on Drive
                </a>
              ` : ''}
            </div>
          </div>
        </article>
      `;
    });

    classesList.innerHTML = html;

    // Attach Admin Edit/Delete listeners
    if (isAdmin) {
      document.querySelectorAll('.delete-class-btn').forEach(btn => {
        btn.addEventListener('click', () => handleDeleteClass(btn.dataset.id));
      });

      document.querySelectorAll('.edit-class-btn').forEach(btn => {
        btn.addEventListener('click', () => handleEditClass(btn.dataset.id, classes));
      });
    }
  }

  // --- Admin Class Management Handlers ---
  if (toggleAddClassBtn) {
    toggleAddClassBtn.addEventListener('click', () => {
      resetClassForm();
      classManagerForm.style.display = classManagerForm.style.display === 'none' ? 'block' : 'none';
    });
  }

  if (cancelClassBtn) {
    cancelClassBtn.addEventListener('click', () => {
      classManagerForm.style.display = 'none';
      resetClassForm();
    });
  }

  function resetClassForm() {
    formHeaderTitle.textContent = 'Add Class Session';
    editClassId.value = '';
    classTitleInput.value = '';
    classDateInput.value = new Date().toISOString().split('T')[0];
    classDriveUrlInput.value = '';
    classNotesInput.value = '';
  }

  function handleEditClass(id, classes) {
    const target = classes.find(c => c.id === id);
    if (!target) return;

    formHeaderTitle.textContent = 'Edit Class Session';
    editClassId.value = target.id;
    classTitleInput.value = target.title || '';
    classDateInput.value = target.date || '';
    classDriveUrlInput.value = target.driveUrl || '';
    classNotesInput.value = target.notes || '';

    classManagerForm.style.display = 'block';
    classManagerForm.scrollIntoView({ behavior: 'smooth' });
  }

  async function handleDeleteClass(id) {
    if (!confirm('Are you sure you want to delete this class recording?')) return;
    const token = localStorage.getItem(STORAGE_KEY);

    try {
      const res = await fetch(`/api/portal/classes/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        await loadClasses();
      } else {
        alert('Failed to delete class.');
      }
    } catch (err) {
      alert('Error connecting to server.');
    }
  }

  if (classManagerForm) {
    classManagerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const token = localStorage.getItem(STORAGE_KEY);
      const id = editClassId.value;

      const payload = {
        title: classTitleInput.value.trim(),
        date: classDateInput.value,
        driveUrl: classDriveUrlInput.value.trim(),
        notes: classNotesInput.value.trim()
      };

      try {
        const url = id ? `/api/portal/classes/${id}` : '/api/portal/classes';
        const method = id ? 'PUT' : 'POST';

        const res = await fetch(url, {
          method,
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        });

        if (res.ok) {
          classManagerForm.style.display = 'none';
          resetClassForm();
          await loadClasses();
        } else {
          const err = await res.json();
          alert(err.error || 'Failed to save class.');
        }
      } catch (err) {
        alert('Server error occurred.');
      }
    });
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>"']/g, (m) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    }[m]));
  }

  // --- Auto-check existing session on load ---
  const savedToken = localStorage.getItem(STORAGE_KEY);
  const savedUser = localStorage.getItem(USER_KEY);

  if (savedToken && savedUser) {
    try {
      const parsed = JSON.parse(savedUser);
      initPortalView(parsed);
    } catch {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(USER_KEY);
    }
  }
});
