// AgamaKu App Core State & Controller
let appState = {
  activeView: 'auth-view',
  currentUser: null,
  partnerUser: null,
  currentBooking: null,
  historyList: [],
  activeMap: null,
  soundInterval: null,
  jobCountdownInterval: null,
  classTimerInterval: null,
  partnerOnlineTimeout: null,
  selectedTeacher: null,
  profileBackView: 'home-view',
  teachersList: [],
  reviewsList: [],
  pollingInterval: null,
  userLocation: null
};

// Initial User Profile setup if not already in local storage
const defaultUser = {
  name: 'Tengku Adrian',
  avatar: '🧑',
  wallet: 150.00,
  role: 'user'
};

const defaultPartner = {
  name: 'Ustaz Zulkifli Harun',
  avatar: '👳‍♂️',
  wallet: 420.50,
  online: false,
  earningsToday: 0.0,
  earningsWeek: 245.0,
  completedJobs: 14
};

const defaultHistory = [
  {
    id: 'bk_101',
    serviceId: 'mengaji',
    serviceName: 'Mengaji & Tajwid',
    teacherName: 'Ustaz Ahmad Syakir',
    datetime: '2026-05-18T14:00',
    duration: '1.5 Jam',
    price: 52.50,
    status: 'completed',
    rated: true,
    rating: 5
  },
  {
    id: 'bk_102',
    serviceId: 'tahlil',
    serviceName: 'Doa Selamat & Tahlil',
    teacherName: 'Ustaz Zulkifli Harun',
    datetime: '2026-05-12T19:30',
    duration: '2 Jam',
    price: 100.00,
    status: 'completed',
    rated: true,
    rating: 5
  }
];

// Initialize application on load
window.addEventListener('DOMContentLoaded', () => {
  initApp();
});

// Fetch user location
async function fetchUserLocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      appState.userLocation = DEFAULT_USER_LOCATION;
      resolve();
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        appState.userLocation = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude
        };
        resolve();
      },
      (err) => {
        console.warn('Geolocation failed/denied, using default KL Sentral location.', err);
        appState.userLocation = DEFAULT_USER_LOCATION;
        resolve();
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
  });
}

async function initApp() {
  const savedUser = localStorage.getItem('agamaku_user');
  if (savedUser) {
    try {
      appState.currentUser = JSON.parse(savedUser);
      appState.currentBooking = DB.get('active_booking', null);
      
      // Load latest database records and get location
      await Promise.all([
        loadDatabaseData(),
        fetchUserLocation()
      ]);

      document.getElementById('home-user-name').textContent = appState.currentUser.fullname;
      updateUserProfileUI();

      if (appState.currentUser.role === 'partner') {
        const savedPartner = DB.get('profile_partner', {});
        const teacherData = appState.teachersList.find(t => t.id === appState.currentUser.teacher_id);
        appState.partnerUser = {
          name: appState.currentUser.fullname,
          avatar: teacherData ? teacherData.avatar : '👳‍♂️',
          wallet: appState.currentUser.balance,
          online: savedPartner.online || false,
          earningsToday: 0.0,
          earningsWeek: 0.0,
          completedJobs: 0,
          role: 'partner'
        };

        document.getElementById('partner-name').textContent = appState.partnerUser.name;
        document.getElementById('partner-avatar').textContent = appState.partnerUser.avatar;
        document.getElementById('mode-switch-toggle').classList.add('active');
        
        if (appState.partnerUser.online) {
          const toggleBtn = document.getElementById('partner-status-toggle');
          const statusLbl = document.getElementById('partner-online-status-lbl');
          if (toggleBtn) toggleBtn.classList.add('active');
          if (statusLbl) {
            statusLbl.textContent = 'Dalam Talian (Online)';
            statusLbl.className = 'partner-status-status online';
          }
        }

        navigateToPartnerDashboard();
        startPollingActiveBookings();
      } else {
        appState.partnerUser = defaultPartner;
        document.getElementById('app-bottom-nav').style.display = 'flex';
        updateUIWalletBalances();
        renderFeaturedTeachers();
        populateBookingSelect();
        renderHistoryList();

        if (appState.currentBooking) {
          recoverActiveBooking();
        } else {
          navigateTo('home-view');
        }
        startPollingActiveBookings();
      }
    } catch (e) {
      console.error('Error recovering user session:', e);
      logoutUser();
    }
  } else {
    // Hide bottom nav and go to auth screen
    document.getElementById('app-bottom-nav').style.display = 'none';
    navigateTo('auth-view');
  }
}

// ----------------------------------------------------
// Authentication Helpers & Forms
// ----------------------------------------------------
function switchAuthTab(tabName) {
  const tabLogin = document.getElementById('tab-login');
  const tabRegister = document.getElementById('tab-register');
  const formLogin = document.getElementById('form-login');
  const formRegister = document.getElementById('form-register');
  
  if (tabName === 'login') {
    tabLogin.classList.add('active');
    tabRegister.classList.remove('active');
    formLogin.style.display = 'block';
    formRegister.style.display = 'none';
  } else {
    tabLogin.classList.remove('active');
    tabRegister.classList.add('active');
    formLogin.style.display = 'none';
    formRegister.style.display = 'block';
  }
}

function switchRegisterRole(roleName) {
  const roleUser = document.getElementById('role-user');
  const rolePartner = document.getElementById('role-partner');
  const teacherFields = document.getElementById('teacher-reg-fields');
  
  if (roleName === 'user') {
    roleUser.classList.add('active');
    rolePartner.classList.remove('active');
    teacherFields.style.display = 'none';
    const radio = roleUser.querySelector('input[type="radio"]');
    if (radio) radio.checked = true;
  } else {
    roleUser.classList.remove('active');
    rolePartner.classList.add('active');
    teacherFields.style.display = 'block';
    const radio = rolePartner.querySelector('input[type="radio"]');
    if (radio) radio.checked = true;
  }
}

async function loadDatabaseData() {
  try {
    const resTeachers = await fetch('/api/teachers');
    if (resTeachers.ok) {
      appState.teachersList = await resTeachers.json();
    } else {
      throw new Error('Failed to load teachers');
    }

    const resReviews = await fetch('/api/reviews');
    if (resReviews.ok) {
      appState.reviewsList = await resReviews.json();
    } else {
      throw new Error('Failed to load reviews');
    }

    if (appState.currentUser) {
      let url = `/api/bookings?userId=${appState.currentUser.id}`;
      if (appState.currentUser.role === 'partner' && appState.currentUser.teacher_id) {
        url = `/api/bookings?teacherId=${appState.currentUser.teacher_id}`;
      }
      const resBookings = await fetch(url);
      if (resBookings.ok) {
        const bookings = await resBookings.json();
        appState.historyList = bookings.filter(b => b.status === 'completed' || b.status === 'cancelled').map(b => {
          const service = initialServices.find(s => s.id === b.serviceId) || { name: 'Kelas Agama' };
          const teacher = appState.teachersList.find(t => t.id === b.teacherId);
          // If partner, the teacher earned 90%
          const finalPrice = (appState.currentUser.role === 'partner' && appState.currentUser.teacher_id === b.teacherId) ? (b.totalPrice * 0.9) : b.totalPrice;
          return {
            id: b.id,
            serviceId: b.serviceId,
            serviceName: service.name,
            teacherName: teacher ? teacher.name : 'Ustaz / Ustazah',
            clientName: b.clientName || 'Pelajar',
            datetime: b.date + 'T' + b.time,
            duration: b.duration + ' Jam',
            price: finalPrice,
            status: b.status,
            rated: false
          };
        });
        DB.set('history_list', appState.historyList);
        if (typeof renderHistoryList === 'function') {
          renderHistoryList();
        }
      }
    }
  } catch (e) {
    console.warn('API error, falling back to static local data.js. Error:', e);
    appState.teachersList = initialUstazList.map(t => ({
      ...t,
      verified: t.verified === 1
    }));
    appState.reviewsList = initialReviews;
  }
}

async function handleLogin(event) {
  event.preventDefault();
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;

  if (!username || !password) {
    showToast('Sila masukkan nama pengguna dan kata laluan.', false);
    return;
  }

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await res.json();
    if (!data.success) {
      showToast(data.message || 'Gagal untuk log masuk.', false);
      return;
    }

    appState.currentUser = data.user;
    localStorage.setItem('agamaku_user', JSON.stringify(data.user));
    
    await loadDatabaseData();
    
    document.getElementById('home-user-name').textContent = appState.currentUser.fullname;
    updateUserProfileUI();
    
    if (appState.currentUser.role === 'partner') {
      const savedPartner = DB.get('profile_partner', {});
      const teacherData = appState.teachersList.find(t => t.id === appState.currentUser.teacher_id);
      appState.partnerUser = {
        name: appState.currentUser.fullname,
        avatar: teacherData ? teacherData.avatar : '👳‍♂️',
        wallet: appState.currentUser.balance,
        online: savedPartner.online || false,
        earningsToday: 0.0,
        earningsWeek: 0.0,
        completedJobs: 0,
        role: 'partner'
      };
      
      document.getElementById('partner-name').textContent = appState.partnerUser.name;
      document.getElementById('partner-avatar').textContent = appState.partnerUser.avatar;
      
      if (appState.partnerUser.online) {
        const toggleBtn = document.getElementById('partner-status-toggle');
        const statusLbl = document.getElementById('partner-online-status-lbl');
        if (toggleBtn) toggleBtn.classList.add('active');
        if (statusLbl) {
          statusLbl.textContent = 'Dalam Talian (Online)';
          statusLbl.className = 'partner-status-status online';
        }
      }
      
      navigateToPartnerDashboard();
      startPollingActiveBookings();
    } else {
      appState.partnerUser = defaultPartner;
      document.getElementById('app-bottom-nav').style.display = 'flex';
      updateUIWalletBalances();
      renderFeaturedTeachers();
      populateBookingSelect();
      renderHistoryList();
      
      if (appState.currentBooking) {
        recoverActiveBooking();
      } else {
        navigateTo('home-view');
      }
      startPollingActiveBookings();
    }

    showToast(`Selamat datang, ${appState.currentUser.fullname}!`, true);
    playSuccessChime();
    
    document.getElementById('login-username').value = '';
    document.getElementById('login-password').value = '';
    
  } catch (err) {
    console.error(err);
    showToast('Ralat sambungan pelayan. Sila cuba lagi.', false);
  }
}

