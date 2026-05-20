// AgamaKu App Core State & Controller
let appState = {
  activeView: 'home-view',
  currentUser: null,
  partnerUser: null,
  currentBooking: null,
  historyList: [],
  activeMap: null,
  soundInterval: null,
  jobCountdownInterval: null,
  classTimerInterval: null,
  partnerOnlineTimeout: null
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

function initApp() {
  // 1. Load profiles or save defaults
  appState.currentUser = DB.get('profile_user', defaultUser);
  appState.partnerUser = DB.get('profile_partner', defaultPartner);
  appState.historyList = DB.get('history_list', defaultHistory);
  appState.currentBooking = DB.get('active_booking', null);

  // 2. Start clock
  startClock();

  // 3. Render UI values
  updateUIWalletBalances();
  renderFeaturedTeachers();
  populateBookingSelect();
  renderHistoryList();

  // 4. Handle recovery of active bookings
  if (appState.currentBooking) {
    recoverActiveBooking();
  } else {
    navigateTo('home-view');
  }
}

// ----------------------------------------------------
// UI Renderers & Helpers
// ----------------------------------------------------
function startClock() {
  const clockEl = document.getElementById('live-clock');
  const updateClock = () => {
    const now = new Date();
    let hrs = now.getHours().toString().padStart(2, '0');
    let mins = now.getMinutes().toString().padStart(2, '0');
    clockEl.textContent = `${hrs}:${mins}`;
  };
  updateClock();
  setInterval(updateClock, 30000);
}

function updateUIWalletBalances() {
  // User mode wallet bindings
  document.getElementById('home-wallet-amount').textContent = `RM ${appState.currentUser.wallet.toFixed(2)}`;
  document.getElementById('wallet-balance-total').textContent = `RM ${appState.currentUser.wallet.toFixed(2)}`;
  
  // Partner mode wallet bindings
  document.getElementById('partner-wallet-amount').textContent = `RM ${appState.partnerUser.wallet.toFixed(2)}`;
  document.getElementById('partner-stats-today').textContent = `RM ${appState.partnerUser.earningsToday.toFixed(2)}`;
  document.getElementById('partner-stats-week').textContent = `RM ${appState.partnerUser.earningsWeek.toFixed(2)}`;
}

function renderFeaturedTeachers() {
  const container = document.getElementById('featured-teachers-container');
  container.innerHTML = '';

  // Draw first 3 teachers
  initialUstazList.slice(0, 3).forEach(teacher => {
    const specialtiesText = teacher.specialties.map(specId => {
      const spec = initialServices.find(s => s.id === specId);
      return `<span class="specialty-tag">${spec ? spec.name.split(' ')[0] : specId}</span>`;
    }).join(' ');

    const verifiedBadge = teacher.verified ? `<i class="ri-verified-badge-fill" style="color:var(--color-primary-light); font-size:14px; margin-left:4px;"></i>` : '';

    const card = document.createElement('div');
    card.className = 'teacher-item-card';
    card.onclick = () => openBooking(teacher.specialties[0]);
    card.innerHTML = `
      <div class="teacher-item-avatar">${teacher.avatar}</div>
      <div class="teacher-item-details">
        <div class="teacher-item-name-row">
          <span class="teacher-item-name">${teacher.name}${verifiedBadge}</span>
          <span class="teacher-item-rating">⭐ ${teacher.rating.toFixed(1)}</span>
        </div>
        <div class="teacher-item-specialties">
          ${specialtiesText}
        </div>
        <div class="teacher-item-rate">RM ${teacher.hourlyRate.toFixed(2)}<span>/jam</span></div>
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
  if (!service) return;

  const durationActive = document.querySelector('#booking-duration-toggle .toggle-option.active');
  const hours = parseFloat(durationActive.getAttribute('data-hours'));
  const price = service.pricePerHour * hours;

  document.getElementById('booking-estimated-price').textContent = `RM ${price.toFixed(2)}`;
  return price;
}

function startBookingSearch() {
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
  if (appState.currentUser.wallet < price) {
    showToast('Baki AgamaKu Pay tidak mencukupi. Sila tambah nilai dompet.', false);
    setTimeout(() => {
      navigateTo('wallet-view');
    }, 1500);
    return;
  }

  // Setup Search State
  document.getElementById('matching-status-title').textContent = 'Mencari Ustaz...';
  document.getElementById('radar-icon').textContent = service.icon;
  navigateTo('matching-view');

  // If partner is ONLINE, we trigger the real job ping!
  if (appState.partnerUser.role === 'partner' && appState.partnerUser.online) {
    // This is the dual mode cross simulation!
    // The user has booked a service. We will trigger the incoming job offer alarm in partner mode,
    // and wait for the user to switch to partner mode to accept it!
    
    appState.currentBooking = {
      id: 'bk_' + Date.now(),
      serviceId,
      serviceName: service.name,
      icon: service.icon,
      price,
      hours: hours + ' Jam',
      datetime,
      address,
      notes,
      genderPref,
      clientName: appState.currentUser.name,
      status: 'matching',
      isDualSimulation: true
    };
    DB.set('active_booking', appState.currentBooking);

    showToast('Tugasan dihantar! Tukar ke Mod Ustaz Partner untuk terima kerja ini!', true);
    
    // Automatically sound the alarm in the background
    triggerPartnerIncomingJobPing();
    return;
  }

  // Normal Simulation: Search for nearest matching Ustaz automatically after 4 seconds
  let matchTimeout = setTimeout(() => {
    // Find teacher matching gender preference
    let matchedTeacher = null;
    const candidates = initialUstazList.filter(t => {
      if (genderPref !== 'any' && t.gender !== genderPref) return false;
      return t.specialties.includes(serviceId);
    });

    if (candidates.length > 0) {
      // Pick random matched teacher
      matchedTeacher = candidates[Math.floor(Math.random() * candidates.length)];
    } else {
      // Fallback
      matchedTeacher = initialUstazList[0];
    }

    // Deduct yuran
    appState.currentUser.wallet -= price;
    DB.set('profile_user', appState.currentUser);
    updateUIWalletBalances();

    appState.currentBooking = {
      id: 'bk_' + Date.now(),
      serviceId,
      serviceName: service.name,
      icon: service.icon,
      price,
      hours: hours + ' Jam',
      datetime,
      address,
      notes,
      teacher: matchedTeacher,
      status: 'accepted',
      chatHistory: [
        { sender: 'teacher', text: 'Assalamualaikum tuan. Terima kasih atas tempahan kelas. Saya sedang bersiap dan akan segera bertolak.', time: '16:46' }
      ]
    };
    DB.set('active_booking', appState.currentBooking);

    playSuccessChime();
    showToast(`Berjaya dipadankan dengan ${matchedTeacher.name}!`);
    
    navigateTo('active-job-view');
    startAutomaticTeacherMovement();
  }, 4000);

  appState.matchTimeout = matchTimeout;
}

function cancelBookingSearch() {
  if (appState.matchTimeout) {
    clearTimeout(appState.matchTimeout);
    appState.matchTimeout = null;
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

  // Initialize canvas map
  const map = new AgamaKuMap('mapCanvas', { x: 0.5, y: 0.5 });
  appState.activeMap = map;

  // Set initial coordinates of matched teacher
  map.setUstaz({
    x: teacher.coordinates.x,
    y: teacher.coordinates.y,
    avatar: teacher.avatar,
    name: teacher.name
  });
  
  // Bind floating details values
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

  // Animate over 15 seconds
  setTimeout(() => {
    if (!appState.activeMap || appState.activeView !== 'active-job-view') return;
    
    const startCoord = booking.teacher.coordinates;
    const endCoord = { x: 0.5, y: 0.5 };

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
        booking.chatHistory.push({
          sender: 'teacher',
          text: 'Assalamualaikum, saya sudah sampai di hadapan rumah tuan.',
          time: '16:52'
        });
        DB.set('active_booking', booking);
        showToast('Ustaz telah sampai di alamat anda!', true);
        playSuccessChime();
        updateJourneyUIStates();
      }
    );
  }, 2000);
}

function simulateActiveJobNextStep() {
  const booking = appState.currentBooking;
  if (!booking) return;

  const isPartner = appState.currentUser.role === 'partner';

  if (booking.status === 'accepted') {
    // Instantly teleport Ustaz to destination
    if (appState.activeMap) {
      appState.activeMap.stopSearching();
      const avatar = booking.teacher ? booking.teacher.avatar : '👳‍♂️';
      const name = booking.teacher ? booking.teacher.name : 'Anda';
      appState.activeMap.setUstaz({ x: 0.5, y: 0.5, avatar: avatar, name: name });
    }
    booking.status = 'arrived';
    booking.chatHistory.push({
      sender: 'teacher',
      text: 'Assalamualaikum, saya sudah sampai di hadapan rumah tuan.',
      time: '16:52'
    });
    DB.set('active_booking', booking);
    
    if (isPartner) {
      showToast('Anda telah sampai di destinasi!', true);
    } else {
      showToast('Ustaz telah sampai di alamat anda!', true);
    }
    
    playSuccessChime();
    updateJourneyUIStates();
  } else if (booking.status === 'arrived') {
    // Start class
    booking.status = 'started';
    booking.chatHistory.push({
      sender: 'teacher',
      text: 'Sesi pengajian telah bermula. Mari mulakan dengan bacaan Ummul Kitab Al-Fatihah.',
      time: '16:53'
    });
    DB.set('active_booking', booking);
    showToast('Sesi kelas dimulakan!', true);
    updateJourneyUIStates();
  } else if (booking.status === 'started') {
    // End class session and go to reviews / complete partner earnings
    stopClassDurationTimer();
    
    if (isPartner) {
      // PARTNER COMPLETION FLOW (Ustaz gets paid!)
      const earnings = booking.price * 0.9; // 90% of price
      appState.partnerUser.wallet += earnings;
      appState.partnerUser.earningsToday += earnings;
      appState.partnerUser.earningsWeek += earnings;
      appState.partnerUser.completedJobs += 1;
      DB.set('profile_partner', appState.partnerUser);

      // Save to history list
      const newHistoryItem = {
        id: booking.id,
        serviceId: booking.serviceId,
        serviceName: booking.serviceName,
        teacherName: 'Anda (Ustaz)',
        clientName: booking.clientName || 'Sarah Amira',
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
        datetime: booking.datetime,
        duration: booking.hours,
        price: booking.price,
        status: 'completed',
        rated: false
      };
      appState.historyList.unshift(newHistoryItem);
      DB.set('history_list', appState.historyList);
      renderHistoryList();

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

  // Simulating response
  if (!booking.isDualSimulation) {
    // AI Ustaz automated smart replies
    setTimeout(() => {
      let replyText = 'InshaAllah tuan, saya faham. Jazakallahu Khairan.';
      if (text.toLowerCase().includes('salam') || text.toLowerCase().includes('slm')) {
        replyText = 'Waalaikumussalam warahmatullah. Terima kasih atas mesej. Saya segera tiba.';
      } else if (text.toLowerCase().includes('alamat') || text.toLowerCase().includes('jalan')) {
        replyText = 'Baik tuan, navigasi saya menunjukkan alamat tersebut dengan jelas. Jumpa nanti.';
      } else if (text.toLowerCase().includes('lambat') || text.toLowerCase().includes('jalan jam')) {
        replyText = 'Baik tuan. Saya akan memandu dengan berhati-hati. Terima kasih atas makluman.';
      }

      booking.chatHistory.push({
        sender: 'teacher',
        text: replyText,
        time: timeStr
      });
      DB.set('active_booking', booking);
      
      if (appState.activeView === 'chat-view') {
        renderChatHistory();
      }
      showToast(`Mesej baru dari ${booking.teacher.name}!`);
      playAudioTone(523.25, 'sine', 150); // Message sound
    }, 2000);
  }
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

function submitSessionReview() {
  const comment = document.getElementById('review-comment').value.trim();
  showToast('Terima kasih! Maklum balas anda telah direkodkan.');
  
  // Set rating status of last completed session in list
  if (appState.historyList.length > 0) {
    appState.historyList[0].rated = true;
    appState.historyList[0].rating = appState.activeRating;
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
    const service = initialServices.find(s => s.id === item.serviceId);
    const starString = item.rated ? `⭐ ${item.rating}.0` : 'Belum dinilai';

    const card = document.createElement('div');
    card.className = 'history-item-card';
    card.innerHTML = `
      <div class="history-item-left">
        <span class="history-item-title">${item.serviceName}</span>
        <span class="history-item-sub">Guru: ${item.teacherName} • ${item.duration}</span>
        <span class="history-item-sub" style="font-size:9px; color:var(--color-text-muted);">${new Date(item.datetime).toLocaleString('ms-MY')}</span>
      </div>
      <div class="history-item-right">
        <span class="history-item-amount negative">-RM ${item.price.toFixed(2)}</span>
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

function performTopUp() {
  const input = document.getElementById('wallet-input-amount');
  const amount = parseFloat(input.value);
  
  if (isNaN(amount) || amount <= 0) {
    showToast('Sila masukkan nilai tambah nilai yang sah', false);
    return;
  }

  if (appState.currentUser.role === 'user') {
    appState.currentUser.wallet += amount;
    DB.set('profile_user', appState.currentUser);
  } else {
    appState.partnerUser.wallet += amount;
    DB.set('profile_partner', appState.partnerUser);
  }

  updateUIWalletBalances();
  showToast(`Tambah nilai RM ${amount.toFixed(2)} berjaya!`);
  playSuccessChime();
}

function performWithdrawal() {
  const input = document.getElementById('wallet-input-amount');
  const amount = parseFloat(input.value);
  
  if (isNaN(amount) || amount <= 0) {
    showToast('Sila masukkan nilai pengeluaran yang sah', false);
    return;
  }

  const activeWallet = appState.currentUser.role === 'user' ? appState.currentUser.wallet : appState.partnerUser.wallet;

  if (activeWallet < amount) {
    showToast('Baki dompet anda tidak mencukupi untuk pengeluaran ini', false);
    return;
  }

  if (appState.currentUser.role === 'user') {
    appState.currentUser.wallet -= amount;
    DB.set('profile_user', appState.currentUser);
  } else {
    appState.partnerUser.wallet -= amount;
    DB.set('profile_partner', appState.partnerUser);
  }

  updateUIWalletBalances();
  showToast(`Pengeluaran RM ${amount.toFixed(2)} berjaya dihantar ke bank anda!`);
  playSuccessChime();
}

// ----------------------------------------------------
// Dual Mode Switching Logic (User Mode <=> Partner Mode)
// ----------------------------------------------------
function toggleDualMode() {
  const isCurrentlyUser = appState.currentUser.role === 'user';
  const overlay = document.getElementById('mode-switch-overlay');
  const label = document.getElementById('mode-switch-overlay-label');

  // Activate overlay transition
  label.textContent = isCurrentlyUser ? 'Menukar ke Mod Ustaz Partner...' : 'Menukar ke Mod Pelajar...';
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

  const toggleBtn = document.getElementById('partner-status-toggle');
  const statusLbl = document.getElementById('partner-online-status-lbl');

  if (appState.partnerUser.online) {
    toggleBtn.classList.add('active');
    statusLbl.textContent = 'Dalam Talian (Online)';
    statusLbl.className = 'partner-status-status online';
    showToast('Anda kini bersedia untuk menerima tugasan pengajaran!', true);

    // Play Online trigger sound
    playAudioTone(1046.50, 'triangle', 250);

    // Dual Simulation Mode: If we have a pending matching class created in user mode, ping it immediately!
    // Otherwise, simulate a mock random customer booking after 8 seconds!
    if (appState.currentBooking && appState.currentBooking.isDualSimulation && appState.currentBooking.status === 'matching') {
      setTimeout(() => {
        triggerPartnerIncomingJobPing();
      }, 2000);
    } else {
      appState.partnerOnlineTimeout = setTimeout(() => {
        simulateIncomingRandomJob();
      }, 7000);
    }
  } else {
    toggleBtn.classList.remove('active');
    statusLbl.textContent = 'Luar Talian (Offline)';
    statusLbl.className = 'partner-status-status';
    showToast('Ketersediaan ditutup.');

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

function simulateIncomingRandomJob() {
  // Synthesize a random client booking
  const randomServices = initialServices;
  const randomService = randomServices[Math.floor(Math.random() * randomServices.length)];
  const randomPrice = randomService.pricePerHour * 1.5;

  appState.currentBooking = {
    id: 'bk_' + Date.now(),
    serviceId: randomService.id,
    serviceName: randomService.name,
    icon: randomService.icon,
    price: randomPrice,
    hours: '1.5 Jam',
    datetime: 'Hari ini, 5:00 PM',
    address: 'Lot 245, Lorong Damai 4, Kampung Dato Mufti, KL',
    notes: 'Mohon fokus mengaji tajwid makhraj huruf.',
    clientName: 'Sarah Amira',
    status: 'matching',
    isDualSimulation: true
  };
  DB.set('active_booking', appState.currentBooking);

  triggerPartnerIncomingJobPing();
}

function rejectIncomingJob() {
  stopJobAlarmLoop();
  if (appState.jobCountdownInterval) clearInterval(appState.jobCountdownInterval);
  document.getElementById('job-alarm-modal').classList.remove('visible');
  
  appState.currentBooking = null;
  DB.set('active_booking', null);
  
  showToast('Tugasan ditolak.');
  
  // Queue another random job in 12s if still online
  if (appState.partnerUser.online) {
    appState.partnerOnlineTimeout = setTimeout(() => {
      simulateIncomingRandomJob();
    }, 12000);
  }
}

function acceptIncomingJob() {
  stopJobAlarmLoop();
  if (appState.jobCountdownInterval) clearInterval(appState.jobCountdownInterval);
  document.getElementById('job-alarm-modal').classList.remove('visible');

  playSuccessChime();

  const booking = appState.currentBooking;
  if (!booking) return;

  booking.status = 'accepted';
  // If this was booked by active user profile, deduct their wallet
  if (booking.clientName === appState.currentUser.name) {
    appState.currentUser.wallet -= booking.price;
    DB.set('profile_user', appState.currentUser);
  }

  // Create chat logs
  booking.chatHistory = [
    { sender: 'teacher', text: 'Assalamualaikum. Saya telah menerima tugasan kelas anda. Saya sedang bergerak ke alamat anda sekarang.', time: '16:47' }
  ];
  DB.set('active_booking', booking);

  showToast('Tugasan diterima! Perjalanan bermula.', true);
  
  // Switch to live map but this time as driver!
  navigateTo('active-job-view');
  
  // Set driver UI configurations
  document.getElementById('active-job-status-badge').innerHTML = '<i class="ri-navigation-line"></i> Anda Sedang Menavigasi Ke Lokasi Pelajar';
  document.getElementById('active-job-teacher-name').textContent = booking.clientName || 'Sarah Amira';
  document.getElementById('active-job-teacher-avatar').textContent = '🧑';
  document.getElementById('active-job-teacher-phone').textContent = 'No. Telefon: +60 18-333 4455';
  document.getElementById('simulation-skip-btn').textContent = 'Skip Perjalanan (Driver)';
  document.getElementById('active-job-eta').textContent = 'ETA: 5 min';

  // Instantiate live canvas map. User stays at center, Driver moves from candidates coords to center!
  setTimeout(() => {
    const map = new AgamaKuMap('mapCanvas', { x: 0.5, y: 0.5 });
    appState.activeMap = map;
    
    // Set starting position of driver at the edges
    const startCoord = { x: 0.15, y: 0.25 };
    map.setUstaz({
      x: startCoord.x,
      y: startCoord.y,
      avatar: '👳‍♂️',
      name: 'Anda'
    });

    // Animate driver moving to center over 12 seconds
    map.animateUstazJourney(
      startCoord,
      { x: 0.5, y: 0.5 },
      12000,
      (progress) => {
        const etaMins = Math.ceil((1 - progress) * 5);
        document.getElementById('active-job-eta').textContent = `ETA: ${etaMins} min`;
      },
      () => {
        booking.status = 'arrived';
        booking.chatHistory.push({
          sender: 'teacher',
          text: 'Assalamualaikum, saya sudah sampai di hadapan rumah tuan.',
          time: '16:53'
        });
        DB.set('active_booking', booking);
        showToast('Anda telah sampai di destinasi!', true);
        playSuccessChime();
        
        // Update driver screen details
        document.getElementById('active-job-status-badge').innerHTML = '<i class="ri-map-pin-user-fill"></i> Anda Telah Tiba di Lokasi';
        document.getElementById('active-job-eta').style.display = 'none';
        document.getElementById('simulation-skip-btn').textContent = 'Mulakan Kelas';
      }
    );

  }, 100);
}
