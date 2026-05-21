// AgamaKu App Mock Database & Configuration
const initialServices = [
  {
    id: 'mengaji',
    name: 'Mengaji & Tajwid',
    tagline: 'Learn Quran with correct rules',
    description: 'Personalized classes focusing on Quran reading, letter pronunciation (Makhraj), and Tajwid rules for children and adults.',
    pricePerHour: 35,
    icon: '📖',
    bannerColor: 'linear-gradient(135deg, #0f766e, #0d9488)',
    rating: 4.9,
    completedClasses: '12.4k+'
  },
  {
    id: 'tadabbur',
    name: 'Tadabbur Quran',
    tagline: 'Deep dive into Quranic wisdom',
    description: 'Exploratory sessions examining the deep reflections, context, and applications of Quranic verses in modern life.',
    pricePerHour: 45,
    icon: '💡',
    bannerColor: 'linear-gradient(135deg, #b45309, #d97706)',
    rating: 4.8,
    completedClasses: '4.8k+'
  },
  {
    id: 'ceramah',
    name: 'Ceramah & Tazkirah',
    tagline: 'Arrange talks for family or mosque',
    description: 'Book qualified speakers for family gatherings, office events, or congregational surau tazkirahs on custom religious topics.',
    pricePerHour: 80,
    icon: '🗣️',
    bannerColor: 'linear-gradient(135deg, #1e3a8a, #2563eb)',
    rating: 4.9,
    completedClasses: '2.1k+'
  },
  {
    id: 'tahlil',
    name: 'Doa Selamat & Tahlil',
    tagline: 'Lead blessing & remembrance prayers',
    description: 'Gathering leadership for Doa Selamat blessings, tahlil arwah, and congregational Yaseen recitations at your home or mosque.',
    pricePerHour: 50,
    icon: '🤲',
    bannerColor: 'linear-gradient(135deg, #065f46, #059669)',
    rating: 5.0,
    completedClasses: '8.3k+'
  },
  {
    id: 'ruqyah',
    name: 'Ruqyah & Spiritual Shifa',
    tagline: 'Spiritual therapy & counselling',
    description: 'Islamic spiritual healing therapy, guidance, and protection prayers (ruqyah syariyah) for physical and spiritual wellness.',
    pricePerHour: 60,
    icon: '✨',
    bannerColor: 'linear-gradient(135deg, #6b21a8, #8b5cf6)',
    rating: 4.7,
    completedClasses: '1.5k+'
  }
];

const initialUstazList = [
  {
    id: 'ustaz_ahmad',
    name: 'Ustaz Ahmad Syakir',
    gender: 'ustaz',
    specialties: ['mengaji', 'tadabbur', 'tahlil'],
    rating: 4.9,
    reviewsCount: 142,
    hourlyRate: 35,
    avatar: '👨‍💼',
    bio: 'Graduate of Al-Azhar University in Usuluddin. Over 8 years of teaching children and adults. Specialized in Tajwid Rasm Uthmani.',
    verified: true,
    badges: ['Al-Azhar Grad', 'Tajwid Specialist', 'Top Rated'],
    phone: '+60 12-345 6789',
    coordinates: { x: 0.35, y: 0.42 } // Normalized canvas coordinates
  },
  {
    id: 'ustazah_fatimah',
    name: 'Ustazah Fatimah Az-Zahra',
    gender: 'ustazah',
    specialties: ['mengaji', 'tadabbur'],
    rating: 4.8,
    reviewsCount: 98,
    hourlyRate: 40,
    avatar: '🧕',
    bio: 'Masters in Quranic Studies (UM). Highly passionate about child education and women-only Tafsir circles. Soft-spoken and patient.',
    verified: true,
    badges: ['Quran Masters', 'Patient Teacher', 'Kids Favorite'],
    phone: '+60 17-987 6543',
    coordinates: { x: 0.65, y: 0.35 }
  },
  {
    id: 'ustaz_zulkifli',
    name: 'Ustaz Zulkifli Harun',
    gender: 'ustaz',
    specialties: ['ceramah', 'tahlil', 'ruqyah'],
    rating: 4.9,
    reviewsCount: 215,
    hourlyRate: 75,
    avatar: '👳‍♂️',
    bio: 'Well-known local da\'i and certified Ruqyah practitioner. Former Imam of Masjid Wilayah. Focuses on spiritual health and tahlil arwah.',
    verified: true,
    badges: ['Former Imam', 'Ruqyah Certified', 'Eloquent Speaker'],
    phone: '+60 13-222 8899',
    coordinates: { x: 0.28, y: 0.72 }
  },
  {
    id: 'ustazah_aisyah',
    name: 'Ustazah Aisyah Humaira',
    gender: 'ustazah',
    specialties: ['mengaji', 'tadabbur', 'tahlil'],
    rating: 5.0,
    reviewsCount: 84,
    hourlyRate: 45,
    avatar: '🧕',
    bio: 'Graduate of Islamic University of Madinah (Online Diploma) & UKM. Specialist in Arabic grammar and Tadabbur for busy corporate moms.',
    verified: true,
    badges: ['Arabic Linguist', 'Tadabbur Expert', 'Perfect 5.0'],
    phone: '+60 19-333 4455',
    coordinates: { x: 0.58, y: 0.68 }
  },
  {
    id: 'ustaz_luqman',
    name: 'Ustaz Luqman Hakim',
    gender: 'ustaz',
    specialties: ['mengaji', 'tadabbur', 'tahlil', 'ruqyah'],
    rating: 4.7,
    reviewsCount: 110,
    hourlyRate: 35,
    avatar: '👨‍💼',
    bio: 'Tahfiz Quran certificate holder with strong Tajwid credentials. Focuses on fun, engaging youth Quran sessions and family tahlil prayers.',
    verified: false,
    badges: ['Certified Hafiz', 'Youth Friendly'],
    phone: '+60 11-555 7788',
    coordinates: { x: 0.75, y: 0.55 }
  }
];

const initialReviews = [];

// Helper to load/save state
const DB = {
  get: (key, defaultValue) => {
    try {
      const data = localStorage.getItem('agamaku_' + key);
      return data ? JSON.parse(data) : defaultValue;
    } catch (e) {
      console.error('Error reading localStorage', e);
      return defaultValue;
    }
  },
  set: (key, value) => {
    try {
      localStorage.setItem('agamaku_' + key, JSON.stringify(value));
    } catch (e) {
      console.error('Error writing localStorage', e);
    }
  }
};