async function handleRegister(event) {
  event.preventDefault();
  const fullname = document.getElementById('reg-fullname').value.trim();
  const username = document.getElementById('reg-username').value.trim();
  const password = document.getElementById('reg-password').value;
  const role = document.querySelector('input[name="reg-role"]:checked') ? document.querySelector('input[name="reg-role"]:checked').value : 'user';
  const gender = document.querySelector('input[name="reg-gender"]:checked') ? document.querySelector('input[name="reg-gender"]:checked').value : 'L';

  if (!fullname || !username || !password) {
    showToast('Sila isikan semua maklumat wajib.', false);
    return;
  }

  const payload = {
    fullname,
    username,
    password,
    role,
    gender
  };

  if (role === 'partner') {
    const specialtiesList = Array.from(document.querySelectorAll('input[name="reg-specialties"]:checked')).map(el => el.value);
    payload.specialties = specialtiesList.join(',');
    payload.hourlyRate = parseFloat(document.getElementById('reg-rate').value) || 35.0;
    payload.phone = document.getElementById('reg-phone').value.trim();
    payload.bio = document.getElementById('reg-bio').value.trim();
  }

  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!data.success) {
      showToast(data.message || 'Gagal mendaftar akaun.', false);
      return;
    }

    showToast('Pendaftaran berjaya! Sila log masuk dengan akaun anda.', true);
    playSuccessChime();
    
    document.getElementById('reg-fullname').value = '';
    document.getElementById('reg-username').value = '';
    document.getElementById('reg-password').value = '';
    if (role === 'partner') {
      document.getElementById('reg-rate').value = '35';
      document.getElementById('reg-phone').value = '+60 12-345 6789';
      document.getElementById('reg-bio').value = '';
    }

    switchAuthTab('login');
    document.getElementById('login-username').value = username;
    document.getElementById('login-password').focus();
    
  } catch (err) {
    console.error(err);
    showToast('Ralat sambungan pelayan. Sila cuba lagi.', false);
  }
}

function logoutUser() {
  localStorage.removeItem('agamaku_user');
  DB.set('profile_user', null);
  
  if (appState.pollingInterval) {
    clearInterval(appState.pollingInterval);
    appState.pollingInterval = null;
  }
  
  appState.currentUser = null;
  appState.currentBooking = null;
  DB.set('active_booking', null);
  
  stopJobAlarmLoop();
  if (appState.partnerOnlineTimeout) {
    clearTimeout(appState.partnerOnlineTimeout);
    appState.partnerOnlineTimeout = null;
  }
  
  document.getElementById('app-bottom-nav').style.display = 'none';
  
  showToast('Anda telah log keluar.', true);
  navigateTo('auth-view');
}

async function deleteUserAccount() {
  if (confirm('Adakah anda pasti mahu memadam akaun anda secara kekal? Tindakan ini tidak boleh diundur.')) {
    try {
      const res = await fetch(`/api/users/${appState.currentUser.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        showToast('Akaun anda telah berjaya dipadam secara kekal.', true);
        
        // Clear everything locally
        localStorage.removeItem('agamaku_user');
        DB.set('profile_user', null);
        if (appState.pollingInterval) clearInterval(appState.pollingInterval);
        appState.pollingInterval = null;
        appState.currentUser = null;
        appState.currentBooking = null;
        DB.set('active_booking', null);
        stopJobAlarmLoop();
        
        document.getElementById('app-bottom-nav').style.display = 'none';
        navigateTo('auth-view');
      } else {
        showToast(data.message || 'Ralat memadam akaun.', false);
      }
    } catch (e) {
      console.error(e);
      showToast('Ralat rangkaian semasa memadam akaun.', false);
    }
  }
};

function startPollingActiveBookings() {
  if (appState.pollingInterval) clearInterval(appState.pollingInterval);
  
  appState.pollingInterval = setInterval(async () => {
    if (!appState.currentUser) return;
    
    // A. Partner Mode: listen for incoming jobs or updates to current jobs
    if (appState.currentUser.role === 'partner') {
      if (appState.partnerUser.online) {
        // 1. If we don't have an active booking or it is still searching, check for new 'searching' requests
        if (!appState.currentBooking || appState.currentBooking.status === 'searching') {
          try {
            const res = await fetch(`/api/bookings?teacherId=${appState.currentUser.teacher_id}`);
            if (res.ok) {
              const bookings = await res.json();
              const searchingBooking = bookings.find(b => b.status === 'searching');
              if (searchingBooking) {
                appState.currentBooking = mapDatabaseBookingToAppState(searchingBooking);
                DB.set('active_booking', appState.currentBooking);
                if (!document.getElementById('job-alarm-modal').classList.contains('visible')) {
                  triggerPartnerIncomingJobPing();
                }
              }
            }
          } catch (err) {
            console.error('Error polling partner bookings:', err);
          }
        }
      }
      
      // 2. If we have an active class booking, sync its status
      if (appState.currentBooking) {
        try {
          const res = await fetch(`/api/bookings?teacherId=${appState.currentUser.teacher_id}`);
          if (res.ok) {
            const bookings = await res.json();
            const currentDbBooking = bookings.find(b => b.id === appState.currentBooking.id);
            
            if (currentDbBooking) {
              // Check for chat updates
              if (currentDbBooking.chatHistory) {
                try {
                  const dbChat = JSON.parse(currentDbBooking.chatHistory);
                  if (dbChat.length > appState.currentBooking.chatHistory.length) {
                    appState.currentBooking.chatHistory = dbChat;
                    DB.set('active_booking', appState.currentBooking);
                    if (appState.activeView === 'chat-view') {
                      renderChatHistory();
                    } else {
                      showToast('Mesej baru dari pelajar!', true);
                      playAudioTone(783.99, 'triangle', 200);
                    }
                  }
                } catch (e) {}
              }

              if (currentDbBooking.status !== appState.currentBooking.status) {
              const newStatus = currentDbBooking.status;
              appState.currentBooking = mapDatabaseBookingToAppState(currentDbBooking);
              DB.set('active_booking', appState.currentBooking);

              if (newStatus === 'cancelled') {
                showToast('Pelajar telah membatalkan tempahan.', false);
                appState.currentBooking = null;
                DB.set('active_booking', null);
                navigateTo('partner-home-view');
              } else if (newStatus === 'arrived') {
                showToast('Status: Telah Tiba di Lokasi', true);
                updateJourneyUIStates();
              } else if (newStatus === 'started') {
                showToast('Status: Sesi kelas dimulakan!', true);
                updateJourneyUIStates();
              } else if (newStatus === 'completed') {
                const newHistoryItem = {
                  id: appState.currentBooking.id,
                  serviceId: appState.currentBooking.serviceId,
                  serviceName: appState.currentBooking.serviceName,
                  teacherName: 'Anda',
                  clientName: appState.currentBooking.clientName || 'Pelajar',
                  datetime: appState.currentBooking.datetime,
                  duration: appState.currentBooking.hours,
                  price: appState.currentBooking.price * 0.9,
                  status: 'completed',
                  rated: false
                };
                appState.historyList.unshift(newHistoryItem);
                DB.set('history_list', appState.historyList);
                renderHistoryList();
                
                // Fetch the latest wallet balance from DB
                const userRes = await fetch('/api/auth/login', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ username: appState.currentUser.username, password: 'simulated_dummy_for_wallet_sync_skip' })
                });
                
                // We'll just rely on a manual balance fetch or let the user refresh, but for now we can fetch the user directly
                // Wait, we can't easily fetch just the user without their password via API unless we create a /api/users/me endpoint.
                // Let's just update the local balance optimistically
                appState.currentUser.balance += (appState.currentBooking.price * 0.9);
                appState.partnerUser.wallet = appState.currentUser.balance;
                localStorage.setItem('agamaku_user', JSON.stringify(appState.currentUser));
                DB.set('profile_partner', appState.partnerUser);
                updateUIWalletBalances();
                
                appState.currentBooking = null;
                DB.set('active_booking', null);
                showToast('Kelas selesai! Bayaran dimasukkan ke dompet anda.', true);
                playSuccessChime();
                navigateTo('partner-home-view');
              }
            }
          }
        }
      } catch (err) {
        console.error('Error syncing active partner booking:', err);
      }
    }
    }
    
    // B. Student Mode: listen for updates on active bookings (searching, accepted, arrived, started, completed)
    if (appState.currentUser.role === 'user' && appState.currentBooking) {
      try {
        const res = await fetch(`/api/bookings?userId=${appState.currentUser.id}`);
        if (res.ok) {
          const bookings = await res.json();
          const currentDbBooking = bookings.find(b => b.id === appState.currentBooking.id);
          
          if (currentDbBooking) {
            // Check for chat updates
            if (currentDbBooking.chatHistory) {
              try {
                const dbChat = JSON.parse(currentDbBooking.chatHistory);
                if (dbChat.length > appState.currentBooking.chatHistory.length) {
                  appState.currentBooking.chatHistory = dbChat;
                  DB.set('active_booking', appState.currentBooking);
                  if (appState.activeView === 'chat-view') {
                    renderChatHistory();
                  } else {
                    showToast('Mesej baru dari Ustaz!', true);
                    playAudioTone(783.99, 'triangle', 200);
                  }
                }
              } catch (e) {}
            }

            if (currentDbBooking.status !== appState.currentBooking.status) {
              const oldStatus = appState.currentBooking.status;
              const newStatus = currentDbBooking.status;
              
              // Map the fresh db booking details
              appState.currentBooking = mapDatabaseBookingToAppState(currentDbBooking);
              DB.set('active_booking', appState.currentBooking);
              
              if (newStatus === 'accepted' && oldStatus === 'searching') {
                playSuccessChime();
                showToast(`Berjaya dipadankan dengan ${appState.currentBooking.teacher.name}!`);
                navigateTo('active-job-view');
                startAutomaticTeacherMovement();
              } else if (newStatus === 'arrived') {
                playSuccessChime();
                showToast('Ustaz telah sampai di alamat anda!', true);
                updateJourneyUIStates();
              } else if (newStatus === 'started') {
                showToast('Sesi kelas dimulakan!', true);
                updateJourneyUIStates();
              } else if (newStatus === 'completed') {
                // STUDENT COMPLETION FLOW (Student reviews Ustaz)
                const newHistoryItem = {
                  id: appState.currentBooking.id,
                  serviceId: appState.currentBooking.serviceId,
                  serviceName: appState.currentBooking.serviceName,
                  teacherName: appState.currentBooking.teacher ? appState.currentBooking.teacher.name : 'Ustaz / Ustazah',
                  teacherId: appState.currentBooking.teacherId || (appState.currentBooking.teacher ? appState.currentBooking.teacher.id : ''),
                  datetime: appState.currentBooking.datetime,
                  duration: appState.currentBooking.hours,
                  price: appState.currentBooking.price,
                  status: 'completed',
                  rated: false
                };
                appState.historyList.unshift(newHistoryItem);
                DB.set('history_list', appState.historyList);
                renderHistoryList();
                updateUIWalletBalances();

                // Setup review view fields
                document.getElementById('review-teacher-avatar').textContent = appState.currentBooking.teacher ? appState.currentBooking.teacher.avatar : '🧕';
                document.getElementById('review-teacher-name').textContent = appState.currentBooking.teacher ? appState.currentBooking.teacher.name : 'Ustaz / Ustazah';
                document.getElementById('review-service-desc').textContent = `Sesi ${appState.currentBooking.serviceName} Selesai`;
                document.getElementById('review-comment').value = '';
                appState.activeRating = 5;
                rateSession(5);

                // Remove active booking
                appState.currentBooking = null;
                DB.set('active_booking', null);

                showToast('Kelas selesai! Terima kasih.', true);
                playSuccessChime();
                navigateTo('review-view');
              } else if (newStatus === 'cancelled') {
                showToast('Tempahan telah dibatalkan oleh Ustaz.', false);
                appState.currentBooking = null;
                DB.set('active_booking', null);
                navigateTo('home-view');
              }
            }
          }
        }
      } catch (err) {
        console.error('Error polling student bookings:', err);
      }
    }
  }, 2000);
}

function mapDatabaseBookingToAppState(dbBooking) {
  const teacher = appState.teachersList.find(t => t.id === dbBooking.teacherId);
  const service = initialServices.find(s => s.id === dbBooking.serviceId) || { name: 'Kelas Agama', icon: '🕌' };
  let chatArray = [];
  if (dbBooking.chatHistory) {
    try {
      const parsed = JSON.parse(dbBooking.chatHistory);
      if (Array.isArray(parsed) && parsed.length > 0) {
        chatArray = parsed;
      }
    } catch (e) {}
  }

  return {
    id: dbBooking.id,
    serviceId: dbBooking.serviceId,
    serviceName: service.name,
    icon: service.icon,
    price: dbBooking.totalPrice,
    hours: dbBooking.duration + ' Jam',
    datetime: dbBooking.date + 'T' + dbBooking.time,
    address: 'Destinasi Pelajar',
    notes: 'Pembelajaran peribadi AgamaKu.',
    teacher: teacher,
    status: dbBooking.status,
    clientName: dbBooking.clientName || 'Sarah Amira',
    chatHistory: chatArray
  };
}

// ----------------------------------------------------
// UI Renderers & Helpers
// ----------------------------------------------------

function updateUIWalletBalances() {
  if (!appState.currentUser) return;
  // User mode wallet bindings
  const balance = appState.currentUser.balance !== undefined ? appState.currentUser.balance : (appState.currentUser.wallet || 0);
  
  document.getElementById('home-wallet-amount').textContent = `RM ${balance.toFixed(2)}`;
  document.getElementById('wallet-balance-total').textContent = `RM ${balance.toFixed(2)}`;
  
  // Partner mode wallet bindings
  if (appState.partnerUser) {
    const partnerBalance = appState.partnerUser.wallet !== undefined ? appState.partnerUser.wallet : 0;
    document.getElementById('partner-wallet-amount').textContent = `RM ${partnerBalance.toFixed(2)}`;
    document.getElementById('partner-stats-today').textContent = `RM ${appState.partnerUser.earningsToday.toFixed(2)}`;
    document.getElementById('partner-stats-week').textContent = `RM ${appState.partnerUser.earningsWeek.toFixed(2)}`;
    
    // Update reviews and ratings in the dashboard
    if (appState.currentUser && appState.currentUser.teacher_id) {
      const myTeacher = appState.teachersList.find(t => t.id === appState.currentUser.teacher_id);
      if (myTeacher) {
        document.getElementById('partner-rating-val').textContent = `⭐ ${myTeacher.rating.toFixed(1)}`;
        document.getElementById('partner-tier-val').textContent = `${myTeacher.reviewsCount || 0}`;
      }
    }
  }
}

function renderFeaturedTeachers() {
  const container = document.getElementById('featured-teachers-container');
  container.innerHTML = '';

  const userLoc = appState.userLocation || DEFAULT_USER_LOCATION;

  // Calculate distances and sort
  const teachersWithDistance = appState.teachersList.map(t => {
    let dist = 0;
    if (t.coordinates && t.coordinates.lat) {
      dist = calculateDistanceKm(userLoc.lat, userLoc.lng, t.coordinates.lat, t.coordinates.lng);
    }
    return { ...t, distance: dist };
  }).sort((a, b) => a.distance - b.distance);

  // Draw first 3 closest teachers
  teachersWithDistance.slice(0, 3).forEach(teacher => {
    const specialtiesText = teacher.specialties.map(specId => {
      const spec = initialServices.find(s => s.id === specId);
      return `<span class="specialty-tag">${spec ? spec.name.split(' ')[0] : specId}</span>`;
    }).join(' ');

    const verifiedBadge = teacher.verified ? `<i class="ri-verified-badge-fill" style="color:var(--color-primary-light); font-size:14px; margin-left:4px;"></i>` : '';
    const distanceBadge = `<span style="font-size:11px; background:rgba(16,185,129,0.15); color:var(--color-primary-light); padding:2px 6px; border-radius:4px; margin-left:auto;"><i class="ri-map-pin-2-fill"></i> ${teacher.distance.toFixed(1)} km</span>`;

    const card = document.createElement('div');
    card.className = 'teacher-item-card';
    card.onclick = () => openTeacherProfile(teacher.id, 'home-view');
    card.innerHTML = `
      <div class="teacher-item-avatar">${teacher.avatar}</div>
      <div class="teacher-item-details">
        <div class="teacher-item-name-row" style="display:flex; align-items:center; width:100%;">
          <span class="teacher-item-name">${teacher.name}${verifiedBadge}</span>
          ${distanceBadge}
        </div>
        <div class="teacher-item-specialties">
          ${specialtiesText}
        </div>
        <div class="teacher-item-rate">RM ${teacher.hourlyRate.toFixed(2)}<span>/jam</span> &nbsp;·&nbsp; ⭐ ${teacher.rating.toFixed(1)}</div>
      </div>
    `;
    container.appendChild(card);
  });
}

function populateBookingSelect() {
  const select = document.getElementById('booking-service-select');
  select.innerHTML = '';
  initialServices.forEach(service => {
    const opt = document.createElement('option');
    opt.value = service.id;
    opt.textContent = `${service.icon} ${service.name} (RM ${service.pricePerHour}/jam)`;
    select.appendChild(opt);
  });
}

function navigateTo(viewId) {
  // Clear any temporary states if changing primary views
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const targetView = document.getElementById(viewId);
  if (targetView) {
    targetView.classList.add('active');
    appState.activeView = viewId;
  }

  // Handle bottom navigation active state highlighting
  document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
  if (viewId === 'home-view' || viewId === 'partner-home-view') {
    document.getElementById('nav-home').classList.add('active');
  } else if (viewId === 'history-view') {
    document.getElementById('nav-history').classList.add('active');
  } else if (viewId === 'chat-view') {
    document.getElementById('nav-chat').classList.add('active');
  } else if (viewId === 'profile-view') {
    document.getElementById('nav-profile').classList.add('active');
  }

  // Redraw map canvas if entering live journey tracking
  if (viewId === 'active-job-view' && appState.currentBooking) {
    setTimeout(() => {
      initJourneyMap();
    }, 100);
  }
}

// Custom Toast notification system
function showToast(message, isSuccess = true) {
  const toast = document.getElementById('app-toast');
  const toastMsg = document.getElementById('toast-message');
  const toastIcon = document.getElementById('toast-icon');

  toastMsg.textContent = message;
  if (isSuccess) {
    toastIcon.className = 'ri-checkbox-circle-fill toast-icon';
    toastIcon.style.color = 'var(--color-primary)';
  } else {
    toastIcon.className = 'ri-error-warning-fill toast-icon';
    toastIcon.style.color = '#ef4444';
  }

  toast.classList.add('visible');
  setTimeout(() => {
    toast.classList.remove('visible');
  }, 3500);
}

// ----------------------------------------------------
// Synthesis Audio Engine (Using Web Audio API)
// ----------------------------------------------------
function playAudioTone(freq, type, durationMs) {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.type = type;
    oscillator.frequency.value = freq;

    gainNode.gain.setValueAtTime(0.15, audioCtx.currentTime);
    // Smooth ramp down
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + durationMs / 1000);

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.start();
    setTimeout(() => {
      oscillator.stop();
      audioCtx.close();
    }, durationMs);
  } catch (e) {
    console.warn('Web Audio API not supported or blocked by user guest settings');
  }
}

function playSuccessChime() {
  playAudioTone(523.25, 'triangle', 250); // C5
  setTimeout(() => playAudioTone(659.25, 'triangle', 250), 120); // E5
  setTimeout(() => playAudioTone(783.99, 'triangle', 250), 240); // G5
  setTimeout(() => playAudioTone(1046.50, 'triangle', 400), 360); // C6
}

function startJobAlarmLoop() {
  if (appState.soundInterval) clearInterval(appState.soundInterval);
  const ringSound = () => {
    playAudioTone(880, 'sine', 150); // High pitch beep
    setTimeout(() => playAudioTone(660, 'sine', 150), 150); // Low pitch beep
  };
  ringSound();
  appState.soundInterval = setInterval(ringSound, 1000);
}

function stopJobAlarmLoop() {
  if (appState.soundInterval) {
    clearInterval(appState.soundInterval);
    appState.soundInterval = null;
  }
}

// ----------------------------------------------------
// User Booking Operations
// ----------------------------------------------------
function openBooking(serviceId) {
  const select = document.getElementById('booking-service-select');
  select.value = serviceId;
  
  // Set default time to 30 mins from now
  const now = new Date();
  now.setMinutes(now.getMinutes() + 30);
  // format: YYYY-MM-DDTHH:MM
  const tzoffset = (new Date()).getTimezoneOffset() * 60000; //offset in milliseconds
  const localISOTime = (new Date(now - tzoffset)).toISOString().slice(0, 16);
  document.getElementById('booking-datetime').value = localISOTime;

  // Handle selected locked teacher banner and gender pref row visibility
  const lockedBanner = document.getElementById('booking-locked-teacher');
  const genderGroup = document.getElementById('booking-gender-toggle').parentElement;

  if (appState.selectedTeacher) {
    document.getElementById('locked-teacher-name').textContent = appState.selectedTeacher.name;
    document.getElementById('locked-teacher-avatar').textContent = appState.selectedTeacher.avatar;
    lockedBanner.style.display = 'flex';
    genderGroup.style.display = 'none';
  } else {
    lockedBanner.style.display = 'none';
    genderGroup.style.display = 'block';
  }

  calculateBookingPrice();
  navigateTo('booking-view');
}

function selectDuration(element) {
  document.querySelectorAll('#booking-duration-toggle .toggle-option').forEach(el => el.classList.remove('active'));
  element.classList.add('active');
  calculateBookingPrice();
}

function selectGenderPref(element) {
  document.querySelectorAll('#booking-gender-toggle .toggle-option').forEach(el => el.classList.remove('active'));
  element.classList.add('active');
}

function calculateBookingPrice() {
  const select = document.getElementById('booking-service-select');
  const serviceId = select.value;
  const service = initialServices.find(s => s.id === serviceId);
  if (!service) return 0;

  const durationActive = document.querySelector('#booking-duration-toggle .toggle-option.active');
  const hours = durationActive ? parseFloat(durationActive.getAttribute('data-hours')) : 1;
  
  let ratePerHour = service.pricePerHour;
  if (appState.selectedTeacher) {
    ratePerHour = appState.selectedTeacher.hourlyRate;
  }
  
  const price = ratePerHour * hours;

  document.getElementById('booking-estimated-price').textContent = `RM ${price.toFixed(2)}`;
  return price;
}

async function startBookingSearch() {
  const select = document.getElementById('booking-service-select');
  const serviceId = select.value;
  const service = initialServices.find(s => s.id === serviceId);
  
  const datetime = document.getElementById('booking-datetime').value;
  const durationActive = document.querySelector('#booking-duration-toggle .toggle-option.active');
  const hours = parseFloat(durationActive.getAttribute('data-hours'));
  const genderPref = document.querySelector('#booking-gender-toggle .toggle-option.active').getAttribute('data-gender');
  const address = document.getElementById('booking-address').value;
  const notes = document.getElementById('booking-notes').value;

  const price = calculateBookingPrice();

  if (!datetime) {
    showToast('Sila tetapkan tarikh dan masa kelas', false);
    return;
  }

  // Verify wallet balance
  const balance = appState.currentUser.balance !== undefined ? appState.currentUser.balance : (appState.currentUser.wallet || 0);
  if (balance < price) {
    showToast('Baki AgamaKu Pay tidak mencukupi. Sila tambah nilai dompet.', false);
    setTimeout(() => {
      navigateTo('wallet-view');
    }, 1500);
    return;
  }

  // Pick matched teacher
  let matchedTeacher = null;
  if (appState.selectedTeacher) {
    matchedTeacher = appState.selectedTeacher;
  } else {
    // Find teacher matching gender preference
    const candidates = appState.teachersList.filter(t => {
      if (genderPref !== 'any' && t.gender !== (genderPref === 'P' ? 'ustazah' : 'ustaz')) return false;
      return t.specialties.includes(serviceId);
    });

    if (candidates.length > 0) {
      matchedTeacher = candidates[Math.floor(Math.random() * candidates.length)];
    } else {
      matchedTeacher = appState.teachersList[0];
    }
  }

  // Setup Search State UI
  document.getElementById('matching-status-title').textContent = 'Mencari Ustaz...';
  document.getElementById('radar-icon').textContent = service.icon;
  navigateTo('matching-view');

  const dateParts = datetime.split('T');
  const date = dateParts[0];
  const time = dateParts[1] || '00:00';

  // Make the API call to create the booking in SQLite
  try {
    const res = await fetch('/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: appState.currentUser.id,
        teacherId: matchedTeacher.id,
        serviceId: serviceId,
        date: date,
        time: time,
        duration: hours,
        totalPrice: price
      })
    });

    const data = await res.json();
    if (!data.success) {
      showToast(data.message || 'Gagal menghantar tempahan.', false);
      navigateTo('booking-view');
      return;
    }

    // Set active booking in student appState
    appState.currentBooking = mapDatabaseBookingToAppState(data.booking);
    DB.set('active_booking', appState.currentBooking);

    // Reload database teachers list to get the latest online statuses
    try {
      await loadDatabaseData();
    } catch (e) {
      console.warn('Error loading latest database data in search:', e);
    }

    const latestTeacherInfo = appState.teachersList.find(t => t.id === matchedTeacher.id);
    const isTeacherOnline = latestTeacherInfo && latestTeacherInfo.online;
    const isMyOwnTeacherProfile = appState.currentUser && appState.currentUser.teacher_id === matchedTeacher.id;

    if (isMyOwnTeacherProfile) {
      if (appState.partnerUser && appState.partnerUser.online) {
        showToast('Tugasan dihantar! Tukar ke Mod Ustaz untuk terima tempahan ini!', true);
      } else {
        showToast('Peringatan: Anda sedang luar talian. Tukar ke Mod Ustaz dan Pergi Online untuk terima!', false);
      }
    } else if (!isTeacherOnline) {
      showToast(`Peringatan: ${matchedTeacher.name} sedang luar talian. (Sila ke profil ustaz yang online)`, false);
    } else {
      showToast(`Tugasan dihantar! Menunggu ${matchedTeacher.name} menerima tempahan anda...`, true);
    }

  } catch (err) {
    console.error(err);
    showToast('Ralat sambungan pelayan.', false);
    navigateTo('booking-view');
  }
}

async function cancelBookingSearch() {
  if (appState.matchTimeout) {
    clearTimeout(appState.matchTimeout);
    appState.matchTimeout = null;
  }
  
  if (appState.currentBooking) {
    try {
      await fetch('/api/bookings/update-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: appState.currentBooking.id,
          status: 'cancelled'
        })
      });
    } catch (err) {
      console.error('Error cancelling booking:', err);
    }
  }

  appState.currentBooking = null;
  DB.set('active_booking', null);
  showToast('Carian kelas dibatalkan.');
  navigateTo('home-view');
}

// ----------------------------------------------------
// Active Journey Tracking Simulation (User Mode)
// ----------------------------------------------------
function initJourneyMap() {
  if (!appState.currentBooking || !appState.currentBooking.teacher) return;
  const teacher = appState.currentBooking.teacher;

  // Initialize leaflet map
  const userLoc = appState.userLocation || DEFAULT_USER_LOCATION;
  const map = new AgamaKuMap('mapContainer', userLoc);
  appState.activeMap = map;

  // Safely extract coordinates, falling back to x/y mapping or default KL coordinates if undefined
  let lat = teacher.coordinates ? teacher.coordinates.lat : undefined;
  let lng = teacher.coordinates ? teacher.coordinates.lng : undefined;
  if (lat === undefined && teacher.coordinates && teacher.coordinates.x !== undefined) {
    lat = 3.1 + (teacher.coordinates.y * 0.1);
    lng = 101.6 + (teacher.coordinates.x * 0.2);
  }
  if (lat === undefined) {
    lat = 3.1340;
    lng = 101.6866;
  }

  // Set initial coordinates of matched teacher
  try {
    map.setUstaz({
      lat: lat,
      lng: lng,
      avatar: teacher.avatar,
      name: teacher.name
    });
  } catch (e) {
    console.error("Leaflet marker initialization error safely caught.", e);
  }
  
  // Bind floating details values (safeguarded so it always runs)
  document.getElementById('active-job-teacher-name').textContent = teacher.name;
  document.getElementById('active-job-teacher-avatar').textContent = teacher.avatar;
  document.getElementById('active-job-teacher-phone').textContent = teacher.phone;
  document.getElementById('active-job-header-title').textContent = appState.currentBooking.serviceName;

  updateJourneyUIStates();
}

function updateJourneyUIStates() {
  const booking = appState.currentBooking;
  const badge = document.getElementById('active-job-status-badge');
  const eta = document.getElementById('active-job-eta');
  const skipBtn = document.getElementById('simulation-skip-btn');
  const timerBox = document.getElementById('class-timer-box');
  const isPartner = appState.currentUser.role === 'partner';

  if (booking.status === 'accepted') {
    badge.innerHTML = isPartner ? '<i class="ri-navigation-line"></i> Anda Sedang Menavigasi Ke Lokasi Pelajar' : '<i class="ri-focus-3-line"></i> Sedang Menuju Ke Alamat';
    badge.className = 'status-badge-live';
    eta.style.display = 'block';
    skipBtn.style.display = 'flex';
    skipBtn.textContent = isPartner ? 'Skip Perjalanan (Driver)' : 'Lajukan Perjalanan';
    timerBox.style.display = 'none';
  } else if (booking.status === 'arrived') {
    badge.innerHTML = isPartner ? '<i class="ri-map-pin-user-fill"></i> Anda Telah Tiba di Lokasi' : '<i class="ri-map-pin-user-fill"></i> Ustaz Sudah Sampai!';
    badge.className = 'status-badge-live';
    badge.style.background = 'rgba(16,185,129,0.1)';
    badge.style.borderColor = 'rgba(16,185,129,0.3)';
    badge.style.color = 'var(--color-primary-light)';
    eta.style.display = 'none';
    skipBtn.style.display = 'flex';
    skipBtn.textContent = 'Mulakan Kelas';
    timerBox.style.display = 'none';
  } else if (booking.status === 'started') {
    badge.innerHTML = '<i class="ri-book-open-fill"></i> Sesi Kelas Berjalan';
    badge.className = 'status-badge-live';
    badge.style.background = 'rgba(16,185,129,0.1)';
    badge.style.borderColor = 'rgba(16,185,129,0.3)';
    badge.style.color = 'var(--color-primary-light)';
    eta.style.display = 'none';
    skipBtn.style.display = 'flex';
    skipBtn.textContent = 'Selesaikan Kelas';
    timerBox.style.display = 'flex';
    startClassDurationTimer();
  }
}

function startAutomaticTeacherMovement() {
  const booking = appState.currentBooking;
  if (!booking || booking.status !== 'accepted') return;

  // Animate over 12 seconds
  setTimeout(() => {
    if (!appState.activeMap || appState.activeView !== 'active-job-view') return;
    
    const startCoord = booking.teacher.coordinates;
    const endCoord = appState.userLocation || DEFAULT_USER_LOCATION;

    appState.activeMap.animateUstazJourney(
      startCoord, 
      endCoord, 
      12000, 
      (progress) => {
        // ETA Update
        const etaMins = Math.ceil((1 - progress) * 8);
        document.getElementById('active-job-eta').textContent = `ETA: ${etaMins} min`;
      }, 
      () => {
        // Arrival Trigger
        booking.status = 'arrived';
        DB.set('active_booking', booking);
        
        // Sync the updated chat history to server
        try {
          fetch('/api/bookings/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bookingId: booking.id, chatHistory: booking.chatHistory })
          });
        } catch (e) {}

        showToast('Ustaz telah sampai di alamat anda!', true);
        playSuccessChime();
        updateJourneyUIStates();
      }
    );
  }, 2000);
}

async function simulateActiveJobNextStep() {
  const booking = appState.currentBooking;
  if (!booking) return;

  const isPartner = appState.currentUser.role === 'partner';

  if (booking.status === 'accepted') {
    // Instantly teleport Ustaz to destination
    if (appState.activeMap) {
      appState.activeMap.stopSearching();
      const avatar = booking.teacher ? booking.teacher.avatar : '👨‍🏫';
      const name = booking.teacher ? booking.teacher.name : 'Anda';
      const userLoc = appState.userLocation || DEFAULT_USER_LOCATION;
      appState.activeMap.setUstaz({ lat: userLoc.lat, lng: userLoc.lng, avatar: avatar, name: name });
      // Force sync the DOM name in case it crashed earlier during initJourneyMap
      if (!isPartner) {
        const nameEl = document.getElementById('active-job-teacher-name');
        if (nameEl && booking.teacher) nameEl.textContent = booking.teacher.name;
      }
    }
    
    try {
      const res = await fetch('/api/bookings/update-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId: booking.id, status: 'arrived' })
      });
      const data = await res.json();
      if (data.success) {
        booking.status = 'arrived';
        DB.set('active_booking', booking);
        
        // Sync the automated chat message to server
        try {
          await fetch('/api/bookings/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bookingId: booking.id, chatHistory: booking.chatHistory })
          });
        } catch (e) {}

        if (isPartner) {
          showToast('Anda telah sampai di destinasi!', true);
        } else {
          showToast('Ustaz telah sampai di alamat anda!', true);
        }
        playSuccessChime();
        updateJourneyUIStates();
      }
    } catch (e) {
      console.error(e);
    }

  } else if (booking.status === 'arrived') {
    // Start class
    try {
      const res = await fetch('/api/bookings/update-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId: booking.id, status: 'started' })
      });
      const data = await res.json();
      if (data.success) {
        booking.status = 'started';
        DB.set('active_booking', booking);

        // Sync the automated chat message to server
        try {
          await fetch('/api/bookings/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bookingId: booking.id, chatHistory: booking.chatHistory })
          });
        } catch (e) {}

        showToast('Sesi kelas dimulakan!', true);
        updateJourneyUIStates();
      }
    } catch (e) {
      console.error(e);
    }

  } else if (booking.status === 'started') {
    // End class session and go to reviews / complete partner earnings
    stopClassDurationTimer();
    
    try {
      const res = await fetch('/api/bookings/update-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId: booking.id, status: 'completed' })
      });
      const data = await res.json();
      if (!data.success) {
        showToast(data.message || 'Gagal melengkapkan kelas.', false);
        return;
      }

      // Update current user balance from response
      if (data.user) {
        appState.currentUser.balance = data.user.balance;
        localStorage.setItem('agamaku_user', JSON.stringify(appState.currentUser));
      }

      // Reload database data (updates reviews & ratings list in real time!)
      await loadDatabaseData();

      if (isPartner) {
        const earnings = booking.price * 0.9; // 90% of price
        appState.partnerUser.wallet = appState.currentUser.balance;
        appState.partnerUser.earningsToday += earnings;
        appState.partnerUser.earningsWeek += earnings;
        appState.partnerUser.completedJobs += 1;
        
        // Save to history list
        const newHistoryItem = {
          id: booking.id,
          serviceId: booking.serviceId,
          serviceName: booking.serviceName,
          teacherName: 'Anda (Ustaz)',
          clientName: booking.clientName || 'Pelajar',
          datetime: booking.datetime,
          duration: booking.hours,
          price: earnings,
          status: 'completed',
          isPartnerEarning: true
        };
        appState.historyList.unshift(newHistoryItem);
        DB.set('history_list', appState.historyList);
        renderHistoryList();
        updateUIWalletBalances();

        // Clear active booking
        appState.currentBooking = null;
        DB.set('active_booking', null);

        showToast(`Kelas selesai! RM ${earnings.toFixed(2)} dikreditkan ke dompet anda.`, true);
        playSuccessChime();
        navigateTo('partner-home-view');
      } else {
        // STUDENT COMPLETION FLOW (Student reviews Ustaz)
        // Save to history list
        const newHistoryItem = {
          id: booking.id,
          serviceId: booking.serviceId,
          serviceName: booking.serviceName,
          teacherName: booking.teacher ? booking.teacher.name : 'Ustaz Ahmad',
          teacherId: booking.teacherId || (booking.teacher ? booking.teacher.id : ''),
          datetime: booking.datetime,
          duration: booking.hours,
          price: booking.price,
          status: 'completed',
          rated: false
        };
        appState.historyList.unshift(newHistoryItem);
        DB.set('history_list', appState.historyList);
        renderHistoryList();
        updateUIWalletBalances();

        // Setup review view fields
        document.getElementById('review-teacher-avatar').textContent = booking.teacher ? booking.teacher.avatar : '👳‍♂️';
        document.getElementById('review-teacher-name').textContent = booking.teacher ? booking.teacher.name : 'Ustaz Ahmad';
        document.getElementById('review-service-desc').textContent = `Sesi ${booking.serviceName} Selesai`;
        document.getElementById('review-comment').value = '';
        appState.activeRating = 5;
        rateSession(5);

        // Remove active booking
        appState.currentBooking = null;
        DB.set('active_booking', null);

        showToast('Kelas selesai! Terima kasih.', true);
        playSuccessChime();
        navigateTo('review-view');
      }
    } catch (e) {
      console.error(e);
      showToast('Ralat sambungan pelayan.', false);
    }
  }
}

function startClassDurationTimer() {
  let secCount = 0;
  const timerClock = document.getElementById('class-timer-clock');
  
  if (appState.classTimerInterval) clearInterval(appState.classTimerInterval);
  appState.classTimerInterval = setInterval(() => {
    secCount++;
    let h = Math.floor(secCount / 3600).toString().padStart(2, '0');
    let m = Math.floor((secCount % 3600) / 60).toString().padStart(2, '0');
    let s = (secCount % 60).toString().padStart(2, '0');
    timerClock.textContent = `${h}:${m}:${s}`;
  }, 1000);
}

function stopClassDurationTimer() {
  if (appState.classTimerInterval) {
    clearInterval(appState.classTimerInterval);
    appState.classTimerInterval = null;
  }
}

function recoverActiveBooking() {
  const booking = appState.currentBooking;
  if (!booking) return;

  if (booking.isDualSimulation) {
    // Dual simulation active.
    // If the booking is still pending acceptance, trigger incoming job screen in partner mode
    if (booking.status === 'matching') {
      navigateTo('home-view');
      triggerPartnerIncomingJobPing();
    } else {
      // User is tracking their partner job
      navigateTo('active-job-view');
    }
  } else {
    // Normal AI teacher session
    navigateTo('active-job-view');
    if (booking.status === 'accepted') {
      startAutomaticTeacherMovement();
    }
  }
}

// ----------------------------------------------------
// Chat & Messaging Room
// ----------------------------------------------------
function openChatRoom() {
  const booking = appState.currentBooking;
  if (!booking) {
    showToast('Tiada kelas aktif untuk dihubungi', false);
    return;
  }

  // Header configs
  if (booking.isDualSimulation) {
    // We are simulating user chatting to client
    document.getElementById('chat-teacher-name').textContent = appState.currentUser.role === 'partner' ? booking.clientName : 'Ustaz Zulkifli';
    document.getElementById('chat-teacher-avatar').textContent = appState.currentUser.role === 'partner' ? '🧑' : '👳‍♂️';
  } else {
    document.getElementById('chat-teacher-name').textContent = booking.teacher.name;
    document.getElementById('chat-teacher-avatar').textContent = booking.teacher.avatar;
  }

  renderChatHistory();
  navigateTo('chat-view');
}

function backFromChat() {
  if (appState.currentBooking) {
    navigateTo('active-job-view');
  } else {
    navigateTo('home-view');
  }
}

function renderChatHistory() {
  const container = document.getElementById('chat-messages-container');
  container.innerHTML = '';
  const booking = appState.currentBooking;
  if (!booking || !booking.chatHistory) return;

  booking.chatHistory.forEach(msg => {
    // Detemine bubble orientation based on role & sender
    const isSent = (appState.currentUser.role === 'user' && msg.sender === 'client') ||
                   (appState.currentUser.role === 'user' && msg.sender === 'user') ||
                   (appState.currentUser.role === 'partner' && msg.sender === 'teacher');
                   
    const bubbleWrapper = document.createElement('div');
    bubbleWrapper.className = `message-bubble-wrapper ${isSent ? 'sent' : 'received'}`;
    bubbleWrapper.innerHTML = `
      <div class="message-bubble">${msg.text}</div>
      <span class="message-time">${msg.time}</span>
    `;
    container.appendChild(bubbleWrapper);
  });
  
  // Auto scroll to bottom
  container.scrollTop = container.scrollHeight;
}

function sendSuggestionChat(text) {
  sendChatMessage(text);
}

function sendCustomChat() {
  const input = document.getElementById('chat-message-input');
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  sendChatMessage(text);
}

function sendChatMessage(text) {
  const booking = appState.currentBooking;
  if (!booking) return;

  const now = new Date();
  const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  
  // Determine sender tag
  const senderTag = appState.currentUser.role === 'user' ? 'client' : 'teacher';

  booking.chatHistory.push({
    sender: senderTag,
    text: text,
    time: timeStr
  });
  
  DB.set('active_booking', booking);
  renderChatHistory();
  playAudioTone(987.77, 'sine', 100); // Send sound

  // Sync message to server so real partner receives it
  fetch('/api/bookings/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bookingId: booking.id, chatHistory: booking.chatHistory })
  }).catch(e => console.error('Error syncing chat:', e));

  // Removed AI simulated replies to make chat 100% real.
  // In a real app, only the actual partner on the other end will reply.
}

// ----------------------------------------------------
// Review and Rating operations
// ----------------------------------------------------
function rateSession(stars) {
  appState.activeRating = stars;
  document.querySelectorAll('.rating-star-btn').forEach((btn, idx) => {
    if (idx < stars) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}

async function submitSessionReview() {
  const comment = document.getElementById('review-comment').value.trim();
  const userName = appState.currentUser ? appState.currentUser.fullname : 'Pelajar';
  const rating = appState.activeRating || 5;
  let teacherId = '';

  if (appState.historyList.length > 0) {
    teacherId = appState.historyList[0].teacherId;
  }

  if (teacherId && comment !== '') {
    try {
      await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teacherId: teacherId,
          userName: userName,
          rating: rating,
          comment: comment
        })
      });
      // Reload db data to get fresh reviews globally
      await loadDatabaseData();
    } catch (e) {
      console.error('Failed to submit review to server:', e);
    }
  }

  showToast('Terima kasih! Maklum balas anda telah direkodkan.');
  
  // Set rating status of last completed session in list
  if (appState.historyList.length > 0) {
    appState.historyList[0].rated = true;
    appState.historyList[0].rating = rating;
    DB.set('history_list', appState.historyList);
    renderHistoryList();
  }

  navigateTo('home-view');
}

function renderHistoryList() {
  const container = document.getElementById('history-list-container');
  container.innerHTML = '';

  if (appState.historyList.length === 0) {
    container.innerHTML = `<div style="text-align:center; padding:40px; color:var(--color-text-muted); font-size:13px;">Tiada rekod tugasan ditemui.</div>`;
    return;
  }

  appState.historyList.forEach(item => {
    const isPartnerView = appState.currentUser && appState.currentUser.role === 'partner';
    const service = initialServices.find(s => s.id === item.serviceId) || { name: 'Kelas Agama' };
    const starString = item.rated ? `⭐ ${item.rating}.0` : (item.status === 'completed' ? 'Selesai' : 'Dibatalkan');
    
    // For partner view, it's an earning. For user view, it's a payment.
    const amountClass = isPartnerView ? 'positive' : 'negative';
    const amountPrefix = isPartnerView ? '+RM' : '-RM';
    const personLabel = isPartnerView ? `Pelajar: ${item.clientName}` : `Guru: ${item.teacherName}`;

    const card = document.createElement('div');
    card.className = 'history-item-card';
    card.innerHTML = `
      <div class="history-item-left">
        <span class="history-item-title">${item.serviceName}</span>
        <span class="history-item-sub">${personLabel} • ${item.duration}</span>
        <span class="history-item-sub" style="font-size:9px; color:var(--color-text-muted);">${new Date(item.datetime).toLocaleString('ms-MY')}</span>
      </div>
      <div class="history-item-right">
        <span class="history-item-amount ${amountClass}">${amountPrefix} ${item.price.toFixed(2)}</span>
        <span class="history-item-status">${starString}</span>
      </div>
    `;
    container.appendChild(card);
  });
}

// ----------------------------------------------------
// Wallet payment and balances
// ----------------------------------------------------
function setWalletInputAmount(val) {
  document.getElementById('wallet-input-amount').value = val;
}

async function performTopUp() {
  const input = document.getElementById('wallet-input-amount');
  const amount = parseFloat(input.value);
  
  if (isNaN(amount) || amount <= 0) {
    showToast('Sila masukkan nilai tambah nilai yang sah', false);
    return;
  }

  try {
    const res = await fetch('/api/users/update-balance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: appState.currentUser.id,
        amount: amount
      })
    });

    const data = await res.json();
    if (res.ok && data.success) {
      appState.currentUser.balance = data.user.balance;
      localStorage.setItem('agamaku_user', JSON.stringify(appState.currentUser));
      
      if (appState.currentUser.role === 'partner') {
        appState.partnerUser.wallet = data.user.balance;
      }
      
      updateUIWalletBalances();
      showToast(`Tambah nilai RM ${amount.toFixed(2)} berjaya!`);
      playSuccessChime();
      input.value = '';
    } else {
      showToast(data.message || 'Tambah nilai gagal.', false);
    }
  } catch (e) {
    console.error(e);
    showToast('Ralat rangkaian semasa tambah nilai.', false);
  }
}

async function performWithdrawal() {
  const input = document.getElementById('wallet-input-amount');
  const amount = parseFloat(input.value);
  
  if (isNaN(amount) || amount <= 0) {
    showToast('Sila masukkan nilai pengeluaran yang sah', false);
    return;
  }

  const balance = appState.currentUser.balance !== undefined ? appState.currentUser.balance : 0;

  if (balance < amount) {
    showToast('Baki dompet anda tidak mencukupi untuk pengeluaran ini', false);
    return;
  }

  try {
    const res = await fetch('/api/users/update-balance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: appState.currentUser.id,
        amount: -amount
      })
    });

    const data = await res.json();
    if (res.ok && data.success) {
      appState.currentUser.balance = data.user.balance;
      localStorage.setItem('agamaku_user', JSON.stringify(appState.currentUser));
      
      if (appState.currentUser.role === 'partner') {
        appState.partnerUser.wallet = data.user.balance;
      }
      
      updateUIWalletBalances();
      showToast(`Pengeluaran RM ${amount.toFixed(2)} berjaya dihantar ke bank anda!`);
      playSuccessChime();
      input.value = '';
    } else {
      showToast(data.message || 'Pengeluaran gagal.', false);
    }
  } catch (e) {
    console.error(e);
    showToast('Ralat rangkaian semasa pengeluaran.', false);
  }
}

// ----------------------------------------------------
// Dual Mode Switching Logic (User Mode <=> Partner Mode)
// ----------------------------------------------------
function updateUserProfileUI() {
  if (!appState.currentUser) return;
  
  const profileNameEl = document.querySelector('#profile-view .profile-name');
  const profileAvatarEl = document.querySelector('#profile-view .profile-avatar-large');
  const partnerSwitchBox = document.querySelector('.partner-mode-switch-box');
  
  if (profileNameEl) profileNameEl.textContent = appState.currentUser.fullname || 'Pengguna';
  if (profileAvatarEl) profileAvatarEl.textContent = appState.currentUser.gender === 'P' ? '🧕' : '🧑';
  
  if (partnerSwitchBox) {
    if (appState.currentUser.teacher_id) {
      partnerSwitchBox.style.display = 'flex';
    } else {
      partnerSwitchBox.style.display = 'none';
    }
  }

  // Toggle action list visibility
  const actionSijil = document.getElementById('action-sijil');
  const actionAnak = document.getElementById('action-anak');
  
  if (appState.currentUser.role === 'partner') {
    if (actionSijil) actionSijil.style.display = 'flex';
    if (actionAnak) actionAnak.style.display = 'none';
  } else {
    if (actionSijil) actionSijil.style.display = 'none';
    if (actionAnak) actionAnak.style.display = 'flex';
  }
}

function toggleDualMode() {
  const isCurrentlyUser = appState.currentUser.role === 'user';
  const overlay = document.getElementById('mode-switch-overlay');
  const label = document.getElementById('mode-switch-overlay-label');

  // Activate overlay transition
  label.textContent = isCurrentlyUser ? 'Menukar ke Mod Ustaz...' : 'Menukar ke Mod Pelajar...';
  overlay.classList.add('visible');

  playAudioTone(783.99, 'triangle', 250);
  setTimeout(() => playAudioTone(1046.50, 'triangle', 450), 150);

  setTimeout(() => {
    if (isCurrentlyUser) {
      appState.currentUser.role = 'partner';
      document.getElementById('mode-switch-toggle').classList.add('active');
      navigateToPartnerDashboard();
    } else {
      appState.currentUser.role = 'user';
      document.getElementById('mode-switch-toggle').classList.remove('active');
      navigateToUserDashboard();
    }

    DB.set('profile_user', appState.currentUser);
    localStorage.setItem('agamaku_user', JSON.stringify(appState.currentUser));
    
    // Hide overlay
    overlay.classList.remove('visible');
  }, 1800);
}

function navigateToUserDashboard() {
  // Swapping nav layout values
  document.getElementById('app-bottom-nav').style.display = 'flex';
  
  // Set partner online offline configuration to false
  appState.partnerUser.online = false;
  DB.set('profile_partner', appState.partnerUser);
  document.getElementById('partner-status-toggle').classList.remove('active');
  document.getElementById('partner-online-status-lbl').textContent = 'Luar Talian (Offline)';
  document.getElementById('partner-online-status-lbl').className = 'partner-status-status';

  if (appState.currentUser && appState.currentUser.teacher_id) {
    fetch('/api/teachers/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        teacherId: appState.currentUser.teacher_id,
        online: false
      })
    }).catch(err => console.error('Error updating online status:', err));
  }
  
  if (appState.partnerOnlineTimeout) {
    clearTimeout(appState.partnerOnlineTimeout);
    appState.partnerOnlineTimeout = null;
  }
  
  stopJobAlarmLoop();

  // Redirect
  navigateTo('home-view');
}

function navigateToPartnerDashboard() {
  // Swapping bottom nav layout values (Ustaz dashboard has less/different tab triggers)
  document.getElementById('app-bottom-nav').style.display = 'none';

  // Redirect
  navigateTo('partner-home-view');
}

// ----------------------------------------------------
// Ustaz / Partner Dashboard Operations
// ----------------------------------------------------
function togglePartnerAvailability() {
  appState.partnerUser.online = !appState.partnerUser.online;
  DB.set('profile_partner', appState.partnerUser);

  if (appState.currentUser && appState.currentUser.teacher_id) {
    fetch('/api/teachers/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        teacherId: appState.currentUser.teacher_id,
        online: appState.partnerUser.online
      })
    }).catch(err => console.error('Error updating online status:', err));
  }

  const toggleBtn = document.getElementById('partner-status-toggle');
  const statusLbl = document.getElementById('partner-online-status-lbl');

  if (appState.partnerUser.online) {
    toggleBtn.classList.add('active');
    statusLbl.textContent = 'Dalam Talian (Online)';
    statusLbl.className = 'partner-status-status online';
    showToast('Anda kini bersedia untuk menerima tugasan pengajaran!', true);

    // Play Online trigger sound
    playAudioTone(1046.50, 'triangle', 250);
  } else {
    toggleBtn.classList.remove('active');
    statusLbl.textContent = 'Luar Talian (Offline)';
    statusLbl.className = 'partner-status-status';
    showToast('Terima Tempahan ditutup.');

    if (appState.partnerOnlineTimeout) {
      clearTimeout(appState.partnerOnlineTimeout);
      appState.partnerOnlineTimeout = null;
    }
    
    stopJobAlarmLoop();
    document.getElementById('job-alarm-modal').classList.remove('visible');
  }
}

// Sound job ping triggers
function triggerPartnerIncomingJobPing() {
  if (appState.currentUser.role !== 'partner' || !appState.partnerUser.online) return;

  const booking = appState.currentBooking;
  if (!booking) return;

  // Bind values to Alarm card popup
  document.getElementById('alarm-service-name').textContent = booking.serviceName;
  document.getElementById('alarm-estimated-earning').textContent = `RM ${(booking.price * 0.9).toFixed(2)}`; // Ustaz takes 90%
  document.getElementById('alarm-client-name').textContent = booking.clientName || 'Tengku Adrian';
  document.getElementById('alarm-datetime-text').textContent = 'Masa: Hari Ini, 5:00 PM';
  document.getElementById('alarm-address-text').textContent = booking.address;

  // Sound alarms
  startJobAlarmLoop();
  
  // Show Countdown Timer
  let countdownSecs = 15;
  const countEl = document.getElementById('alarm-countdown-text');
  countEl.textContent = countdownSecs;

  document.getElementById('job-alarm-modal').classList.add('visible');

  if (appState.jobCountdownInterval) clearInterval(appState.jobCountdownInterval);
  appState.jobCountdownInterval = setInterval(() => {
    countdownSecs--;
    countEl.textContent = countdownSecs;
    if (countdownSecs <= 0) {
      clearInterval(appState.jobCountdownInterval);
      rejectIncomingJob();
    }
  }, 1000);
}


async function rejectIncomingJob() {
  stopJobAlarmLoop();
  if (appState.jobCountdownInterval) clearInterval(appState.jobCountdownInterval);
  document.getElementById('job-alarm-modal').classList.remove('visible');
  
  if (appState.currentBooking) {
    if (!appState.currentBooking.id.startsWith('bk_')) {
      try {
        await fetch('/api/bookings/update-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bookingId: appState.currentBooking.id,
            status: 'cancelled'
          })
        });
      } catch (e) {
        console.error('Error rejecting booking:', e);
      }
    }
  }

  appState.currentBooking = null;
  DB.set('active_booking', null);
  
  showToast('Tugasan ditolak.');
}

async function acceptIncomingJob() {
  stopJobAlarmLoop();
  if (appState.jobCountdownInterval) clearInterval(appState.jobCountdownInterval);
  document.getElementById('job-alarm-modal').classList.remove('visible');

  playSuccessChime();

  const booking = appState.currentBooking;
  if (!booking) return;


  try {
    const res = await fetch('/api/bookings/update-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bookingId: booking.id,
        status: 'accepted'
      })
    });

    const data = await res.json();
    if (res.ok && data.success) {
      appState.currentBooking = mapDatabaseBookingToAppState(data.booking);
      DB.set('active_booking', appState.currentBooking);

      showToast('Tugasan diterima! Perjalanan bermula.', true);
  
      // Switch to live map but this time as driver!
      navigateTo('active-job-view');
      
      // Set driver UI configurations
      document.getElementById('active-job-status-badge').innerHTML = '<i class="ri-navigation-line"></i> Anda Sedang Menavigasi Ke Lokasi Pelajar';
      document.getElementById('active-job-teacher-name').textContent = booking.clientName || 'Sarah Amira';
      document.getElementById('active-job-teacher-avatar').textContent = '🧑‍🎓';
      document.getElementById('active-job-teacher-phone').textContent = 'No. Telefon: +60 18-333 4455';
      document.getElementById('simulation-skip-btn').textContent = 'Skip Perjalanan (Driver)';
      document.getElementById('active-job-eta').textContent = 'ETA: 5 min';

      // Instantiate live map. User stays at location, Driver moves from candidates coords to user!
      setTimeout(() => {
        const userLoc = appState.userLocation || DEFAULT_USER_LOCATION;
        const map = new AgamaKuMap('mapContainer', userLoc);
        appState.activeMap = map;
        
        // Set starting position of driver at the ustaz actual coordinates
        let startCoord = DEFAULT_USER_LOCATION;
        const teacherData = appState.teachersList.find(t => t.id === appState.currentUser.teacher_id);
        if (teacherData && teacherData.coordinates) {
          startCoord = teacherData.coordinates;
        }

        map.setUstaz({
          lat: startCoord.lat,
          lng: startCoord.lng,
          avatar: '👳‍♂️',
          name: 'Anda'
        });

        // Animate driver moving to user over 12 seconds
        map.animateUstazJourney(
          startCoord,
          userLoc,
          12000,
          (progress) => {
            const etaMins = Math.ceil((1 - progress) * 5);
            document.getElementById('active-job-eta').textContent = `ETA: ${etaMins} min`;
          },
          () => {
            // Update database so that polling doesn't overwrite it back to 'accepted'
            fetch('/api/bookings/update-status', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ bookingId: booking.id, status: 'arrived' })
            }).then(() => {
              booking.status = 'arrived';
              DB.set('active_booking', booking);
              showToast('Anda telah sampai di destinasi!', true);
              playSuccessChime();
              
              // Update driver screen details
              document.getElementById('active-job-status-badge').innerHTML = '<i class="ri-map-pin-user-fill"></i> Anda Telah Tiba di Lokasi';
              document.getElementById('active-job-eta').style.display = 'none';
              document.getElementById('simulation-skip-btn').textContent = 'Mulakan Kelas';
            }).catch(console.error);
          }
        );

      }, 100);
    } else {
      showToast(data.message || 'Gagal menerima tugasan.', false);
    }
  } catch (e) {
    console.error('Error accepting job:', e);
    showToast('Ralat rangkaian semasa menerima tugasan.', false);
  }
}

// ----------------------------------------------------
// Window Resize Handling (Native Responsive)
// ----------------------------------------------------
window.addEventListener('resize', () => {
  // Redraw/resize vector canvas map to fit its new width/height boundaries on screen rotation or resize
  if (appState.activeMap) {
    clearTimeout(window.resizeTimer);
    window.resizeTimer = setTimeout(() => {
      appState.activeMap.resize();
    }, 150);
  }
});

// ----------------------------------------------------
// Directory Listing & Teacher Profile Handlers
// ----------------------------------------------------
function openCategoryTeachers(categoryId) {
  const container = document.getElementById('teachers-list-container');
  container.innerHTML = '';

  const category = initialServices.find(s => s.id === categoryId);
  const filterBadgeEl = document.getElementById('teachers-list-filter-badge');
  const viewTitleEl = document.getElementById('teachers-list-title');

  let filteredTeachers = appState.teachersList;

  if (categoryId === 'all' || !category) {
    viewTitleEl.textContent = 'Direktori Guru';
    filterBadgeEl.innerHTML = '';
  } else {
    viewTitleEl.textContent = `${category.name}`;
    filterBadgeEl.innerHTML = `
      <div class="category-filter-badge">
        <span>Kategori: <b>${category.name}</b></span>
        <button onclick="openCategoryTeachers('all')"><i class="ri-close-circle-fill"></i></button>
      </div>
    `;
    filteredTeachers = appState.teachersList.filter(t => t.specialties.includes(categoryId));
  }

  if (filteredTeachers.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 40px 20px; color: var(--color-text-secondary);">
        <span style="font-size: 40px; display: block; margin-bottom: 10px;">🕌</span>
        <span>Maaf, tiada Ustaz/Ustazah bertauliah tersedia untuk kategori ini buat masa sekarang.</span>
      </div>
    `;
  } else {
    const userLoc = appState.userLocation || DEFAULT_USER_LOCATION;
    
    // Calculate distances and sort
    const teachersWithDistance = filteredTeachers.map(t => {
      let dist = 0;
      if (t.coordinates && t.coordinates.lat) {
        dist = calculateDistanceKm(userLoc.lat, userLoc.lng, t.coordinates.lat, t.coordinates.lng);
      }
      return { ...t, distance: dist };
    }).sort((a, b) => a.distance - b.distance);

    teachersWithDistance.forEach(teacher => {
      const specialtiesText = teacher.specialties.map(specId => {
        const spec = initialServices.find(s => s.id === specId);
        return `<span class="specialty-tag">${spec ? spec.name.split(' ')[0] : specId}</span>`;
      }).join(' ');

      const verifiedBadge = teacher.verified ? `<i class="ri-verified-badge-fill" style="color:var(--color-primary-light); font-size:14px; margin-left:4px;"></i>` : '';
      const distanceBadge = `<span style="font-size:11px; background:rgba(16,185,129,0.15); color:var(--color-primary-light); padding:2px 6px; border-radius:4px; margin-left:auto;"><i class="ri-map-pin-2-fill"></i> ${teacher.distance.toFixed(1)} km</span>`;

      const card = document.createElement('div');
      card.className = 'teacher-item-card';
      card.onclick = () => openTeacherProfile(teacher.id, 'teachers-list-view');
      card.innerHTML = `
        <div class="teacher-item-avatar">${teacher.avatar}</div>
        <div class="teacher-item-details">
          <div class="teacher-item-name-row" style="display:flex; align-items:center; width:100%;">
            <span class="teacher-item-name">${teacher.name}${verifiedBadge}</span>
            ${distanceBadge}
          </div>
          <div class="teacher-item-specialties">
            ${specialtiesText}
          </div>
          <div class="teacher-item-rate">RM ${teacher.hourlyRate.toFixed(2)}<span>/jam</span> &nbsp;·&nbsp; ⭐ ${teacher.rating.toFixed(1)}</div>
        </div>
      `;
      container.appendChild(card);
    });
  }

  navigateTo('teachers-list-view');
}

function goBackFromTeachersList() {
  navigateTo('home-view');
}

function openTeacherProfile(teacherId, backViewId) {
  const teacher = appState.teachersList.find(t => t.id === teacherId);
  if (!teacher) return;

  if (backViewId) {
    appState.profileBackView = backViewId;
  }

  appState.viewingTeacher = teacher;

  const scrollContainer = document.getElementById('teacher-profile-scroll');
  
  const verifiedBadge = teacher.verified ? `<i class="ri-verified-badge-fill" style="color:var(--color-primary-light); font-size:18px; margin-left:4px;"></i>` : '';

  const badgesHtml = teacher.badges.map(b => `<span class="profile-badge-pill">${b}</span>`).join('');

  const specialtiesHtml = teacher.specialties.map(specId => {
    const spec = initialServices.find(s => s.id === specId);
    return `<div class="profile-specialty-card">${spec ? spec.icon : '📖'} <span>${spec ? spec.name : specId}</span></div>`;
  }).join('');

  const reviews = appState.reviewsList.filter(r => r.teacherId === teacher.id);
  let reviewsHtml = '';
  if (reviews.length > 0) {
    reviewsHtml = reviews.map(r => `
      <div class="review-item">
        <div class="review-header">
          <span class="review-author">${r.userName}</span>
          <span class="review-date">${r.date}</span>
        </div>
        <div class="review-rating">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</div>
        <div class="review-text">"${r.comment}"</div>
      </div>
    `).join('');
  } else {
    reviewsHtml = `<div style="text-align: center; padding: 20px 0; color: var(--color-text-secondary); font-size: 12px; font-style: italic;">Belum ada ulasan rasmi untuk guru ini.</div>`;
  }

  scrollContainer.innerHTML = `
    <!-- Header info card -->
    <div class="profile-header-card">
      <div class="glowing-avatar-ring">${teacher.avatar}</div>
      <div class="profile-name">${teacher.name}${verifiedBadge}</div>
      <div class="profile-rating-row">
        <div class="profile-rating-badge">⭐ ${teacher.rating.toFixed(1)}</div>
        <span class="profile-reviews-count">(${teacher.reviewsCount} Ulasan)</span>
      </div>
      <div class="profile-badges-row">
        ${badgesHtml}
      </div>
    </div>

    <!-- Kadar Harga Box -->
    <div class="profile-rate-box">
      <div>
        <span class="profile-rate-label"><i class="ri-price-tag-3-fill"></i> Yuran Per Jam</span>
        <span class="profile-rate-amount">RM ${teacher.hourlyRate.toFixed(2)}<span class="profile-rate-unit">/jam</span></span>
      </div>
      <span style="font-size: 10px; background: rgba(16, 185, 129, 0.12); color: var(--color-primary-light); padding: 5px 10px; border-radius: 6px; font-weight: 700; border: 1px solid rgba(16,185,129,0.2);">TAULIAH RESMI</span>
    </div>

    <!-- Biodata / Mengenai -->
    <div class="profile-section">
      <span class="profile-section-title">Mengenai Guru</span>
      <div class="profile-bio-box">
        ${teacher.bio}
      </div>
    </div>

    <!-- Subjek Kepakaran -->
    <div class="profile-section">
      <span class="profile-section-title">Bidang Mengajar</span>
      <div class="profile-specialties-box">
        ${specialtiesHtml}
      </div>
    </div>

    <!-- Senarai Ulasan Pengguna -->
    <div class="profile-section">
      <span class="profile-section-title">Ulasan Pengguna (${reviews.length})</span>
      <div class="reviews-list">
        ${reviewsHtml}
      </div>
    </div>
  `;

  navigateTo('teacher-profile-view');
}

function goBackFromTeacherProfile() {
  navigateTo(appState.profileBackView || 'home-view');
}

function bookCurrentTeacher() {
  if (!appState.viewingTeacher) return;
  
  appState.selectedTeacher = appState.viewingTeacher;
  
  // Choose the first specialty
  const activeService = appState.selectedTeacher.specialties[0] || 'mengaji';
  
  openBooking(activeService);
}

function clearSelectedTeacher() {
  appState.selectedTeacher = null;
  
  const lockedBanner = document.getElementById('booking-locked-teacher');
  const genderGroup = document.getElementById('booking-gender-toggle').parentElement;
  
  lockedBanner.style.display = 'none';
  genderGroup.style.display = 'block';
  
  calculateBookingPrice();
}

function goBackFromBooking() {
  if (appState.selectedTeacher) {
    navigateTo('teacher-profile-view');
  } else {
    navigateTo('home-view');
  }
}


