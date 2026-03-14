import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, set, get, onValue, push, remove, update } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import { initVoiceModule } from "./voice.js";

const firebaseConfig = {
    apiKey: "AIzaSyAjE-2q6PONBkCin9ZN22gDp9Q8pAH9ZW8",
    authDomain: "story-97cf7.firebaseapp.com",
    databaseURL: "https://story-97cf7-default-rtdb.firebaseio.com",
    projectId: "story-97cf7",
    storageBucket: "story-97cf7.firebasestorage.app",
    messagingSenderId: "742801388214",
    appId: "1:742801388214:web:32a305a8057b0582c5ec17"
};
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

let selectedRole = 'student'; 
let currentUser = null;
let currentQuestions = [];
let currentImgBase64 = null;
let aiGenImgBase64 = null;
let currentChatId = null;
let currentChatMessages = [];
let isIncognito = false;
let isEditingMode = false;
let editingTestId = null;
let isMyPostsView = false;
let reeseImages = []; 
let myUid = null;
let activeChatRoomId = null;
let _lastReeseSuggestions = [];
let _cachedReeseSuggestions = [];

// =========== DIRECT VOICE CALL SYSTEM ===========
let _directCallPeer = null;
let _directCallConn = null;
let _directCallStream = null;
let _directCallTimer = null;
let _directCallSeconds = 0;
let _directCallMuted = false;
let _callTargetUid = null;
let _callTargetName = null;
let _callTargetIcon = null;
let _incomingCallData = null;

// =========== ARABIC SPELL CORRECTION MAP ===========
const ARABIC_CORRECTIONS = {
    // عامية مصرية / خليجية → فصحى
    'كيفيه': 'كيفية', 'الاعلام': 'الإعلام', 'السؤل': 'السؤال',
    'اريد': 'أريد', 'انا': 'أنا', 'اعطني': 'أعطني',
    'اشرحلي': 'اشرح لي', 'ايه': 'ما هو', 'ازاي': 'كيف',
    'مش': 'لا', 'عايز': 'أريد', 'ممكن': 'هل يمكن',
    'الفرق': 'ما الفرق', 'يعني': 'أي', 'بس': 'لكن',
    'طب': 'إذن', 'احسن': 'أفضل', 'وضحلي': 'وضح لي',
    'ازى': 'كيف', 'ليه': 'لماذا', 'مستقبلا': 'مستقبلاً',
    'دائما': 'دائماً', 'ايضا': 'أيضاً', 'اخيرا': 'أخيراً',
    'هتقولي': 'أخبرني', 'قولي': 'أخبرني', 'هاتلي': 'أعطني',
    'كمان': 'أيضاً', 'خالص': 'تماماً', 'اوي': 'جداً',
    'عشان': 'لأن', 'علشان': 'لأن', 'مين': 'من',
    'فين': 'أين', 'امتى': 'متى', 'ازيك': 'كيف حالك',
    'تمام': 'حسناً', 'ماشي': 'حسناً', 'اوك': 'حسناً',
    'شوية': 'قليلاً', 'كتير': 'كثيراً', 'زي': 'مثل',
    'الحاجه': 'الأمر', 'الموضوع ده': 'هذا الموضوع',
    'الكلام ده': 'هذا الكلام', 'ده': 'هذا', 'دي': 'هذه',
    'دول': 'هؤلاء', 'اللي': 'الذي', 'اللى': 'الذي',
    'مش فاهم': 'لا أفهم', 'مش عارف': 'لا أعرف',
    'حل لي': 'احل لي', 'حلي': 'احل لي', 'هحل': 'سأحل',
    'وجاب': 'واجب', 'الوجاب': 'الواجب', 'وجبات': 'واجبات',
    'مسئله': 'مسألة', 'مسأله': 'مسألة', 'المسأله': 'المسألة',
    'المسئله': 'المسألة', 'سؤاله': 'سؤاله', 'الاسأله': 'الأسئلة',
    'اسئله': 'أسئلة', 'السؤله': 'الأسئلة', 'استفسار': 'سؤال',
    'الاجابه': 'الإجابة', 'اجابه': 'إجابة', 'اجابات': 'إجابات',
    'حسابات': 'حسابات', 'معادله': 'معادلة', 'معادلة': 'معادلة',
    'مقابله': 'مقابلة', 'مقارنه': 'مقارنة', 'ملاحظه': 'ملاحظة',
    'الى': 'إلى', 'إلي': 'إلى', 'علي': 'على', 'عليه': 'عليه',
    'ان': 'أن', 'إن': 'أن', 'فى': 'في', 'فيه': 'فيه'
};

function correctArabicSpelling(text) {
    let corrected = text;
    Object.entries(ARABIC_CORRECTIONS).forEach(([wrong, right]) => {
        const regex = new RegExp(wrong, 'g');
        corrected = corrected.replace(regex, right);
    });
    return corrected;
}

function isComplexQuestion(text) {
    const complexKeywords = ['اشرح', 'وضح', 'ما الفرق', 'كيف', 'لماذا', 'ما هو', 'تحليل', 'مقارنة', 'سبب', 'نتيجة', 'تفصيل', 'explain', 'why', 'how', 'compare', 'analyze'];
    const wordCount = text.split(' ').length;
    return wordCount > 12 || complexKeywords.some(kw => text.includes(kw));
}

// =========== NATIVE AD DATA ===========
const NATIVE_ADS = [
    { icon: '📚', title: 'كورس مجاني في الرياضيات', sub: 'تعلم من أفضل المعلمين مجاناً', cta: 'سجل الآن' },
    { icon: '🔬', title: 'مختبر العلوم الافتراضي', sub: 'تجارب علمية تفاعلية مذهلة', cta: 'اكتشف' },
    { icon: '🏆', title: 'مسابقة SA EDU الكبرى', sub: 'اربح جوائز قيمة وشهادات', cta: 'شارك' },
    { icon: '🎯', title: 'خطة دراسية ذكية', sub: 'AI يصمم لك خطتك الدراسية', cta: 'جرب' },
    { icon: '📖', title: 'مكتبة المناهج الشاملة', sub: 'آلاف الكتب والشروحات', cta: 'تصفح' }
];
let _adIndex = 0;

function createNativeAdCard() {
    const ad = NATIVE_ADS[_adIndex % NATIVE_ADS.length];
    _adIndex++;
    const div = document.createElement('div');
    div.className = 'native-ad-card';
    div.innerHTML = `
        <div class="native-ad-icon">${ad.icon}</div>
        <div class="native-ad-content">
            <div class="native-ad-title">${ad.title}</div>
            <div class="native-ad-sub">${ad.sub}</div>
        </div>
        <button class="native-ad-cta">${ad.cta}</button>
    `;
    return div;
}

window.filterExamsBySubject = (subject) => {
    const input = document.getElementById('t-search');
    if(input) { input.value = subject; input.dispatchEvent(new Event('input')); }
};
window.filterStudentExams = (subject) => {
    const input = document.getElementById('s-search');
    if(input) { input.value = subject; input.dispatchEvent(new Event('input')); }
};

const TEACHER_TABS = ['t-library', 't-reese', 't-dardasha', 't-ai'];
const STUDENT_TABS = ['s-exams', 's-reese', 's-dardasha', 's-ai'];
let _suppressHistoryPush = false;

let _swipeStartX = 0;
let _swipeStartY = 0;
let _swipeStartTarget = null;

let lastScrollTop = 0;
function _scrollNavCheck(st) {
    const nav = document.querySelector('.top-nav');
    if (!nav) return;
    if (st > lastScrollTop && st > 50)      nav.classList.add('nav-hidden');
    else if (st < lastScrollTop - 10)       nav.classList.remove('nav-hidden');
    lastScrollTop = Math.max(0, st);
}
window.addEventListener('scroll', () => _scrollNavCheck(window.pageYOffset || document.documentElement.scrollTop), { passive: true });
// also catch scroll inside sections
document.addEventListener('scroll', (e) => {
    const el = e.target;
    if (el && typeof el.scrollTop === 'number' && el !== document)
        _scrollNavCheck(el.scrollTop);
}, { passive: true, capture: true });

window.addEventListener('popstate', (e) => {
    if (!currentUser) return;
    const hash = window.location.hash.replace('#', '');
    if (!hash) return;
    
    const tabs = selectedRole === 'teacher' ? TEACHER_TABS : STUDENT_TABS;
    const portal = selectedRole === 'teacher' ? 'teacher-app' : 'student-app';
    const idx = tabs.indexOf(hash);
    
    if (idx !== -1) {
        _suppressHistoryPush = true;
        const navBtns = document.querySelectorAll(`#${portal} .nav-btn`);
        switchTab(hash, navBtns[idx]);
        _suppressHistoryPush = false;
    }
});

function initKeyboardFix() {
    if (!window.visualViewport) return;
    
    let lastViewportHeight = window.visualViewport.height;
    
    window.visualViewport.addEventListener('resize', () => {
        const vvHeight = window.visualViewport.height;
        const vvTop = window.visualViewport.offsetTop;
        const diff = window.innerHeight - vvHeight - vvTop;
        
        const geminiWrapper = document.querySelector('.gemini-input-wrapper');
        if (geminiWrapper) {
            geminiWrapper.style.bottom = Math.max(0, diff) + 'px';
        }
        
        const chatInputAreas = document.querySelectorAll('.chat-input-area');
        chatInputAreas.forEach(area => {
            area.style.bottom = Math.max(0, diff) + 'px';
            area.style.position = diff > 50 ? 'sticky' : 'absolute';
        });
        
        const activeEl = document.activeElement;
        if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
            setTimeout(() => {
                activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }, 100);
        }
        
        lastViewportHeight = vvHeight;
    });
}

function initSwipeNavigation(portalId) {
    const portal = document.getElementById(portalId);
    if (!portal) return;

    portal.addEventListener('touchstart', (e) => {
        _swipeStartX = e.touches[0].clientX;
        _swipeStartY = e.touches[0].clientY;
        _swipeStartTarget = e.target;
    }, { passive: true });

    let _swMoving = false, _swCurDx = 0;
    portal.addEventListener('touchmove', (e) => {
        if (_swipeStartTarget && (
            _swipeStartTarget.closest('input') ||
            _swipeStartTarget.closest('textarea') ||
            _swipeStartTarget.closest('.full-screen-overlay')
        )) return;
        const dx = e.touches[0].clientX - _swipeStartX;
        const dy = e.touches[0].clientY - _swipeStartY;
        if (Math.abs(dx) < Math.abs(dy) * 1.2) return;
        _swMoving = true; _swCurDx = dx;
        // move fb-bar live with finger
        const pfx = selectedRole === 'teacher' ? 't' : 's';
        const tabs = selectedRole === 'teacher' ? TEACHER_TABS : STUDENT_TABS;
        const hash = window.location.hash.replace('#','');
        let curIdx = tabs.indexOf(hash); if(curIdx<0) curIdx=0;
        const frac = Math.max(0, Math.min(tabs.length-1, curIdx + (-dx / window.innerWidth)));
        _moveFbBarLive(pfx, frac);
    }, { passive: true });

    portal.addEventListener('touchend', (e) => {
        if (_swipeStartTarget && (
            _swipeStartTarget.closest('input') ||
            _swipeStartTarget.closest('textarea') ||
            _swipeStartTarget.closest('.full-screen-overlay')
        )) return;
        const dx = e.changedTouches[0].clientX - _swipeStartX;
        const dy = e.changedTouches[0].clientY - _swipeStartY;
        const pfx = selectedRole === 'teacher' ? 't' : 's';
        const tabs = selectedRole === 'teacher' ? TEACHER_TABS : STUDENT_TABS;
        const hash = window.location.hash.replace('#', '');
        let idx = tabs.indexOf(hash); if(idx<0) idx=0;
        // re-enable transition for snap
        const bar = document.getElementById(pfx+'-fb-bar');
        if (bar) { bar.classList.add('snap'); setTimeout(()=>bar.classList.remove('snap'),350); }
        if (Math.abs(dx) < 70 || Math.abs(dx) <= Math.abs(dy) * 1.5) {
            _moveFbBar(pfx, null); // snap back to current
            return;
        }
        const newIdx = dx > 0 ? idx + 1 : idx - 1;
        if (newIdx >= 0 && newIdx < tabs.length) {
            const navBtns = document.querySelectorAll(`#${portalId} .nav-btn`);
            const direction = dx > 0 ? 'left' : 'right';
            switchTabWithDirection(tabs[newIdx], navBtns[newIdx], direction);
        }
    }, { passive: true });
}

function switchTabWithDirection(tabId, btn, direction) {
    const portal = selectedRole === 'teacher' ? 'teacher-app' : 'student-app';
    const newSection = document.getElementById(tabId);
    if (!newSection) return;

    // Get current visible section
    const currentSection = document.querySelector(`#${portal} .app-section:not(.hidden)`);

    // Determine animation classes based on direction
    // direction: 'right' means swiping right (going to previous tab = slide in from left)
    // direction: 'left' means swiping left (going to next tab = slide in from right)
    const outClass = direction === 'left' ? 'sliding-out-left' : 'sliding-out-right';
    const inClass  = direction === 'left' ? 'sliding-in-left'  : 'sliding-in-right';

    if (currentSection && currentSection !== newSection) {
        currentSection.classList.add(outClass);
        setTimeout(() => {
            currentSection.classList.remove(outClass);
        }, 320);
    }

    // Switch the tab normally (hides current, shows new)
    switchTab(tabId, btn);

    // Apply slide-in to the new section
    newSection.classList.add(inClass);
    setTimeout(() => {
        newSection.classList.remove(inClass);
    }, 320);
}

let _tabDotsTimer = null;

function updateTabDots(activeTabId) {
    const dotsContainer = document.getElementById('tab-dots');
    if (!dotsContainer) return;
    const tabs = selectedRole === 'teacher' ? TEACHER_TABS : STUDENT_TABS;
    dotsContainer.innerHTML = '';
    tabs.forEach((tab) => {
        const dot = document.createElement('div');
        dot.className = 'tab-dot' + (tab === activeTabId ? ' active' : '');
        dotsContainer.appendChild(dot);
    });
}

function showTabDotsTemporarily() {
    const dotsContainer = document.getElementById('tab-dots');
    if (!dotsContainer) return;
    dotsContainer.classList.remove('hidden');
    dotsContainer.classList.add('swipe-visible');
    if (_tabDotsTimer) clearTimeout(_tabDotsTimer);
    _tabDotsTimer = setTimeout(() => {
        dotsContainer.classList.remove('swipe-visible');
    }, 2500);
}

function showTabDots() {
    // Only used internally - don't show permanently, only on swipe
}
// ════ FACEBOOK SLIDING TAB BAR ════
function _moveFbBar(pfx, activeBtn) {
    const bar = document.getElementById(pfx + '-fb-bar');
    const nav = document.getElementById(pfx + '-nav');
    if (!bar || !nav) return;
    const btn = activeBtn || nav.querySelector('.nav-btn.active');
    if (!btn) return;
    bar.classList.add('snap');
    const navR = nav.getBoundingClientRect();
    const btnR = btn.getBoundingClientRect();
    bar.style.width     = btnR.width + 'px';
    bar.style.transform = 'translateX(' + (btnR.left - navR.left) + 'px)';
    setTimeout(() => bar.classList.remove('snap'), 350);
}

// Live interpolation during swipe (no transition — follows finger exactly)
function _moveFbBarLive(pfx, frac) {
    const bar = document.getElementById(pfx + '-fb-bar');
    const nav = document.getElementById(pfx + '-nav');
    if (!bar || !nav) return;
    const btns = Array.from(nav.querySelectorAll('.nav-btn'));
    const tabs = pfx==='t' ? TEACHER_TABS : STUDENT_TABS;
    const lo = Math.floor(frac);
    const hi = Math.min(lo + 1, tabs.length - 1);
    const t  = frac - lo;
    const bLo = btns[lo], bHi = btns[hi];
    if (!bLo || !bHi) return;
    const navR = nav.getBoundingClientRect();
    const rLo  = bLo.getBoundingClientRect();
    const rHi  = bHi.getBoundingClientRect();
    const left  = (rLo.left - navR.left) + (rHi.left - rLo.left) * t;
    const width = rLo.width + (rHi.width - rLo.width) * t;
    bar.style.width     = width + 'px';
    bar.style.transform = 'translateX(' + left + 'px)';
}

function _initFbBar(pfx) {
    // slight delay to ensure layout is ready
    setTimeout(() => _moveFbBar(pfx, null), 350);
}
function hideTabDots() {
    const dotsContainer = document.getElementById('tab-dots');
    if (dotsContainer) {
        dotsContainer.classList.remove('swipe-visible');
    }
}

window.addEventListener('click', function(e) {
    const searchModal = document.getElementById('user-search-modal');
    const profileModal = document.getElementById('profile-info-modal');
    const teacherDetailModal = document.getElementById('teacher-detail-modal');
    const phoneModal = document.getElementById('phone-modal');

    if (e.target === searchModal) {
        searchModal.classList.add('hidden');
    }
    if (e.target === profileModal) {
        profileModal.classList.add('hidden');
    }
    if (e.target === teacherDetailModal) {
        teacherDetailModal.classList.add('hidden');
    }
});

function playSound(type) {
    const chatOnlySounds = ['sent', 'recv'];
    if (!chatOnlySounds.includes(type)) return;
    
    const soundMap = {
        'sent': 'snd-sent',
        'recv': 'snd-recv',
    };
    const id = soundMap[type];
    if(id) {
        const audio = document.getElementById(id);
        if(audio) {
            audio.currentTime = 0;
            audio.play().catch(e => {});
        }
    }
}

function showToast(title, sub = '', type = 'msg', duration = 3000) {
    let container = document.getElementById('sa-toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'sa-toast-container';
        document.body.appendChild(container);
    }
    
    const icons = {
        msg:     'fas fa-comment-dots',
        success: 'fas fa-check',
        error:   'fas fa-exclamation',
        info:    'fas fa-bell',
    };
    
    const toast = document.createElement('div');
    toast.className = `sa-toast ${type}`;
    toast.innerHTML = `
        <div class="sa-toast-icon"><i class="${icons[type] || icons.msg}"></i></div>
        <div class="sa-toast-body">
            <div class="sa-toast-title">${title}</div>
            ${sub ? `<div class="sa-toast-sub">${sub}</div>` : ''}
        </div>
    `;
    
    toast.onclick = () => removeToast(toast);
    container.appendChild(toast);
    
    setTimeout(() => removeToast(toast), duration);
}

function removeToast(toast) {
    if (!toast || toast.classList.contains('removing')) return;
    toast.classList.add('removing');
    setTimeout(() => toast.remove(), 280);
}

function makeLinksClickable(text) {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.replace(urlRegex, function(url) {
        return `<a href="${url}" target="_blank" class="clickable-link">${url}</a>`;
    });
}

function toggleConstructionOverlay(show, title="SA AI Building...", sub="جاري المعالجة") {
    const ol = document.getElementById('construction-overlay');
    if (show) {
        ol.querySelector('.construction-text').innerText = title;
        ol.querySelector('.construction-sub').innerText = sub;
        ol.classList.add('active');
    } else {
        ol.classList.remove('active');
    }
}

function getSkeletonHTML() {
    return `
    <div class="skeleton-loader">
        <div class="skeleton-header">
            <div class="skeleton-circle"></div>
            <div class="skeleton-text">
                <div class="skeleton-line short"></div>
                <div class="skeleton-line" style="width:30%"></div>
            </div>
        </div>
        <div class="skeleton-line"></div>
        <div class="skeleton-line"></div>
        <div class="skeleton-rect"></div>
    </div>`;
}
function getMultipleSkeletons(count = 3) {
    let html = ''; for(let i=0; i<count; i++) html += getSkeletonHTML(); return html;
}

function getEmptyStateHTML(type) {
    if(type === 'posts') {
        return `<div class="empty-state-container"><div class="empty-avatar"><i class="fas fa-box-open" style="color:#666;"></i></div><h3 style="color:#888;">لا توجد منشورات حالياً</h3><p style="color:#555; font-size:0.9rem;">كن أول من يشارك أفكاره!</p></div>`;
    } else if (type === 'exams') {
        return `<div class="empty-state-container"><div class="empty-avatar"><i class="fas fa-folder-open" style="color:#666;"></i></div><h3 style="color:#888;">لا توجد اختبارات</h3><p style="color:#555; font-size:0.9rem;">استمتع بوقتك، لا يوجد ضغط الآن.</p></div>`;
    } else if (type === 'chats') {
        return `<div class="empty-state-container"><div class="empty-avatar"><i class="fab fa-telegram-plane" style="color:#666;"></i></div><h3 style="color:#888;">لا توجد محادثات</h3><p style="color:#555; font-size:0.9rem;">ابحث عن أصدقاء لبدء الدردشة.</p></div>`;
    }
    return '';
}

window.saAlert = (msg, type = 'info', title = null) => {
    const simpleTypes = ['success', 'info'];
    if (simpleTypes.includes(type) && !title) {
        const toastType = type === 'success' ? 'success' : 'info';
        showToast(msg, '', toastType, 3000);
        return;
    }
    
    const modal = document.getElementById('sa-custom-alert');
    const iconDiv = document.getElementById('sa-alert-icon');
    const titleDiv = document.getElementById('sa-alert-title');
    const msgDiv = document.getElementById('sa-alert-msg');
    const actionsDiv = document.getElementById('sa-alert-actions');
    actionsDiv.innerHTML = `<button class="sa-btn sa-btn-primary" onclick="closeSaAlert()">حسناً</button>`;
    let iconHtml = ''; let color = '#fff';
    if(type === 'success') { iconHtml = '<i class="fas fa-check-circle"></i>'; color = 'var(--success)'; if(!title) title = 'نجاح'; } 
    else if (type === 'error') { iconHtml = '<i class="fas fa-times-circle"></i>'; color = 'var(--danger)'; if(!title) title = 'خطأ'; } 
    else { iconHtml = '<i class="fas fa-info-circle"></i>'; color = 'var(--accent-primary)'; if(!title) title = 'تنبيه'; }
    iconDiv.innerHTML = iconHtml; iconDiv.style.color = color;
    titleDiv.innerText = title; msgDiv.innerText = msg;
    modal.classList.add('active');
};

window.saConfirm = (msg, onConfirm) => {
    playSound('click');
    const modal = document.getElementById('sa-custom-alert');
    document.getElementById('sa-alert-icon').innerHTML = '<i class="fas fa-question-circle" style="color:var(--warning)"></i>';
    document.getElementById('sa-alert-title').innerText = 'تأكيد';
    document.getElementById('sa-alert-msg').innerText = msg;
    const actionsDiv = document.getElementById('sa-alert-actions');
    actionsDiv.innerHTML = '';
    const btnYes = document.createElement('button');
    btnYes.className = 'sa-btn sa-btn-primary'; btnYes.innerText = 'نعم، متابعة'; btnYes.style.background = 'var(--warning)';
    btnYes.onclick = () => { closeSaAlert(); onConfirm(); };
    const btnNo = document.createElement('button');
    btnNo.className = 'sa-btn sa-btn-secondary'; btnNo.innerText = 'إلغاء';
    btnNo.onclick = closeSaAlert;
    actionsDiv.appendChild(btnNo); actionsDiv.appendChild(btnYes);
    modal.classList.add('active');
};

window.closeSaAlert = () => { playSound('click'); document.getElementById('sa-custom-alert').classList.remove('active'); };

function createAdBanner() {
    // Ads removed
    return null;
}

const getBase64 = (file) => new Promise((resolve) => {
    const reader = new FileReader(); reader.readAsDataURL(file); reader.onload = () => resolve(reader.result);
});

async function recognizeImageText(imageBase64) {
    try {
        const worker = Tesseract.createWorker({ logger: m => {} });
        await worker.load();
        await worker.loadLanguage('ara+eng');
        await worker.initialize('ara+eng');
        const { data: { text } } = await worker.recognize(imageBase64);
        await worker.terminate();
        return text;
    } catch (error) {
        console.error("OCR Error:", error);
        throw new Error("فشل في قراءة النص من الصورة.");
    }
}

async function callPollinationsAI(prompt, retries = 4) {
    const models = ['openai', 'openai-large', 'mistral', 'llama'];
    let lastError = null;
    
    for (let attempt = 0; attempt < retries; attempt++) {
        const model = models[attempt % models.length];
        try {
            // Try POST first
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 18000);
            
            const response = await fetch('https://text.pollinations.ai/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: controller.signal,
                body: JSON.stringify({
                    messages: [{ role: 'user', content: prompt }],
                    model: model,
                    stream: false,
                    seed: Math.floor(Math.random() * 99999)
                })
            });
            clearTimeout(timeout);
            
            if (response.ok) {
                const txt = await response.text();
                try {
                    const j = JSON.parse(txt);
                    const content = j?.choices?.[0]?.message?.content || j?.text || txt;
                    if (content && content.trim().length > 0) return content;
                } catch(e) {
                    if (txt && txt.trim().length > 0) return txt;
                }
            }
            
            // Fallback GET
            if (prompt.length <= 500) {
                try {
                    const getCtrl = new AbortController();
                    const getTimeout = setTimeout(() => getCtrl.abort(), 10000);
                    const getResp = await fetch('https://text.pollinations.ai/' + encodeURIComponent(prompt.substring(0,500)), { signal: getCtrl.signal });
                    clearTimeout(getTimeout);
                    if (getResp.ok) {
                        const txt = await getResp.text();
                        if (txt && txt.trim().length > 0) return txt;
                    }
                } catch(ge) {}
            }
            
        } catch (error) {
            lastError = error;
            if (attempt < retries - 1) {
                await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
            }
        }
    }
    // Return a fallback message instead of throwing — AI never stops
    return 'عذراً، حدث خطأ مؤقت في الاتصال. يرجى إعادة المحاولة.';
}

window.goToAuth = () => {
        playSound('click');
        document.getElementById('landing-layer').classList.add('hidden');
        document.getElementById('auth-layer').classList.remove('hidden');
        setAuthRole('student');
};

window.setAuthRole = (role) => {
    playSound('click');
    selectedRole = role;
    const icon = role === 'student' ? 'fa-user-astronaut' : 'fa-user-tie';
    const color = role === 'student' ? 'var(--accent-primary)' : 'var(--accent-gold)';
    document.getElementById('btn-role-student').classList.toggle('active', role === 'student');
    document.getElementById('btn-role-teacher').classList.toggle('active', role === 'teacher');
    const display = document.getElementById('auth-avatar-display');
    display.innerHTML = `<i class="fas ${icon}"></i>`;
    display.style.color = color; display.style.borderColor = color;
    display.className = `avatar-frame avatar-${role}`;
};

window.backToLanding = () => {
    playSound('click');
    document.getElementById('auth-layer').classList.add('hidden');
    document.getElementById('landing-layer').classList.remove('hidden');
};

window.handleSmartAuth = async () => {
    playSound('click');
    const name1 = document.getElementById('auth-name-1').value.trim();
    const name2 = document.getElementById('auth-name-2').value.trim();
    const name3 = document.getElementById('auth-name-3').value.trim();
    const pass = document.getElementById('auth-pass').value.trim();
    const status = document.getElementById('auth-status');
    if (!name1 || !name2 || !name3 || !pass) return status.innerText = "يرجى ملء جميع الحقول";
    const passRegex = /^[a-zA-Z0-9]+$/;
    if (pass.length !== 6 || !passRegex.test(pass)) return status.innerText = "كلمة المرور يجب أن تكون 6 خانات (حروف إنجليزية وأرقام فقط)";
    const fullName = `${name1} ${name2} ${name3}`;
    status.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> جارِ الاتصال...';
    const userRef = ref(db, `users/${selectedRole}s/${fullName}`);
    try {
        const snap = await get(userRef);
        if (snap.exists()) {
            if (snap.val().password === pass) {
                const savedIcon = snap.val().icon;
                let uid = snap.val().uid;
                if(!uid) {
                    uid = generateUID();
                    await update(userRef, { uid: uid });
                }
                loginSuccess(fullName, savedIcon, uid);
            } else status.innerText = "كلمة المرور غير صحيحة";
        } else {
            const defaultIcon = selectedRole === 'student' ? 'fa-user-astronaut' : 'fa-user-tie';
            const uid = generateUID();
            await set(userRef, { password: pass, joined: Date.now(), icon: defaultIcon, uid: uid });
            loginSuccess(fullName, defaultIcon, uid);
        }
    } catch (e) { console.error(e); status.innerText = "حدث خطأ في الاتصال"; }
};

function generateUID() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

function loginSuccess(name, icon, uid) {
    playSound('success');
    currentUser = name;
    myUid = uid;
    localStorage.setItem('sa_user', name);
    localStorage.setItem('sa_role', selectedRole);
    localStorage.setItem('sa_icon', icon || (selectedRole === 'student' ? 'fa-user-astronaut' : 'fa-user-tie'));
    localStorage.setItem('sa_uid', uid);
    
    document.getElementById('landing-layer').classList.add('hidden');
    document.getElementById('auth-layer').classList.add('hidden');
    updateMenuInfo();
    
    if (selectedRole === 'teacher') {
        document.getElementById('teacher-app').classList.remove('hidden');
        initTeacherApp();
        setTimeout(() => initSwipeNavigation('teacher-app'), 500);
        setTimeout(() => _initFbBar('t'), 600);
    } else {
        document.getElementById('student-app').classList.remove('hidden');
        loadStudentExams(); loadStudentGrades(); initStudentReese();
        updateStreakOnLogin();
        // XP HUD removed
        setTimeout(() => initSwipeNavigation('student-app'), 500);
        setTimeout(() => _initFbBar('s'), 600);
    }
    initDardasha();
    initVoiceModule(db, currentUser, myUid);
    
    initKeyboardFix();
    
    handleDeepLinksAndRouting();
    
    showTabDots();
    const defaultTab = selectedRole === 'teacher' ? 't-library' : 's-exams';
    updateTabDots(window.location.hash.replace('#', '') || defaultTab);
    
    // Update hero sections
    setTimeout(updateHeroSections, 300);

    // Pre-load AI suggestions in background (async, non-blocking)
    setTimeout(() => {
        loadReeseAiSuggestionsAuto().catch(() => {});
        _preloadReeseSuggestions();
    }, 2000);

    // Apply admin design settings from Firebase (live updates)
    onValue(ref(db, 'admin/design'), (snap) => {
        const d = snap.val();
        if (!d) return;
        const root = document.documentElement.style;
        if (d.accent) { root.setProperty('--accent-primary', d.accent); root.setProperty('--blue', d.accent); root.setProperty('--accent-glow', d.accent + '55'); }
        if (d.bg)     { root.setProperty('--bg-deep', d.bg); document.body.style.background = d.bg; }
        if (d.card)   { root.setProperty('--bg-card', d.card); root.setProperty('--bg-surface', d.card); }
        if (d.font)   { document.body.style.fontFamily = d.font; }
        if (d.radius) { root.setProperty('--radius', d.radius + 'px'); }
    });
}

function updateOGMeta(title, description, imageUrl) {
    const baseUrl = window.location.href.split('?')[0];
    const fullUrl = window.location.href;

    const set = (selector, attr, val) => {
        const el = document.querySelector(selector);
        if (el) el.setAttribute(attr, val);
    };

    document.title = title + ' | SA EDU';
    set('meta[property="og:title"]', 'content', title);
    set('meta[property="og:description"]', 'content', description);
    set('meta[property="og:url"]', 'content', fullUrl);
    set('meta[name="twitter:title"]', 'content', title);
    set('meta[name="twitter:description"]', 'content', description);
    if (imageUrl) {
        set('meta[property="og:image"]', 'content', imageUrl);
        set('meta[name="twitter:image"]', 'content', imageUrl);
    }
    set('link[rel="canonical"]', 'href', fullUrl);
}


function showDeepLinkBanner(title, subtitle, btnText, onConfirm) {
    const existing = document.getElementById('deeplink-banner');
    if (existing) existing.remove();
    const banner = document.createElement('div');
    banner.id = 'deeplink-banner';
    banner.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.88);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;';
    banner.innerHTML = '<div style="background:#111;border:1px solid #2a2a2a;border-radius:28px;padding:32px 24px;max-width:380px;width:100%;text-align:center;">' +
        '<div style="font-size:3rem;margin-bottom:16px;">🔗</div>' +
        '<h2 style="margin:0 0 10px;font-size:1.2rem;color:#fff;">' + title + '</h2>' +
        '<p style="color:#888;font-size:0.9rem;margin-bottom:28px;line-height:1.6;">' + subtitle + '</p>' +
        '<div style="display:flex;gap:10px;">' +
            '<button onclick="document.getElementById('deeplink-banner').remove()" style="flex:1;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.12);color:#aaa;padding:14px;border-radius:16px;cursor:pointer;font-family:var(--font-main);font-size:0.95rem;">إلغاء</button>' +
            '<button id="dl-confirm-btn" style="flex:2;background:linear-gradient(135deg,#3b82f6,#2563eb);border:none;color:#fff;padding:14px;border-radius:16px;cursor:pointer;font-weight:800;font-family:var(--font-main);font-size:0.95rem;box-shadow:0 4px 15px rgba(59,130,246,0.4);">' + btnText + '</button>' +
        '</div>' +
    '</div>';
    document.body.appendChild(banner);
    document.getElementById('dl-confirm-btn').onclick = function() { banner.remove(); onConfirm(); };
}

async function handleDeepLinks() {
    const params = new URLSearchParams(window.location.search);
    const shareId  = params.get('shareId');
    const examId   = params.get('examId');
    const postId   = params.get('postId');
    const chatUid  = params.get('chat');
    const chatRoom = params.get('room');
    const aiTab    = params.get('aiTab');

    const groupInvite = params.get('groupInvite');
    if (!shareId && !examId && !postId && !chatUid && !chatRoom && !aiTab && !groupInvite) return;

    // Handle group invite
    if (groupInvite) {
        showDeepLinkLoader();
        const grpSnap = await get(ref(db, `groups/${groupInvite}`)).catch(() => null);
        if (grpSnap && grpSnap.exists()) {
            const grp = grpSnap.val();
            hideDeepLinkLoader();
            showDeepLinkBanner(
                '👥 دعوة لجروب: ' + grp.name,
                Object.keys(grp.members||{}).length + ' عضو — ' + (grp.desc||'جروب على SA EDU'),
                'دخول الجروب',
                () => {
                    const prefix = selectedRole==='teacher'?'t':'s';
                    switchTab(`${prefix}-dardasha`);
                    setTimeout(() => {
                        window.switchChatTab(prefix,'groups');
                        setTimeout(() => openGroupRoom(groupInvite, prefix), 500);
                    }, 300);
                    // Add user to group members
                    update(ref(db, `groups/${groupInvite}/members/${myUid}`), { name:currentUser, joinedAt:Date.now(), isAdmin:false });
                    update(ref(db, `user_groups/${myUid}/${groupInvite}`), { name:grp.name, emoji:grp.emoji||'👥', lastMsg:'', lastMsgTime:Date.now() });
                }
            );
        } else {
            hideDeepLinkLoader();
            saAlert('رابط الدعوة غير صالح أو انتهت صلاحيته','error');
        }
        return;
    }

    showDeepLinkLoader();

    if (aiTab) {
        const prefix = selectedRole === 'teacher' ? 't' : 's';
        updateOGMeta('المساعد الذكي SA AI', 'تحدث مع مساعد الذكاء الاصطناعي على SA EDU');
        switchTab(`${prefix}-ai`);
        hideDeepLinkLoader();
        return;
    }

    if (shareId) {
        const prefix = selectedRole === 'teacher' ? 't' : 's';
        updateOGMeta('محادثة AI مشاركة', 'شاهد هذه المحادثة مع الذكاء الاصطناعي على SA EDU');
        switchTab(`${prefix}-ai`);
        loadSharedChat(shareId, prefix);
        hideDeepLinkLoader();
        return;
    }

    if (examId) {
        const snap = await get(ref(db, `tests/${examId}`));
        if (snap.exists()) {
            const d = snap.val();
            const subjectLabel = d.subject || 'اختبار';
            updateOGMeta(`${subjectLabel}: ${d.title}`, `اختبار ${subjectLabel} • ${d.questions?.length||0} سؤال • ${d.duration} دقيقة • أعده ${d.teacher}`);
            hideDeepLinkLoader();
            showDeepLinkBanner(
                '📝 ' + d.title,
                subjectLabel + ' · ' + (d.questions?.length||0) + ' سؤال · ' + d.duration + ' دقيقة — المعلم: ' + d.teacher,
                selectedRole==='student' ? 'ابدأ الاختبار الآن' : 'عرض الاختبار',
                () => {
                    if (selectedRole==='student') { switchTab('s-exams'); checkPhoneAndStart(examId); }
                    else { switchTab('t-library'); setTimeout(()=>{const card=document.querySelector(`[data-exam-id="${examId}"]`); if(card){card.scrollIntoView({behavior:'smooth'});card.style.border='2px solid var(--accent-gold)';setTimeout(()=>card.style.border='',3000);}},400); }
                }
            );
        } else {
            hideDeepLinkLoader();
            saAlert("الامتحان غير موجود أو تم حذفه", "error");
        }
        return;
    }

    if (postId) {
        const prefix = selectedRole === 'teacher' ? 't' : 's';
        const postSnap = await get(ref(db, `reese_posts/${postId}`));
        if (postSnap.exists()) {
            const pd = postSnap.val();
            updateOGMeta(
                `منشور من ${pd.author || 'مستخدم'} على Reese`,
                pd.text?.substring(0, 160) || 'منشور على منصة SA EDU',
                pd.images?.[0] || pd.image || null
            );
        }
        switchTab(`${prefix}-reese`);
        hideDeepLinkLoader();
        const tryScroll = (attempts = 0) => {
            const el = document.getElementById(`post-${postId}`);
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                el.style.transition = 'box-shadow 0.4s';
                el.style.boxShadow = '0 0 0 3px var(--accent-primary)';
                setTimeout(() => { el.style.boxShadow = ''; }, 3000);
            } else if (attempts < 10) {
                setTimeout(() => tryScroll(attempts + 1), 200);
            }
        };
        tryScroll();
        return;
    }

    if (chatRoom) {
        const prefix = selectedRole === 'teacher' ? 't' : 's';
        const roomSnap = await get(ref(db, `chat_room_meta/${chatRoom}`));
        if (roomSnap.exists()) {
            const rm = roomSnap.val();
            const otherUid = rm.members?.find(m => m !== myUid);
            const otherName = rm.names?.[otherUid] || 'مستخدم';
            const otherIcon = rm.icons?.[otherUid] || 'fa-user';
            updateOGMeta(`محادثة مع ${otherName}`, `افتح المحادثة مع ${otherName} على SA EDU`);
            switchTab(`${prefix}-dardasha`);
            hideDeepLinkLoader();
            openChatRoom(chatRoom, otherName, otherIcon, otherUid);
        } else {
            switchTab(`${prefix}-dardasha`);
            hideDeepLinkLoader();
        }
        return;
    }

    if (chatUid && chatUid !== myUid) {
        const prefix = selectedRole === 'teacher' ? 't' : 's';
        const usnap = await get(ref(db, `users/students/${chatUid}`)).catch(() => null)
            || await get(ref(db, `users/teachers/${chatUid}`)).catch(() => null);
        if (usnap?.exists()) {
            const ud = usnap.val();
            updateOGMeta(`تواصل مع ${ud.username || 'مستخدم'}`, `ابدأ محادثة مع ${ud.username || 'مستخدم'} على SA EDU`);
        }
        switchTab(`${prefix}-dardasha`);
        searchUserById(chatUid);
        hideDeepLinkLoader();
        return;
    }

    hideDeepLinkLoader();
}

function showDeepLinkLoader() {
    let el = document.getElementById('deeplink-loader');
    if (!el) {
        el = document.createElement('div');
        el.id = 'deeplink-loader';
        el.innerHTML = `<div class="dl-spinner"></div><p>جاري الفتح...</p>`;
        document.body.appendChild(el);
    }
    el.style.display = 'flex';
}

function hideDeepLinkLoader() {
    const el = document.getElementById('deeplink-loader');
    if (el) el.style.display = 'none';
}

function handleDeepLinksAndRouting() {
    const params = new URLSearchParams(window.location.search);
    const hasDeepLink = params.get('shareId') || params.get('examId') || params.get('postId') || params.get('chat') || params.get('room') || params.get('aiTab') || params.get('groupInvite');
    
    if (hasDeepLink) {
        handleDeepLinks();
        return;
    }
    
    const hash = window.location.hash.replace('#', '');
    const allTabs = selectedRole === 'teacher' ? TEACHER_TABS : STUDENT_TABS;
    const portal = selectedRole === 'teacher' ? 'teacher-app' : 'student-app';
    
    if (hash && allTabs.includes(hash)) {
        const idx = allTabs.indexOf(hash);
        const navBtns = document.querySelectorAll(`#${portal} .nav-btn`);
        _suppressHistoryPush = true;
        switchTab(hash, navBtns[idx]);
        _suppressHistoryPush = false;
    } else {
        const defaultTab = selectedRole === 'teacher' ? 't-library' : 's-exams';
        window.history.replaceState({ tab: defaultTab }, '', '#' + defaultTab);
    }
}

window.toggleMenu = () => {
    playSound('click');
    document.getElementById('menu-modal').classList.toggle('open');
    document.getElementById('menu-edit-section').classList.add('hidden');
    document.getElementById('menu-avatar-section').classList.add('hidden');
};

function updateMenuInfo() {
    document.getElementById('menu-username').innerText = currentUser;
    document.getElementById('menu-role').innerText = selectedRole === 'teacher' ? 'معلم' : 'طالب';
    const iconClass = localStorage.getItem('sa_icon');
    const color = selectedRole === 'teacher' ? 'var(--accent-gold)' : 'var(--accent-primary)';
    document.getElementById('menu-avatar').innerHTML = `<i class="fas ${iconClass}"></i>`;
    document.getElementById('menu-avatar').style.color = color;
    document.getElementById('menu-avatar').style.borderColor = color;
    document.getElementById('edit-name-input').value = currentUser;
    const reeseAvs = document.querySelectorAll('.reese-avatar-mini');
    reeseAvs.forEach(el => { el.innerHTML = `<i class="fas ${iconClass}" style="color:${color}"></i>`; });
    
    document.getElementById('pi-name').innerText = currentUser;
    document.getElementById('pi-avatar').innerHTML = `<i class="fas ${iconClass}"></i>`;
    document.getElementById('pi-avatar').style.color = color;
    document.getElementById('pi-avatar').style.borderColor = color;
    document.getElementById('pi-id-box').innerText = myUid;
    
    const prefix = selectedRole === 'teacher' ? 't' : 's';
    const chatAv = document.getElementById(`${prefix}-chat-my-avatar`);
    if(chatAv) {
        chatAv.innerHTML = `<i class="fas ${iconClass}"></i>`;
        chatAv.style.color = color;
        chatAv.style.borderColor = color;
    }
}

window.toggleEditProfile = () => {
    playSound('click');
    document.getElementById('menu-edit-section').classList.toggle('hidden');
    document.getElementById('menu-avatar-section').classList.add('hidden');
};

window.saveProfileName = async () => {
    playSound('click');
    const newName = document.getElementById('edit-name-input').value.trim();
    if(!newName || newName === currentUser) return;
    saConfirm("تغيير الاسم سيؤدي لإنشاء حساب جديد. هل أنت متأكد؟", async () => {
        const oldRef = ref(db, `users/${selectedRole}s/${currentUser}`);
        const snapshot = await get(oldRef);
        const data = snapshot.val();
        await set(ref(db, `users/${selectedRole}s/${newName}`), data);
        await remove(oldRef);
        currentUser = newName; localStorage.setItem('sa_user', newName);
        updateMenuInfo(); saAlert("تم تغيير الاسم بنجاح", "success"); toggleEditProfile();
    });
};

window.toggleAvatarSelect = () => {
    playSound('click');
    document.getElementById('menu-avatar-section').classList.toggle('hidden');
    document.getElementById('menu-edit-section').classList.add('hidden');
};

window.saveAvatar = async (iconClass) => {
    playSound('click');
    localStorage.setItem('sa_icon', iconClass);
    await update(ref(db, `users/${selectedRole}s/${currentUser}`), { icon: iconClass });
    updateMenuInfo(); toggleAvatarSelect();
};

window.logout = () => { playSound('click'); localStorage.clear(); location.reload(); };

window.shareApp = () => {
    playSound('click');
    const url = window.location.href.split('?')[0]; 
    const text = "انضم لمنصة SA EDU التعليمية المتطورة!";
    if (navigator.share) navigator.share({ title: 'SA EDU', text: text, url: url }).catch(err => console.log(err));
    else { navigator.clipboard.writeText(url).then(() => saAlert("تم نسخ رابط المنصة!", "success")); }
};

function initTeacherApp() {
    loadTeacherTests(); renderOptionFields(); startNewChat('t'); loadReesePosts('t');
    startTypewriter("cta-type-text", "اضغط هنا لكتابة الامتحان");
}
function initStudentReese() { loadReesePosts('s'); }

function startTypewriter(elementId, text) {
    const el = document.getElementById(elementId);
    if(!el) return;
    el.innerHTML = ""; let i = 0;
    function type() { if (i < text.length) { el.innerHTML += text.charAt(i); i++; setTimeout(type, 80); } }
    type();
}
if(document.getElementById('landing-type-text')) { startTypewriter("landing-type-text", "منصة تعليمية ذكية تنقلك إلى آفاق المستقبل"); }


// ════ AUTO DEEP LINKS ════
// Converts SA EDU mentions in text to clickable links
function formatDeepLinks(text) {
    if (!text) return text;
    // Exam links: "اختبار: XXXX" or share links with examId
        text = text.replace(/examId=([a-zA-Z0-9_-]+)/g, (m, id) =>
        '<span class="sa-link exam-link" onclick="checkPhoneAndStart(\'' + id + '\')">📝 ابدأ الاختبار</span>');
    text = text.replace(/SA AI|الذكاء الاصطناعي/g,
        '<span class="sa-link ai-link" onclick="goToAI()">$&</span>');
    text = text.replace(/Reese SA|منصة ريس/g,
        '<span class="sa-link reese-link" onclick="goToReese()">$&</span>');
    text = text.replace(/الدردشه|الدردشة/g,
        '<span class="sa-link chat-link" onclick="goToChat()">$&</span>');
        // Regular URLs
    text = text.replace(/(https?:\/\/[^\s<>"]+)/g, '<a class="sa-link" href="$1" target="_blank" rel="noopener">$1</a>');
    return text;
}

window.goToTab = (tabId) => {
    const portal = selectedRole === 'teacher' ? 'teacher-app' : 'student-app';
    const tabs   = selectedRole === 'teacher' ? TEACHER_TABS : STUDENT_TABS;
    const idx    = tabs.indexOf(tabId);
    if (idx < 0) return;
    const btn = document.querySelectorAll('#'+portal+' .nav-btn')[idx];
    switchTab(tabId, btn);
};

window.goToAI   = () => goToTab(selectedRole==='teacher'?'t-ai':'s-ai');
window.goToChat = () => goToTab(selectedRole==='teacher'?'t-dardasha':'s-dardasha');
window.goToReese= () => goToTab(selectedRole==='teacher'?'t-reese':'s-reese');


window.switchTab = (tabId, btn) => {
    playSound('click');
    const portal = selectedRole === 'teacher' ? 'teacher-app' : 'student-app';
    document.querySelectorAll(`#${portal} .app-section`).forEach(s => s.classList.add('hidden'));
    document.getElementById(tabId).classList.remove('hidden');
    if(btn) { 
        document.querySelectorAll(`#${portal} .nav-btn`).forEach(b => b.classList.remove('active')); 
        btn.classList.add('active'); 
    }
    // move facebook bar
    const _fbPfx = selectedRole === 'teacher' ? 't' : 's';
    _moveFbBar(_fbPfx, btn);
    
    if (!_suppressHistoryPush) {
        const allTabs = selectedRole === 'teacher' ? TEACHER_TABS : STUDENT_TABS;
        if (allTabs.includes(tabId)) {
            window.history.pushState({ tab: tabId }, '', '#' + tabId);
        }
    }
    
    updateTabDots(tabId);
    
    if(tabId === 's-grades') loadStudentGrades();
    if(tabId === 's-exams') {
        loadStudentExams();
        startTypewriter("student-type-text", "تحليل المستوى الدراسي");
        // XP HUD removed
    }
    if(tabId === 't-library') {
        loadTeacherTests();
        startTypewriter("cta-type-text", "اضغط هنا لكتابة الامتحان");
    }
    if(tabId === 't-reese' || tabId === 's-reese') {
        const prefix = selectedRole === 'teacher' ? 't' : 's';
        loadReesePosts(prefix);
    }
    if(tabId === 't-ai' && !currentChatId) startNewChat('t');
    if(tabId === 's-ai' && !currentChatId) startNewChat('s');

    
    setTimeout(() => {
        const aiInput = document.getElementById(`${tabId.charAt(0)}-ai-input`);
        if (aiInput) {
            aiInput.addEventListener('focus', () => {
                if (window.innerWidth < 768) {
                    setTimeout(() => {
                        aiInput.scrollIntoView({ behavior: 'smooth', block: 'end' });
                    }, 350);
                }
            });
        }
    }, 100);
};

function initDardasha() {
    const prefix = selectedRole === 'teacher' ? 't' : 's';
    const list = document.getElementById(`${prefix}-chat-list`);
    list.innerHTML = getMultipleSkeletons(2);
    
    onValue(ref(db, `user_chats/${myUid}`), (snap) => {
        list.innerHTML = '';
        if(!snap.exists()) {
            list.innerHTML = getEmptyStateHTML('chats');
            return;
        }
        
        const chats = snap.val();
        
        const chatEntries = Object.entries(chats);
        chatEntries.forEach(([chatId, chatInfo], index) => {
            const el = document.createElement('div');
            el.className = 'chat-item';
            el.onclick = () => openChatRoom(chatId, chatInfo.otherName, chatInfo.otherIcon, chatInfo.otherUid);
            el.innerHTML = `
                <div class="avatar-frame mini-frame" style="border-color: #666; color: #ccc;"><i class="fas ${chatInfo.otherIcon}"></i></div>
                <div style="flex:1;">
                    <div style="font-weight:bold; color:#fff; display:flex; justify-content:space-between;">
                        <span>${chatInfo.otherName}</span>
                        <span style="font-size:0.7rem; color:#666;">${chatInfo.lastMsgTime ? new Date(chatInfo.lastMsgTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''}</span>
                    </div>
                    <div style="font-size:0.8rem; color:#aaa; overflow:hidden; white-space:nowrap; text-overflow:ellipsis;">
                        ${chatInfo.lastMsg ? (chatInfo.lastMsg.includes('data:image') ? '📷 صورة' : chatInfo.lastMsg) : 'ابدأ المحادثة...'}
                    </div>
                </div>
            `;
            list.appendChild(el);
            
            { const _ad = createAdBanner(); if (_ad) list.appendChild(_ad); }
        });
        
        chatEntries.forEach(([chatId, chatInfo]) => {
             if(chatInfo.lastMsgTime > Date.now() - 5000 && chatInfo.lastMsg !== "📷 صورة" && activeChatRoomId !== chatId) {
                 playSound('recv');
                 showToast(chatInfo.otherName, chatInfo.lastMsg?.substring(0, 50) || '...', 'msg', 3500);
             }
        });
    });
}

window.openMyProfileModal = () => {
    playSound('click');
    document.getElementById('profile-info-modal').classList.remove('hidden');
};

window.copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => saAlert("تم النسخ: " + text, "success"));
};

window.copyProfileLink = () => {
    playSound('click');
    const url = `${window.location.href.split('?')[0]}?chat=${myUid}`;
    navigator.clipboard.writeText(url).then(() => saAlert("تم نسخ رابط المحادثة المباشر!", "success"));
};

window.toggleUserSearchModal = () => {
    playSound('click');
    document.getElementById('user-search-modal').classList.remove('hidden');
    document.getElementById('user-search-result').innerHTML = '';
    document.getElementById('user-search-id-input').value = '';
};

window.searchUserById = async (forcedId = null) => {
    playSound('click');
    const id = forcedId || document.getElementById('user-search-id-input').value.trim();
    if(!id) return;
    
    const resultDiv = document.getElementById('user-search-result');
    if(!forcedId) resultDiv.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري البحث...';
    
    let foundUser = null;
    let foundRole = '';
    
    const sSnap = await get(ref(db, `users/students`));
    if(sSnap.exists()) {
        Object.entries(sSnap.val()).forEach(([name, data]) => {
            if(data.uid == id) { foundUser = {name, ...data}; foundRole = 'student'; }
        });
    }
    
    if(!foundUser) {
        const tSnap = await get(ref(db, `users/teachers`));
        if(tSnap.exists()) {
            Object.entries(tSnap.val()).forEach(([name, data]) => {
                if(data.uid == id) { foundUser = {name, ...data}; foundRole = 'teacher'; }
            });
        }
    }
    
    if(foundUser) {
        if(forcedId) {
             document.getElementById('user-search-modal').classList.add('hidden');
             startChatWithUser(foundUser.name, foundUser.icon, foundUser.uid);
             return;
        }

        const roleColor = foundRole === 'teacher' ? 'var(--accent-gold)' : 'var(--accent-primary)';
        resultDiv.innerHTML = `
            <div style="background:#222; padding:15px; border-radius:15px; text-align:center; margin-top:15px;">
                <div class="avatar-frame mini-frame" style="margin:0 auto 10px; color:${roleColor}; border-color:${roleColor};">
                    <i class="fas ${foundUser.icon}"></i>
                </div>
                <h4 style="margin:0 0 10px;">${foundUser.name}</h4>
                <button class="modern-btn" onclick="startChatWithUser('${foundUser.name}', '${foundUser.icon}', '${foundUser.uid}')">بدء المحادثة</button>
            </div>
        `;
    } else {
        if(!forcedId) resultDiv.innerHTML = '<p style="color:var(--danger); text-align:center;">المستخدم غير موجود</p>';
    }
};

window.startChatWithUser = async (otherName, otherIcon, otherUid) => {
    document.getElementById('user-search-modal').classList.add('hidden');
    const chatId = myUid < otherUid ? `${myUid}_${otherUid}` : `${otherUid}_${myUid}`;
    
    const myUpdate = { otherName, otherIcon, otherUid, lastMsg: '', lastMsgTime: Date.now() };
    const otherUpdate = { otherName: currentUser, otherIcon: localStorage.getItem('sa_icon'), otherUid: myUid, lastMsg: '', lastMsgTime: Date.now() };
    
    await update(ref(db, `user_chats/${myUid}/${chatId}`), myUpdate);
    await update(ref(db, `user_chats/${otherUid}/${chatId}`), otherUpdate);
    
    openChatRoom(chatId, otherName, otherIcon, otherUid);
};

let _activeChatMsgKeys = {};
let _voiceRecorder = null;
let _voiceChunks = [];
let _isVoiceRecording = false;
let _voiceChatId = null;
let _voiceOtherUid = null;

window.openChatRoom = (chatId, name, icon, uid) => {
    playSound('click');
    activeChatRoomId = chatId;
    _activeChatMsgKeys = {};
    const prefix = selectedRole === 'teacher' ? 't' : 's';
    const win = document.getElementById(`${prefix}-chat-window`);

    if (window.innerWidth < 768) {
        document.getElementById(`${prefix}-chat-sidebar`).classList.add('hidden');
    }
    win.classList.remove('hidden');

    win.innerHTML = `
        <div class="chat-header">
            <button class="icon-btn-small" onclick="closeChatWindow('${prefix}')"><i class="ph-bold ph-arrow-right"></i></button>
            <div class="avatar-frame mini-frame" style="width:38px;height:38px;font-size:1.1rem;border-width:1px;"><i class="fas ${icon}"></i></div>
            <div>
                <div style="font-weight:700;font-size:0.95rem;">${name}</div>
                <div id="chat-online-${chatId}" style="font-size:0.7rem;color:#25d366;">متصل</div>
            </div>
            <div style="margin-right:auto;display:flex;gap:10px;">
                <button class="icon-btn-small" onclick="copyProfileLinkFor('${uid}')" title="نسخ رابط"><i class="ph-bold ph-link"></i></button>
            </div>
        </div>
        <div class="chat-msgs-area" id="chat-msgs-${chatId}"></div>
        <div class="chat-input-area" id="chat-input-area-${chatId}">
            <label class="chat-img-attach-btn" title="إرسال صور">
                <i class="ph-bold ph-camera"></i>
                <input type="file" hidden accept="image/*" multiple onchange="sendChatImages(this,'${chatId}','${uid}')">
            </label>
            <input type="text" id="chat-input-${chatId}" placeholder="اكتب رسالة..."
                onkeypress="handleChatEnter(event,'${chatId}','${uid}')"
                oninput="toggleChatMicSend('${chatId}')"
                onfocus="handleChatInputFocus(this)">
            <button id="chat-send-btn-${chatId}" class="send-btn" style="display:none" onclick="sendChatMessage('${chatId}','${uid}')"><i class="ph-bold ph-paper-plane-tilt"></i></button>
            <button id="chat-mic-btn-${chatId}" class="send-btn" style="background:rgba(255,255,255,0.08);color:#aaa;" onclick="toggleVoiceRecord('${chatId}','${uid}')"><i class="ph-bold ph-microphone"></i></button>
        </div>
        <div id="voice-recording-bar-${chatId}" class="voice-recording-bar hidden">
            <div class="voice-wave-anim"><span></span><span></span><span></span><span></span><span></span></div>
            <span id="voice-timer-${chatId}" style="color:#ef4444;font-weight:bold;font-size:0.9rem;min-width:40px;">0:00</span>
            <button onclick="cancelVoiceRecord('${chatId}')" style="background:none;border:none;color:#ef4444;font-size:1.2rem;cursor:pointer;"><i class="ph-bold ph-x"></i></button>
            <button onclick="stopAndSendVoice('${chatId}','${uid}')" style="background:#25d366;border:none;color:#fff;padding:8px 16px;border-radius:20px;font-weight:bold;cursor:pointer;font-size:0.85rem;"><i class="ph-bold ph-paper-plane-tilt"></i> إرسال</button>
        </div>
    `;

    const msgContainer = document.getElementById(`chat-msgs-${chatId}`);
    let isFirstLoad = true;
    let prevCount = 0;

    onValue(ref(db, `chats/${chatId}`), (snap) => {
        msgContainer.innerHTML = '';
        _activeChatMsgKeys = {};
        if (!snap.exists()) { isFirstLoad = false; return; }

        const msgs = snap.val();
        const msgArr = Object.entries(msgs).map(([k, v]) => ({ ...v, _key: k })).sort((a, b) => a.timestamp - b.timestamp);

        let lastDateLabel = '';
        msgArr.forEach(msg => {
            const dateStr = new Date(msg.timestamp).toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' });
            if (dateStr !== lastDateLabel) {
                lastDateLabel = dateStr;
                const sep = document.createElement('div');
                sep.className = 'chat-date-separator';
                sep.innerText = dateStr;
                msgContainer.appendChild(sep);
            }
            _activeChatMsgKeys[msg._key] = true;
            appendChatMsg(msgContainer, msg, chatId, uid, name);
        });

        msgContainer.scrollTop = msgContainer.scrollHeight;

        if (!isFirstLoad && msgArr.length > prevCount) {
            const lastMsg = msgArr[msgArr.length - 1];
            if (lastMsg && lastMsg.sender !== myUid) {
                playSound('recv');
                showToast(name, lastMsg.type === 'image' ? '📷 صورة' : lastMsg.type === 'voice' ? '🎤 رسالة صوتية' : (lastMsg.text?.substring(0, 50) || ''), 'msg', 3500);
                update(ref(db, `chats/${chatId}/${lastMsg._key}`), { readBy: myUid });
            }
        }
        prevCount = msgArr.length;
        isFirstLoad = false;
    });

    update(ref(db, `users/${selectedRole}s/${currentUser}`), { online: true, lastSeen: Date.now() });
};

function appendChatMsg(container, msg, chatId, otherUid, otherName) {
    const isMe = msg.sender === myUid;
    const isDeleted = msg.deleted === true;

    const wrap = document.createElement('div');
    wrap.className = `wapp-msg-wrap ${isMe ? 'me' : 'them'}`;
    wrap.id = `msg-wrap-${msg._key}`;

    let content = '';
    if (isDeleted) {
        content = `<div class="wapp-msg deleted-msg"><i class="ph-bold ph-prohibit" style="color:#aaa;margin-left:5px;"></i><span style="color:#aaa;font-style:italic;">تم حذف هذه الرسالة</span></div>`;
    } else if (msg.type === 'images' && msg.images) {
        const imgs = msg.images;
        const grid = imgs.length === 1 ? 'one' : imgs.length === 2 ? 'two' : imgs.length === 3 ? 'three' : 'four';
        const imgHtml = imgs.map(src => `<img src="${src}" onclick="openImageViewer(this.src)" style="width:100%;height:100%;object-fit:cover;cursor:pointer;">`).join('');
        content = `<div class="wapp-msg"><div class="wapp-img-grid grid-${grid}">${imgHtml}</div>${buildMsgFooter(msg, isMe)}</div>`;
    } else if (msg.type === 'voice') {
        content = `<div class="wapp-msg">
            <div class="wapp-voice-player">
                <button class="voice-play-btn" onclick="toggleVoicePlay(this,'${msg._key}')"><i class="ph-bold ph-play"></i></button>
                <div class="voice-waveform">${generateWaveform()}</div>
                <span class="voice-duration">${msg.duration || '0:00'}</span>
                <audio id="audio-${msg._key}" src="${msg.text}" preload="metadata" onended="resetVoiceBtn('${msg._key}')"></audio>
            </div>
            ${buildMsgFooter(msg, isMe)}
        </div>`;
    } else {
        content = `<div class="wapp-msg"><div class="wapp-text">${makeLinksClickable(msg.text || '')}</div>${buildMsgFooter(msg, isMe)}</div>`;
    }

    wrap.innerHTML = content;

    if (!isDeleted && isMe) {
        wrap.addEventListener('contextmenu', (e) => { e.preventDefault(); showMsgContextMenu(e, msg._key, chatId, otherUid, msg.text, isMe); });
        wrap.addEventListener('touchstart', touchHoldHandler(wrap, msg._key, chatId, otherUid, msg.text, isMe), { passive: true });
    }

    container.appendChild(wrap);
}

function buildMsgFooter(msg, isMe) {
    const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const readIcon = isMe ? `<i class="ph-bold ph-checks" style="color:${msg.readBy ? '#53bdeb' : '#aaa'};font-size:0.85rem;margin-right:2px;"></i>` : '';
    return `<div class="msg-footer-row">${readIcon}<span class="msg-time-wapp">${time}</span></div>`;
}

function generateWaveform() {
    const bars = 20;
    let html = '';
    for (let i = 0; i < bars; i++) {
        const h = Math.random() * 20 + 4;
        html += `<div class="waveform-bar" style="height:${h}px"></div>`;
    }
    return html;
}

function touchHoldHandler(wrap, key, chatId, otherUid, text, isMe) {
    let holdTimer = null;
    return function(e) {
        holdTimer = setTimeout(() => { showMsgContextMenu(e.touches[0], key, chatId, otherUid, text, isMe); }, 600);
        wrap.addEventListener('touchend', () => clearTimeout(holdTimer), { once: true });
        wrap.addEventListener('touchmove', () => clearTimeout(holdTimer), { once: true });
    };
}

function showMsgContextMenu(e, msgKey, chatId, otherUid, text, isMe) {
    document.querySelectorAll('.msg-ctx-menu').forEach(el => el.remove());
    const menu = document.createElement('div');
    menu.className = 'msg-ctx-menu';
    menu.style.top = (e.clientY || e.pageY) + 'px';
    menu.style.left = (e.clientX || e.pageX) + 'px';
    const copyBtn = `<div class="ctx-item" onclick="navigator.clipboard.writeText('${(text||'').replace(/'/g,"\\'")}').then(()=>showToast('تم النسخ','','success',1500)); document.querySelector('.msg-ctx-menu').remove()"><i class="ph-bold ph-copy"></i> نسخ</div>`;
    const deleteBtn = isMe ? `<div class="ctx-item danger" onclick="deleteChatMsg('${chatId}','${msgKey}','${otherUid}'); document.querySelector('.msg-ctx-menu').remove()"><i class="ph-bold ph-trash"></i> حذف للجميع</div>` : '';
    menu.innerHTML = copyBtn + deleteBtn;
    document.body.appendChild(menu);
    setTimeout(() => { document.addEventListener('click', () => menu.remove(), { once: true }); }, 100);
}

window.deleteChatMsg = async (chatId, msgKey, otherUid) => {
    await update(ref(db, `chats/${chatId}/${msgKey}`), { deleted: true, text: '', type: 'text' });
    showToast('تم حذف الرسالة', '', 'success', 2000);
};

window.toggleChatMicSend = (chatId) => {
    const inp = document.getElementById(`chat-input-${chatId}`);
    const send = document.getElementById(`chat-send-btn-${chatId}`);
    const mic = document.getElementById(`chat-mic-btn-${chatId}`);
    if (!inp || !send || !mic) return;
    if (inp.value.trim()) { send.style.display = 'flex'; mic.style.display = 'none'; }
    else { send.style.display = 'none'; mic.style.display = 'flex'; }
};

window.toggleVoiceRecord = async (chatId, otherUid) => {
    if (_isVoiceRecording) { stopAndSendVoice(chatId, otherUid); return; }
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        _voiceRecorder = new MediaRecorder(stream);
        _voiceChunks = [];
        _voiceChatId = chatId;
        _voiceOtherUid = otherUid;
        _isVoiceRecording = true;
        const bar = document.getElementById(`voice-recording-bar-${chatId}`);
        bar.classList.remove('hidden');
        const micBtn = document.getElementById(`chat-mic-btn-${chatId}`);
        micBtn.style.background = '#ef4444';
        micBtn.style.color = '#fff';

        let seconds = 0;
        const timerEl = document.getElementById(`voice-timer-${chatId}`);
        const timerInt = setInterval(() => {
            seconds++;
            const m = Math.floor(seconds / 60);
            const s = seconds % 60;
            if (timerEl) timerEl.innerText = `${m}:${s < 10 ? '0' : ''}${s}`;
        }, 1000);
        _voiceRecorder._timerInt = timerInt;
        _voiceRecorder._seconds = () => seconds;

        _voiceRecorder.ondataavailable = (e) => { if (e.data.size > 0) _voiceChunks.push(e.data); };
        _voiceRecorder.start(100);
    } catch (e) {
        saAlert('لم يُسمح بالوصول للمايكروفون', 'error');
    }
};

window.cancelVoiceRecord = (chatId) => {
    if (_voiceRecorder) { clearInterval(_voiceRecorder._timerInt); _voiceRecorder.stop(); _voiceRecorder.stream?.getTracks().forEach(t => t.stop()); }
    _isVoiceRecording = false; _voiceChunks = [];
    const bar = document.getElementById(`voice-recording-bar-${chatId}`);
    if (bar) bar.classList.add('hidden');
    const micBtn = document.getElementById(`chat-mic-btn-${chatId}`);
    if (micBtn) { micBtn.style.background = 'rgba(255,255,255,0.08)'; micBtn.style.color = '#aaa'; }
};

window.stopAndSendVoice = async (chatId, otherUid) => {
    if (!_voiceRecorder || !_isVoiceRecording) return;
    const seconds = _voiceRecorder._seconds();
    clearInterval(_voiceRecorder._timerInt);

    return new Promise((resolve) => {
        _voiceRecorder.onstop = async () => {
            const blob = new Blob(_voiceChunks, { type: 'audio/webm' });
            const reader = new FileReader();
            reader.onload = async () => {
                const b64 = reader.result;
                const m = Math.floor(seconds / 60);
                const s = seconds % 60;
                const dur = `${m}:${s < 10 ? '0' : ''}${s}`;
                playSound('sent');
                await push(ref(db, `chats/${chatId}`), { sender: myUid, text: b64, type: 'voice', duration: dur, timestamp: Date.now() });
                await update(ref(db, `user_chats/${myUid}/${chatId}`), { lastMsg: '🎤 رسالة صوتية', lastMsgTime: Date.now() });
                await update(ref(db, `user_chats/${otherUid}/${chatId}`), { lastMsg: '🎤 رسالة صوتية', lastMsgTime: Date.now() });
                resolve();
            };
            reader.readAsDataURL(blob);
        };
        _voiceRecorder.stop();
        _voiceRecorder.stream?.getTracks().forEach(t => t.stop());
        _isVoiceRecording = false; _voiceChunks = [];
        const bar = document.getElementById(`voice-recording-bar-${chatId}`);
        if (bar) bar.classList.add('hidden');
        const micBtn = document.getElementById(`chat-mic-btn-${chatId}`);
        if (micBtn) { micBtn.style.background = 'rgba(255,255,255,0.08)'; micBtn.style.color = '#aaa'; }
    });
};

window.toggleVoicePlay = (btn, key) => {
    const audio = document.getElementById(`audio-${key}`);
    if (!audio) return;
    if (audio.paused) {
        document.querySelectorAll('audio').forEach(a => { if (a !== audio) { a.pause(); a.currentTime = 0; } });
        document.querySelectorAll('.voice-play-btn').forEach(b => b.innerHTML = '<i class="ph-bold ph-play"></i>');
        audio.play();
        btn.innerHTML = '<i class="ph-bold ph-pause"></i>';
    } else {
        audio.pause();
        btn.innerHTML = '<i class="ph-bold ph-play"></i>';
    }
};

window.resetVoiceBtn = (key) => {
    const btn = document.querySelector(`#msg-wrap-${key} .voice-play-btn`);
    if (btn) btn.innerHTML = '<i class="ph-bold ph-play"></i>';
};

window.sendChatImages = async (input, chatId, otherUid) => {
    if (!input.files || input.files.length === 0) return;
    const today = new Date().toDateString();
    const usageKey = `img_usage_${myUid}_${today}`;
    let count = parseInt(localStorage.getItem(usageKey) || '0');
    const files = Array.from(input.files).slice(0, 4);
    if (count + files.length > 10) { saAlert('تجاوزت حد الصور اليوم', 'error'); input.value = ''; return; }

    const images = [];
    for (const f of files) { images.push(await getBase64(f)); }
    playSound('sent');
    await push(ref(db, `chats/${chatId}`), { sender: myUid, images, type: 'images', timestamp: Date.now() });
    count += files.length;
    localStorage.setItem(usageKey, count);
    await update(ref(db, `user_chats/${myUid}/${chatId}`), { lastMsg: `📷 ${images.length} صور`, lastMsgTime: Date.now() });
    await update(ref(db, `user_chats/${otherUid}/${chatId}`), { lastMsg: `📷 ${images.length} صور`, lastMsgTime: Date.now() });
    input.value = '';
};

window.closeChatWindow = (prefix) => {
    playSound('click');
    const win = document.getElementById(`${prefix}-chat-window`);
    if (win) { win.classList.add('hidden'); win.innerHTML = ''; }
    const sidebar = document.getElementById(`${prefix}-chat-sidebar`);
    if (sidebar) sidebar.classList.remove('hidden');
    activeChatRoomId = null;
    _activeChatMsgKeys = {};
};

window.handleChatInputFocus = (input) => {
    if (window.innerWidth > 768) return;
    
    setTimeout(() => {
        input.scrollIntoView({ behavior: 'smooth', block: 'end' });
        const chatId = input.id.replace('chat-input-', '');
        const msgArea = document.getElementById(`chat-msgs-${chatId}`);
        if (msgArea) msgArea.scrollTop = msgArea.scrollHeight;
    }, 350);
};

window.handleChatEnter = (e, chatId, otherUid) => {
    if(e.key === 'Enter') sendChatMessage(chatId, otherUid);
};

window.sendChatMessage = async (chatId, otherUid) => {
    const input = document.getElementById(`chat-input-${chatId}`);
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;

    // Clear & disable immediately for snappy feel
    input.value = '';
    toggleChatMicSend(chatId);
    playSound('sent');

    const ts = Date.now();
    try {
        await push(ref(db, `chats/${chatId}`), {
            sender: myUid,
            senderName: currentUser,
            text: text,
            type: 'text',
            timestamp: ts
        });
        const shortMsg = text.substring(0, 60);
        await Promise.all([
            update(ref(db, `user_chats/${myUid}/${chatId}`),    { lastMsg: shortMsg, lastMsgTime: ts }),
            update(ref(db, `user_chats/${otherUid}/${chatId}`), { lastMsg: shortMsg, lastMsgTime: ts })
        ]);
    } catch(e) {
        console.error('Send failed:', e);
        input.value = text; // restore on error
        toggleChatMicSend(chatId);
        saAlert('فشل إرسال الرسالة، تحقق من الاتصال', 'error');
    }
};

window.sendChatImage = async (input, chatId, otherUid) => {
    if(input.files && input.files[0]) {
        const today = new Date().toDateString();
        const usageKey = `img_usage_${myUid}_${today}`;
        let count = parseInt(localStorage.getItem(usageKey) || '0');
        
        if(count >= 5) {
            saAlert("عفواً، لقد تجاوزت الحد الأقصى لإرسال الصور اليوم (5 صور).", "error");
            input.value = '';
            return;
        }
        
        const b64 = await getBase64(input.files[0]);
        playSound('sent');
        
        await push(ref(db, `chats/${chatId}`), {
            sender: myUid,
            text: b64,
            type: 'image',
            timestamp: Date.now()
        });
        
        count++;
        localStorage.setItem(usageKey, count);
        
        await update(ref(db, `user_chats/${myUid}/${chatId}`), { lastMsg: '📷 صورة', lastMsgTime: Date.now() });
        await update(ref(db, `user_chats/${otherUid}/${chatId}`), { lastMsg: '📷 صورة', lastMsgTime: Date.now() });
        
        input.value = '';
    }
};

window.copyProfileLinkFor = async (otherUid) => {
    playSound('click');
    if (!activeChatRoomId) {
        const url = `${window.location.href.split('?')[0]}?chat=${otherUid}`;
        navigator.clipboard.writeText(url).then(() => saAlert("تم نسخ رابط المستخدم!", "success"));
        return;
    }
    const roomId = activeChatRoomId;
    const myData = { username: currentUser };
    const otherSnap = await get(ref(db, `users/students/${otherUid}`)).catch(() => null)
        || await get(ref(db, `users/teachers/${otherUid}`)).catch(() => null);
    const otherName = otherSnap?.val()?.username || 'مستخدم';
    const otherIcon = otherSnap?.val()?.icon || 'fa-user';

    await update(ref(db, `chat_room_meta/${roomId}`), {
        members: [myUid, otherUid],
        names: { [myUid]: currentUser, [otherUid]: otherName },
        icons: { [myUid]: localStorage.getItem('sa_icon') || 'fa-user', [otherUid]: otherIcon }
    });

    const url = `${window.location.href.split('?')[0]}?room=${roomId}`;
    if (navigator.share) {
        navigator.share({ title: `محادثة مع ${otherName}`, text: `افتح محادثتنا على SA EDU`, url }).catch(() => {});
    } else {
        navigator.clipboard.writeText(url).then(() => saAlert("تم نسخ رابط الدردشة المباشر!", "success"));
    }
};

window.filterChats = (prefix, term) => {
    const items = document.querySelectorAll(`#${prefix}-chat-list .chat-item`);
    items.forEach(item => {
        const name = item.querySelector('div[style*="font-weight:bold"]').innerText.toLowerCase();
        if(name.includes(term.toLowerCase())) item.classList.remove('hidden');
        else item.classList.add('hidden');
    });
};

window.openReeseCompose = () => {
    document.getElementById('reese-compose-modal').classList.add('open');
    const icon = localStorage.getItem('sa_icon');
    const color = selectedRole === 'teacher' ? 'var(--accent-gold)' : 'var(--accent-primary)';
    const frame = document.getElementById('compose-avatar');
    frame.innerHTML = `<i class="fas ${icon}"></i>`;
    frame.style.color = color; frame.style.borderColor = color;
    document.getElementById('compose-name').innerText = currentUser;
    reeseImages = []; renderReeseMediaPreview();

    const container = document.getElementById('ai-reese-suggestions');
    container.classList.remove('hidden');

    // Show cached suggestions instantly if available
    if (_cachedReeseSuggestions.length > 0) {
        container.innerHTML = '';
        const catIcons = ['✨','💡','🔥','🎯'];
        _cachedReeseSuggestions.slice(0,4).forEach((sug, i) => {
            const chip = document.createElement('div');
            chip.className = 'suggestion-chip';
            chip.innerHTML = `<span style="font-size:1rem;">${catIcons[i]||'✨'}</span> ${sug}`;
            chip.onclick = () => {
                document.getElementById('reese-text-input').value = sug;
                document.getElementById('reese-text-input').focus();
            };
            container.appendChild(chip);
        });
        // Refresh in background silently
        setTimeout(() => { loadReeseAiSuggestionsAuto().catch(()=>{}); }, 100);
    } else {
        container.innerHTML = `<div class="suggestion-chip loading-chip"><i class="fas fa-circle-notch fa-spin"></i> جاري تحميل الاقتراحات...</div>`;
        setTimeout(() => { loadReeseAiSuggestionsAuto().catch(()=>{}); }, 0);
    }
};

// Pre-load suggestions immediately on app start (background)
function _preloadReeseSuggestions() {
    setTimeout(async () => {
        try {
            const roleAr = selectedRole === 'teacher' ? 'معلم' : 'طالب';
            const categories = selectedRole === 'teacher'
                ? ['تحفيز الطلاب','نصيحة تعليمية','فكرة درس مبتكرة','سؤال تفاعلي']
                : ['تحفيز ذاتي','نصيحة مذاكرة','إنجاز شخصي','سؤال للمجتمع'];
            const prompt = `اقترح 4 منشورات قصيرة لـ ${roleAr} على منصة تعليمية. الفئات: ${categories.join(', ')}. أعد JSON array فقط من 4 strings عربية. كل منشور أقل من 130 حرف.`;
            let text = await callPollinationsAI(prompt);
            text = text.replace(/\`\`\`json/g,'').replace(/\`\`\`/g,'').trim();
            const first = text.indexOf('['), last = text.lastIndexOf(']');
            if (first !== -1 && last !== -1) text = text.substring(first, last+1);
            const arr = JSON.parse(text);
            if (Array.isArray(arr) && arr.length > 0) {
                _cachedReeseSuggestions = arr.filter(s => typeof s === 'string' && s.trim().length > 5);
            }
        } catch(e) {}
    }, 3000);
}

async function loadReeseAiSuggestionsAuto() {
    const container = document.getElementById('ai-reese-suggestions');
    if (!container) return;

    const roleAr = selectedRole === 'teacher' ? 'معلم' : 'طالب';
    const prevStr = _lastReeseSuggestions.length > 0 ? `اقتراحات سابقة (لا تكررها أبداً): ${_lastReeseSuggestions.join(' | ')}` : '';
    const categories = selectedRole === 'teacher'
        ? ['تحفيز الطلاب', 'نصيحة تعليمية', 'فكرة درس مبتكرة', 'سؤال تفاعلي للطلاب']
        : ['تحفيز ذاتي', 'نصيحة مذاكرة', 'إنجاز شخصي', 'سؤال للمجتمع'];

    const prompt = `أنت مساعد منصة SA EDU التعليمية. اقترح 4 منشورات قصيرة وذكية لـ ${roleAr} على منصة تعليمية اجتماعية. كل اقتراح يجب أن يكون في فئة مختلفة: ${categories.join(', ')}. المنشورات تكون طبيعية وواقعية ومميزة وغير رسمية. ${prevStr}. أعد فقط JSON array من 4 strings باللغة العربية. كل منشور أقل من 130 حرف. لا تكتب أي شيء آخر.`;

    try {
        let text = await callPollinationsAI(prompt);
        text = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const first = text.indexOf('[');
        const last = text.lastIndexOf(']');
        if (first !== -1 && last !== -1) text = text.substring(first, last + 1);
        let suggestions = [];
        try { suggestions = JSON.parse(text); } catch(e) { suggestions = [text]; }
        if (!Array.isArray(suggestions)) suggestions = [text];

        suggestions = suggestions.filter(s => typeof s === 'string' && s.trim().length > 5);
        _lastReeseSuggestions = suggestions.slice(0, 4);
        _cachedReeseSuggestions = suggestions.slice(0, 4); // update cache

        container.innerHTML = '';
        const catIcons = ['✨', '💡', '🔥', '🎯'];
        suggestions.slice(0, 4).forEach((sug, i) => {
            const chip = document.createElement('div');
            chip.className = 'suggestion-chip';
            chip.innerHTML = `<span style="font-size:1rem;">${catIcons[i] || '✨'}</span> ${sug}`;
            chip.onclick = () => {
                document.getElementById('reese-text-input').value = sug;
                document.getElementById('reese-text-input').focus();
            };
            container.appendChild(chip);
        });
    } catch(e) {
        container.innerHTML = '<div class="suggestion-chip" style="opacity:0.5; pointer-events:none;"><i class="fas fa-wifi-slash"></i> تعذر تحميل الاقتراحات</div>';
    }
}

window.closeReeseCompose = () => {
    playSound('click');
    document.getElementById('reese-compose-modal').classList.remove('open');
    document.getElementById('reese-text-input').value = '';
    document.getElementById('reese-text-input').style.height = 'auto';
    reeseImages = []; renderReeseMediaPreview();
    // Auto-refresh suggestions in background for next open
    setTimeout(() => { loadReeseAiSuggestionsAuto().catch(()=>{}); }, 500);
};

window.handleReeseImageSelect = async (input) => {
    if (input.files) {
        if (input.files.length + reeseImages.length > 2) {
            saAlert("يمكنك اختيار صورتين فقط كحد أقصى", "error");
            return;
        }
        for (let i = 0; i < input.files.length; i++) {
            const base64 = await getBase64(input.files[i]);
            reeseImages.push(base64);
        }
        renderReeseMediaPreview();
        input.value = '';
    }
};

function renderReeseMediaPreview() {
    const div = document.getElementById('reese-media-preview');
    div.innerHTML = '';
    if (reeseImages.length > 0) div.classList.remove('hidden'); else div.classList.add('hidden');
    reeseImages.forEach((img, idx) => {
        const item = document.createElement('div');
        item.className = 'preview-item';
        item.innerHTML = `<img src="${img}"><div class="remove-preview" onclick="removeReeseImage(${idx})"><i class="fas fa-times"></i></div>`;
        div.appendChild(item);
    });
}

window.removeReeseImage = (idx) => { reeseImages.splice(idx, 1); renderReeseMediaPreview(); };

window.publishReese = async () => {
    const text = document.getElementById('reese-text-input').value.trim();
    if(!text && reeseImages.length === 0) return saAlert("اكتب شيئاً أو أضف صورة", "error");
    playSound('sent');
    const postData = { author: currentUser, role: selectedRole, icon: localStorage.getItem('sa_icon'), content: text, images: reeseImages, timestamp: Date.now(), likes: 0 };
    await push(ref(db, 'posts'), postData);
    closeReeseCompose(); saAlert("تم النشر بنجاح!", "success");
};

window.loadReesePosts = (prefix) => {
    const container = document.getElementById(`reese-feed-container-${prefix}`);
    container.innerHTML = getMultipleSkeletons(3);
    onValue(ref(db, 'posts'), (snap) => {
        container.innerHTML = '';
        const data = snap.val();
        if(!data) return container.innerHTML = getEmptyStateHTML('posts');
        const hiddenPosts = JSON.parse(localStorage.getItem(`hidden_posts_${currentUser}`) || '[]');
        const posts = Object.entries(data).map(([k,v]) => ({id:k, ...v})).sort((a,b) => b.timestamp - a.timestamp);
        let visibleCount = 0;
        posts.forEach(post => {
            if(hiddenPosts.includes(post.id)) return;
            if(isMyPostsView && post.author !== currentUser) return;
            visibleCount++;
            const date = new Date(post.timestamp).toLocaleDateString();
            const roleColor = post.role === 'teacher' ? 'var(--accent-gold)' : 'var(--accent-primary)';
            const isAuthor = post.author === currentUser;
            const likedPosts = JSON.parse(localStorage.getItem(`liked_posts_${currentUser}`) || '[]');
            const isLiked = likedPosts.includes(post.id);
            let imagesHtml = '';
            if(post.images && post.images.length > 0) {
                const gridClass = post.images.length === 1 ? 'one-img' : 'two-imgs';
                imagesHtml = `<div class="reese-images-grid ${gridClass}">${post.images.map(img => `<img src="${img}" class="reese-post-img" onclick="openImageViewer(this.src)">`).join('')}</div>`;
            }
            const div = document.createElement('div');
            div.className = 'reese-card';
            div.id = `post-${post.id}`;
            div.innerHTML = `
                <div class="reese-header">
                    <div class="reese-user">
                        <div class="avatar-frame" style="width:40px; height:40px; font-size:1.2rem; border-width:1px; margin:0; border-color:${roleColor}; color:${roleColor};">
                            <i class="fas ${post.icon}"></i>
                        </div>
                        <div><div style="font-weight:bold; font-size:0.95rem;">${post.author}</div><div style="font-size:0.7rem; color:#666;">${date}</div></div>
                    </div>
                    <div style="display:flex; gap:10px;">
                        ${isAuthor ? `<button onclick="deleteReese('${post.id}')" title="حذف نهائي" style="background:none; border:none; color:var(--danger); cursor:pointer; font-size:1rem;"><i class="fas fa-trash-alt"></i></button>` : ''}
                        <button onclick="hideReese('${post.id}')" title="إخفاء من هنا" style="background:none; border:none; color:#666; cursor:pointer; font-size:1rem;"><i class="fas fa-eye-slash"></i></button>
                    </div>
                </div>
                <div class="reese-content">${makeLinksClickable(post.content)}</div>${imagesHtml}
                <div class="reese-actions">
                    <button class="reese-btn ${isLiked ? 'liked' : ''}" onclick="likeReese('${post.id}', ${post.likes || 0})"><i class="fas ${isLiked ? 'fa-thumbs-up' : 'fa-thumbs-up'}" style="font-size:1.3rem;"></i> <span style="font-size:1.1rem;">${post.likes || 0}</span></button>
                    <button class="reese-btn" onclick="shareReese('${post.id}')"><i class="fas fa-share"></i> مشاركة</button>
                </div>`;
            container.appendChild(div); { const _ad = createAdBanner(); if (_ad) container.appendChild(_ad); }
        });
        if(visibleCount === 0) container.innerHTML = getEmptyStateHTML('posts');
    });
};

window.toggleMyPostsView = () => {
    playSound('click');
    isMyPostsView = !isMyPostsView;
    const prefix = selectedRole === 'teacher' ? 't' : 's';
    const icon = document.getElementById(`${prefix}-eraser-icon`);
    if(isMyPostsView) { icon.style.color = 'var(--danger)'; } else { icon.style.color = '#aaa'; }
    loadReesePosts(prefix);
    saAlert(isMyPostsView ? "عرض منشوراتك فقط (وضع الإدارة)" : "عرض كل المنشورات", "info");
};

window.likeReese = async (id, currentLikes) => {
    playSound('like');
    const likedPosts = JSON.parse(localStorage.getItem(`liked_posts_${currentUser}`) || '[]');
    const index = likedPosts.indexOf(id);
    let newLikes = currentLikes;
    if(index === -1) { likedPosts.push(id); newLikes++; } else { likedPosts.splice(index, 1); newLikes--; }
    localStorage.setItem(`liked_posts_${currentUser}`, JSON.stringify(likedPosts));
    await update(ref(db, `posts/${id}`), { likes: newLikes });
};

window.hideReese = (id) => {
    saConfirm("إخفاء هذا المنشور من صفحتك؟", () => {
        const hiddenPosts = JSON.parse(localStorage.getItem(`hidden_posts_${currentUser}`) || '[]');
        hiddenPosts.push(id);
        localStorage.setItem(`hidden_posts_${currentUser}`, JSON.stringify(hiddenPosts));
        loadReesePosts(selectedRole === 'teacher' ? 't' : 's');
    });
};

window.deleteReese = (id) => {
    saConfirm("حذف هذا المنشور نهائياً؟ لا يمكن التراجع.", async () => {
        await remove(ref(db, `posts/${id}`)); saAlert("تم الحذف", "success");
    });
};

window.openImageViewer = (src) => {
    const modal = document.createElement('div');
    modal.style = "position:fixed; inset:0; background:rgba(0,0,0,0.9); z-index:9999; display:flex; justify-content:center; align-items:center; cursor:pointer;";
    modal.innerHTML = `<img src="${src}" style="max-width:95%; max-height:95%; border-radius:10px;">`;
    modal.onclick = () => modal.remove();
    document.body.appendChild(modal);
};

window.shareReese = (id) => {
    playSound('click');
    const url = `${window.location.href.split('?')[0]}?postId=${id}`;
    if(navigator.share) { navigator.share({ title: 'Reese SA', text: 'شاهد هذا المنشور', url: url }).catch(e=>console.log(e)); } 
    else { navigator.clipboard.writeText(url).then(() => saAlert("تم نسخ رابط المنشور", "success")); }
};

window.generateAiReese = async () => {
    const container = document.getElementById('ai-reese-suggestions');
    container.classList.remove('hidden');
    container.innerHTML = '<div class="suggestion-chip loading-chip"><i class="fas fa-circle-notch fa-spin"></i> جاري توليد اقتراحات جديدة...</div>';
    // Non-blocking async
    loadReeseAiSuggestionsAuto().catch(() => {
        container.innerHTML = '<div class="suggestion-chip" style="opacity:0.5;pointer-events:none;"><i class="fas fa-wifi-slash"></i> تعذر تحميل الاقتراحات</div>';
    });
};

function generateChatId() { return Date.now().toString(36) + Math.random().toString(36).substr(2); }

window.startNewChat = (prefix) => {
    playSound('click');
    currentChatId = generateChatId(); currentChatMessages = []; isIncognito = false;
    document.getElementById(`${prefix}-ai-msgs`).innerHTML = ''; 
    document.getElementById(`${prefix}-incognito-btn`).classList.remove('active');
    window.toggleAiSendMic(prefix, '');
    renderAiWelcome(prefix); toggleHistory(false);
};

window.renderAiWelcome = (prefix) => {
    const msgs = document.getElementById(`${prefix}-ai-msgs`);
    const firstName = currentUser.split(' ')[0];

    const teacherChipSets = [
        [
            { icon: 'fa-flask', label: 'إنشاء اختبار', prompt: 'أنشئ اختبار عن الكيمياء العضوية' },
            { icon: 'fa-book', label: 'تحضير درس', prompt: 'اكتب خطة درس متكاملة عن التاريخ الحديث' },
            { icon: 'fa-users', label: 'تفاعل الطلاب', prompt: 'كيف أجعل الحصة تفاعلية أكثر؟' },
            { icon: 'fa-chart-bar', label: 'أساليب تقييم', prompt: 'اقترح لي أساليب تقييم مبتكرة' },
        ],
        [
            { icon: 'fa-pen', label: 'تصحيح إجابات', prompt: 'كيف أصحح إجابات الطلاب بعدالة؟' },
            { icon: 'fa-bullhorn', label: 'تحفيز الطلاب', prompt: 'أعطني أفكاراً لتحفيز الطلاب على المشاركة' },
            { icon: 'fa-calendar', label: 'جدول مراجعة', prompt: 'صمم لي جدول مراجعة شهري للمادة' },
            { icon: 'fa-lightbulb', label: 'فكرة نشاط', prompt: 'اقترح نشاطاً تعليمياً مميزاً للفصل' },
        ],
        [
            { icon: 'fa-comments', label: 'أسئلة نقاش', prompt: 'اكتب أسئلة نقاش مثيرة للتفكير عن البيئة' },
            { icon: 'fa-star', label: 'أفضل الممارسات', prompt: 'ما أفضل ممارسات التعليم الحديث؟' },
            { icon: 'fa-file-alt', label: 'ملخص للطلاب', prompt: 'لخص درس الضوء والبصريات بأسلوب بسيط' },
            { icon: 'fa-brain', label: 'خرائط ذهنية', prompt: 'ساعدني في إنشاء خريطة ذهنية عن العلوم' },
        ],
    ];

    const studentChipSets = [
        [
            { icon: 'fa-atom', label: 'شرح درس', prompt: 'اشرح لي قانون نيوتن الثاني ببساطة' },
            { icon: 'fa-history', label: 'تلخيص', prompt: 'لخص لي أحداث الحرب العالمية الأولى' },
            { icon: 'fa-clock', label: 'تنظيم الوقت', prompt: 'ساعدني في تنظيم وقت المذاكرة' },
            { icon: 'fa-dna', label: 'مقارنة علمية', prompt: 'ما الفرق بين الخلية الحيوانية والنباتية؟' },
        ],
        [
            { icon: 'fa-calculator', label: 'حل رياضيات', prompt: 'اشرح لي حل المعادلات التربيعية خطوة بخطوة' },
            { icon: 'fa-book-open', label: 'فهم النص', prompt: 'ساعدني في تحليل نص أدبي' },
            { icon: 'fa-flask', label: 'تجربة علمية', prompt: 'اشرح لي كيف تعمل عملية التمثيل الضوئي' },
            { icon: 'fa-globe', label: 'جغرافيا', prompt: 'أخبرني عن أهم الأنهار في العالم' },
        ],
        [
            { icon: 'fa-pencil-alt', label: 'تدريب كتابة', prompt: 'ساعدني في كتابة مقال عن التكنولوجيا' },
            { icon: 'fa-question-circle', label: 'أسئلة اختبار', prompt: 'اصنع لي أسئلة تدريبية على درس الكيمياء' },
            { icon: 'fa-lightbulb', label: 'نصائح مذاكرة', prompt: 'أعطني أفضل النصائح لتذكر المعلومات' },
            { icon: 'fa-chart-line', label: 'تحسين نتائج', prompt: 'كيف أحسن نتائجي في الامتحانات؟' },
        ],
    ];

    const chipSets = selectedRole === 'teacher' ? teacherChipSets : studentChipSets;
    const roleDesc = selectedRole === 'teacher'
        ? 'إنشاء اختبارات، تحضير دروس، وإدارة طلابك بذكاء.'
        : 'شرح دروس، حل مسائل، وتلخيص المواد الدراسية.';

    let currentSetIdx = Math.floor(Math.random() * chipSets.length);

    function buildChips(setIdx) {
        return chipSets[setIdx].map(c =>
            `<div class="ai-chip-v2" onclick="window._selectAiChip('${prefix}', '${c.prompt.replace(/'/g,"\\'")}', this)">
                <i class="fas ${c.icon}"></i><span>${c.label}</span>
            </div>`
        ).join('');
    }

    msgs.innerHTML = `
        <div class="ai-welcome-screen">
            <div class="ai-avatar-gemini">
                <div class="ai-avatar-gemini-inner"><i class="fas fa-wand-magic-sparkles"></i></div>
            </div>
            <h3 class="ai-welcome-title">مرحباً ${firstName} 👋</h3>
            <p class="ai-welcome-text">أنا <strong>SA AI</strong> — مساعدك الذكي.<br>${roleDesc}</p>
            <div class="ai-welcome-chips-grid" id="${prefix}-chips-grid">
                ${buildChips(currentSetIdx)}
            </div>
        </div>`;

    // Store state on grid element for chip rotation
    const grid = document.getElementById(`${prefix}-chips-grid`);
    grid._setIdx = currentSetIdx;
    grid._chipSets = chipSets;
    grid._prefix = prefix;
};

window._selectAiChip = (prefix, prompt, chipEl) => {
    // Rotate chips to next set
    const grid = document.getElementById(`${prefix}-chips-grid`);
    if (grid) {
        const sets = grid._chipSets;
        if (sets) {
            grid._setIdx = (grid._setIdx + 1) % sets.length;
            const newIdx = grid._setIdx;
            // Animate out then swap
            grid.style.opacity = '0';
            grid.style.transform = 'translateY(8px)';
            setTimeout(() => {
                grid.innerHTML = sets[newIdx].map(c =>
                    `<div class="ai-chip-v2" onclick="window._selectAiChip('${prefix}', '${c.prompt.replace(/'/g,"\\'")}', this)">
                        <i class="fas ${c.icon}"></i><span>${c.label}</span>
                    </div>`
                ).join('');
                grid._setIdx = newIdx;
                grid.style.opacity = '1';
                grid.style.transform = 'translateY(0)';
            }, 200);
        }
    }
    // Fill input and send
    const input = document.getElementById(`${prefix}-ai-input`);
    if (input) {
        input.value = prompt;
        window.toggleAiSendMic(prefix, prompt);
        // Auto-send
        setTimeout(() => window.sendAiMsg(prefix), 100);
    }
};

window.fillAiInput = (prefix, text) => {
    const input = document.getElementById(`${prefix}-ai-input`);
    if (input) {
        input.value = text;
        window.toggleAiSendMic(prefix, text);
        input.focus();
    }
};

window.toggleIncognito = (prefix) => {
    playSound('click');
    isIncognito = !isIncognito;
    document.getElementById(`${prefix}-incognito-btn`).classList.toggle('active', isIncognito);
    if(isIncognito) saAlert("الوضع المخفي: لن يتم حفظ هذه المحادثة في السجل", "info");
    else saAlert("تم إيقاف الوضع المخفي", "info");
};

function saveChatToLocal() {
    if(isIncognito || currentChatMessages.length === 0) return;
    const storageKey = `sa_chat_history_${currentUser}`;
    let history = JSON.parse(localStorage.getItem(storageKey) || '[]');
    const existingIndex = history.findIndex(c => c.id === currentChatId);
    const firstUserMsg = currentChatMessages.find(m => m.role === 'user');
    const title = firstUserMsg ? (firstUserMsg.content.substring(0, 30) + '...') : 'محادثة جديدة';
    const chatObj = { id: currentChatId, title: title, timestamp: Date.now(), messages: currentChatMessages };
    
    if(existingIndex > -1) { 
        history[existingIndex] = chatObj; 
    } else { 
        history.unshift(chatObj); 
    }
    
    localStorage.setItem(storageKey, JSON.stringify(history));
}

window.toggleHistory = (show) => {
    playSound('click');
    const sidebar = document.getElementById('ai-history-sidebar');
    if(show) { 
        renderHistoryList(); 
        sidebar.classList.add('open'); 
    } else { 
        sidebar.classList.remove('open'); 
    }
};

function renderHistoryList() {
    const list = document.getElementById('ai-history-list');
    const history = JSON.parse(localStorage.getItem(`sa_chat_history_${currentUser}`) || '[]');
    list.innerHTML = '';
    if(history.length === 0) { list.innerHTML = '<p style="color:#666; text-align:center; margin-top:20px;">لا يوجد سجل محادثات</p>'; return; }
    history.forEach(chat => {
        const item = document.createElement('div');
        item.className = 'history-item';
        item.innerHTML = `<div onclick="loadLocalChat('${chat.id}')"><div class="history-title">${chat.title}</div><span class="history-date">${new Date(chat.timestamp).toLocaleDateString()}</span></div><i class="fas fa-trash" style="color:#666; font-size:0.8rem; padding:5px;" onclick="deleteLocalChat('${chat.id}')"></i>`;
        list.appendChild(item);
    });
}

window.loadLocalChat = (id) => {
    const history = JSON.parse(localStorage.getItem(`sa_chat_history_${currentUser}`) || '[]');
    const chat = history.find(c => c.id === id);
    if(chat) {
        currentChatId = chat.id; currentChatMessages = chat.messages; isIncognito = false;
        const prefix = selectedRole === 'teacher' ? 't' : 's';
        document.getElementById(`${prefix}-ai-msgs`).innerHTML = '';
        currentChatMessages.forEach(msg => { renderMessageUI(prefix, msg.role, msg.content, msg.image); });
        toggleHistory(false);
        window.toggleAiSendMic(prefix, document.getElementById(`${prefix}-ai-input`)?.value || '');
    }
};

window.deleteLocalChat = (id) => {
    event.stopPropagation();
    saConfirm("حذف هذه المحادثة من السجل؟", () => {
        const storageKey = `sa_chat_history_${currentUser}`;
        let history = JSON.parse(localStorage.getItem(storageKey) || '[]');
        history = history.filter(c => c.id !== id);
        localStorage.setItem(storageKey, JSON.stringify(history));
        renderHistoryList();
        if(currentChatId === id) startNewChat(selectedRole === 'teacher' ? 't' : 's');
    });
};

window.shareCurrentChat = async () => {
    playSound('click');
    if(currentChatMessages.length === 0) return saAlert("لا يمكن مشاركة محادثة فارغة", "info");
    saAlert("جاري إنشاء رابط للمشاركة...", "info");
    const shareRef = push(ref(db, 'shared_chats'));
    await set(shareRef, { author: currentUser, timestamp: Date.now(), messages: currentChatMessages });
    const shareLink = `${window.location.href.split('?')[0]}?shareId=${shareRef.key}`;
    navigator.clipboard.writeText(shareLink).then(() => { saAlert("تم نسخ رابط المحادثة! أرسله لمن تريد.", "success"); });
};

window.loadSharedChat = async (shareId, prefix) => {
    const msgs = document.getElementById(`${prefix}-ai-msgs`);
    msgs.innerHTML = '<div style="text-align:center;"><i class="fas fa-spinner fa-spin"></i> جاري استرجاع المحادثة المشاركة...</div>';
    const snap = await get(ref(db, `shared_chats/${shareId}`));
    if(snap.exists()) {
        const data = snap.val();
        currentChatMessages = data.messages || []; currentChatId = generateChatId(); isIncognito = false; saveChatToLocal();
        msgs.innerHTML = `<div style="text-align:center; background:#222; padding:5px; margin-bottom:10px; font-size:0.8rem; border-radius:10px; color:#aaa;">تم استرجاع محادثة مشاركة من ${data.author || 'مجهول'}</div>`;
        currentChatMessages.forEach(msg => { renderMessageUI(prefix, msg.role, msg.content, msg.image); });
        window.history.replaceState({}, document.title, window.location.pathname);
    } else { saAlert("رابط المشاركة غير صالح أو منتهي", "error"); startNewChat(prefix); }
};

function formatAiResponseText(text) {
    if(!text) return '';
    let safeText = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    safeText = safeText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    safeText = safeText.replace(/```(.*?)```/gs, '<pre><code>$1</code></pre>');
    safeText = safeText.replace(/`(.*?)`/g, '<code>$1</code>');
    safeText = safeText.replace(/^\s*-\s+(.*)$/gm, '<li>$1</li>');
    if(safeText.includes('<li>')) {
        safeText = safeText.replace(/((<li>.*<\/li>\s*)+)/g, '<ul>$1</ul>');
    }
    safeText = safeText.replace(/\n/g, '<br>');
    return makeLinksClickable(safeText);
}

function renderMessageUI(prefix, role, text, imgB64) {
    const msgs = document.getElementById(`${prefix}-ai-msgs`);
    if (!msgs) return;

    if (role === 'ai') {
        // AI: full width like ChatGPT with platform logo avatar
        const wrap = document.createElement('div');
        wrap.className = 'ai-full-msg';

        // Avatar row
        const avatarRow = document.createElement('div');
        avatarRow.className = 'ai-msg-avatar-row';
        avatarRow.innerHTML = `<img src="https://i.postimg.cc/BQQb5YDn/MOWU-DESIGN.png" class="ai-msg-logo-avatar" alt="SA AI" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><div class="ai-avatar-gemini" style="display:none"><div class="ai-avatar-gemini-inner"><i class="fas fa-wand-magic-sparkles"></i></div></div><span class="ai-sender-label">SA AI</span>`;
        wrap.appendChild(avatarRow);

        const content = document.createElement('div');
        content.className = 'ai-full-content';
        if (text) content.innerHTML = formatDeepLinks(formatAiResponseText(text));

        if (imgB64) {
            const img = document.createElement('img');
            img.src = imgB64.startsWith('data:') ? imgB64 : `data:image/jpeg;base64,${imgB64}`;
            img.style.cssText = 'max-width:100%;border-radius:10px;margin-top:10px;display:block;';
            content.appendChild(img);
        }

        wrap.appendChild(content);

        if (text) {
            const actions = document.createElement('div');
            actions.className = 'ai-full-actions';
            const safeText = text.replace(/`/g,"'");
            actions.innerHTML = `
                <button class="ai-act-btn like-btn" title="إعجاب" onclick="this.classList.toggle('liked')">
                    <i class="ph-bold ph-thumbs-up"></i>
                </button>
                <button class="ai-act-btn" title="نسخ" onclick="navigator.clipboard.writeText(\`${safeText.substring(0,2000)}\`).then(()=>showToast('تم النسخ','','success',2000))">
                    <i class="ph-bold ph-copy"></i>
                </button>
                <button class="ai-act-btn" title="مشاركة" onclick="(()=>{ if(navigator.share) navigator.share({text:\`${safeText.substring(0,200)}\`}); else navigator.clipboard.writeText(\`${safeText.substring(0,300)}\`).then(()=>showToast('تم النسخ','','success',2000)); })()">
                    <i class="ph-bold ph-share-network"></i>
                </button>
            `;
            wrap.appendChild(actions);
        }

        msgs.appendChild(wrap);
    } else {
        // User: bubble on right
        const wrap = document.createElement('div');
        wrap.className = 'chat-msg-wrap user';

        const div = document.createElement('div');
        div.className = 'chat-msg user';
        div.innerHTML = makeLinksClickable(text || '');

        if (imgB64) {
            const img = document.createElement('img');
            img.src = imgB64.startsWith('data:') ? imgB64 : `data:image/jpeg;base64,${imgB64}`;
            div.appendChild(img);
        }

        wrap.appendChild(div);
        msgs.appendChild(wrap);
    }

    msgs.scrollTo({ top: msgs.scrollHeight, behavior: 'smooth' });
}

function loadTeacherTests() {
    const list = document.getElementById('t-tests-list');
    const resultSelect = document.getElementById('t-result-select');
    list.innerHTML = getMultipleSkeletons(3);
    onValue(ref(db, 'tests'), (snap) => {
        list.innerHTML = ''; resultSelect.innerHTML = '<option>اختر الاختبار للعرض</option>';
        const data = snap.val() || {};
        let count = 0;
        Object.entries(data).forEach(([key, val]) => {
            if (val.teacher === currentUser) {
                count++;
                const opt = document.createElement('option'); opt.value = key; opt.innerText = val.title; resultSelect.appendChild(opt);
                const hiddenStyle = val.isHidden ? 'opacity:0.6; border:1px dashed #666;' : '';
                const cardWrapper = document.createElement('div'); cardWrapper.className = 'card-wrapper';
                cardWrapper.setAttribute('data-exam-id', key);
                const subjectBadge = val.subject ? `<span class="subject-badge">${val.subject}</span>` : '';
                cardWrapper.innerHTML = `
                    <div class="mini-card" data-subj="${val.subject||''}" style="${hiddenStyle}">
                        <div class="card-header">
                            <div style="flex:1;min-width:0;"><h3 class="card-title">${val.title}</h3>
                            <div class="card-meta">${subjectBadge}<span style="color:#555">${getGradeLabel(val.grade)}</span><span style="color:#333">•</span><i class="fas fa-clock" style="font-size:.6rem;color:#444"></i>${val.duration}د</div></div>
                            <div class="teacher-badge" style="${val.isHidden?'background:rgba(239,68,68,.1);color:#f87171;border-color:rgba(239,68,68,.2)':''}">
                                ${val.isHidden?'<i class="fas fa-eye-slash" style="font-size:.7rem"></i> مخفي':'<span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#34d399;margin-left:5px"></span>نشط'}
                            </div>
                        </div>
                        <div class="icon-actions">
                            <button class="action-icon edit" onclick="editTest('${key}')" title="تعديل"><i class="fas fa-pen"></i></button>
                            <button class="action-icon share" onclick="shareTest('${val.title}', '${key}')" title="مشاركة"><i class="fas fa-share-alt"></i></button>
                            <button class="action-icon gold" onclick="toggleTestVisibility('${key}', ${!val.isHidden})" title="إخفاء/إظهار"><i class="fas fa-eye${val.isHidden ? '' : '-slash'}"></i></button>
                            <button class="action-icon results-icon" onclick="openResultsTab('${key}')" title="النتائج"><i class="fas fa-chart-bar"></i></button>
                            <button class="action-icon delete" onclick="deleteTest('${key}')" title="حذف"><i class="fas fa-trash"></i></button>
                        </div>
                    </div>`;
                list.appendChild(cardWrapper); { const _ad = createAdBanner(); if (_ad) list.appendChild(_ad); }
            }
        });
        if(count === 0) list.innerHTML = getEmptyStateHTML('exams');
    });
    resultSelect.onchange = (e) => loadTestResults(e.target.value);
}

window.openResultsTab = (testId) => { playSound('click'); switchTab('t-results'); document.getElementById('t-result-select').value = testId; loadTestResults(testId); };

let currentQType = 'mcq';

window.setQType = (type, label) => {
    playSound('click');
    currentQType = type;
    document.querySelectorAll('.type-radio-label').forEach(l => l.classList.remove('active'));
    label.classList.add('active');
    const mcqSection = document.getElementById('mcq-section-wrapper');
    if (type === 'essay') {
        mcqSection.classList.add('hidden');
    } else {
        mcqSection.classList.remove('hidden');
        if(document.getElementById('mcq-options-container').children.length === 0) renderOptionFields();
    }
};

let optionCount = 2; 
window.renderOptionFields = (preloadOptions = null, correctVal = null) => {
    const container = document.getElementById('mcq-options-container'); container.innerHTML = '';
    if(preloadOptions) { preloadOptions.forEach(opt => { addOptionField(opt === correctVal, opt); }); } 
    else { addOptionField(true); addOptionField(); }
};

window.addOptionField = (isCorrect = false, value = '') => {
    const container = document.getElementById('mcq-options-container');
    if(container.children.length >= 6) return saAlert("الحد الأقصى 6 خيارات", "info");
    const div = document.createElement('div'); div.className = 'option-row';
    div.innerHTML = `
        <input type="radio" name="correct_ans_select" class="option-radio" ${isCorrect ? 'checked' : ''}>
        <input type="text" class="smart-input option-input ${isCorrect ? 'correct' : ''}" value="${value}" placeholder="خيار">
        <button onclick="removeOption(this)" class="icon-btn-small" style="color:var(--danger); background:rgba(239,68,68,0.1);"><i class="fas fa-times"></i></button>
    `;
    div.querySelector('input[type="radio"]').addEventListener('change', () => {
        document.querySelectorAll('.option-input').forEach(i => i.classList.remove('correct'));
        div.querySelector('.option-input').classList.add('correct');
    });
    container.appendChild(div);
};

window.removeOption = (btn) => { if(document.getElementById('mcq-options-container').children.length <= 2) return saAlert("يجب وجود خيارين على الأقل", "info"); btn.parentElement.remove(); };

document.getElementById('q-image-input').onchange = async (e) => {
    if(e.target.files[0]) {
        currentImgBase64 = await getBase64(e.target.files[0]);
        document.getElementById('q-img-preview').classList.remove('hidden');
        document.getElementById('q-img-preview').querySelector('img').src = currentImgBase64;
        document.getElementById('q-img-label').innerText = "تم إرفاق صورة";
    }
};

window.addQuestionToList = () => {
    playSound('click');
    const text = document.getElementById('q-text').value; const points = document.getElementById('q-points').value;
    let options = []; let correctVal = null;
    
    if (currentQType === 'mcq') {
        const rows = document.querySelectorAll('.option-row');
        let hasEmpty = false;
        rows.forEach(row => {
            const val = row.querySelector('.option-input').value.trim();
            const isChecked = row.querySelector('input[type="radio"]').checked;
            if(!val) hasEmpty = true; options.push(val); if(isChecked) correctVal = val;
        });
        if(hasEmpty) return saAlert("يرجى ملء جميع الخيارات", "error");
        if(!correctVal) return saAlert("يرجى تحديد الإجابة الصحيحة", "error");
    } else {
        options = null;
        correctVal = 'essay_evaluation'; 
    }

    if(!text && !currentImgBase64) return saAlert("يجب إضافة نص للسؤال أو صورة", "error");
    
    const questionObj = { 
        type: currentQType, 
        text, 
        points, 
        image: currentImgBase64, 
        options: options, 
        correct: correctVal 
    };
    currentQuestions.push(questionObj); renderAddedQuestions(); clearQuestionForm();
};

function clearQuestionForm() {
    document.getElementById('q-text').value = ''; document.getElementById('q-points').value = '1';
    currentImgBase64 = null; document.getElementById('q-image-input').value = '';
    document.getElementById('q-img-preview').classList.add('hidden'); document.getElementById('q-img-label').innerText = "إرفاق صورة";
    renderOptionFields();
}

function renderAddedQuestions() {
    const list = document.getElementById('added-questions-list'); list.innerHTML = '';
    currentQuestions.forEach((q, idx) => {
        const typeLabel = q.type === 'essay' ? '<span style="color:var(--accent-primary); font-size:0.8rem;">(مقالي)</span>' : '';
        const div = document.createElement('div'); div.className = 'mini-card';
        div.style = "flex-direction:row; justify-content:space-between; align-items:center;";
        div.innerHTML = `
            <div style="flex:1;"><span style="font-weight:bold;">س${idx + 1}:</span> ${q.text || 'سؤال صورة'} ${typeLabel} ${q.image ? '<i class="fas fa-image" style="color:var(--accent-primary); margin-right:5px;"></i>' : ''}</div>
            <div style="display:flex; gap:10px;">
                <button onclick="editQuestion(${idx})" class="icon-btn-small" style="color:var(--accent-primary); background:rgba(59,130,246,0.1);"><i class="fas fa-pen"></i></button>
                <button onclick="deleteQuestion(${idx})" class="icon-btn-small" style="color:var(--danger); background:rgba(239,68,68,0.1);"><i class="fas fa-trash"></i></button>
            </div>`;
        list.appendChild(div);
    });
}

window.deleteQuestion = (idx) => { saConfirm("حذف السؤال؟", () => { currentQuestions.splice(idx, 1); renderAddedQuestions(); }); };

window.editQuestion = (idx) => {
    playSound('click');
    const q = currentQuestions[idx];
    document.getElementById('q-text').value = q.text; document.getElementById('q-points').value = q.points;
    
    const typeLabels = document.querySelectorAll('.type-radio-label');
    if (q.type === 'essay') {
        setQType('essay', typeLabels[1]);
        typeLabels[1].querySelector('input').checked = true;
    } else {
        setQType('mcq', typeLabels[0]);
        typeLabels[0].querySelector('input').checked = true;
        renderOptionFields(q.options, q.correct);
    }

    if(q.image) {
        currentImgBase64 = q.image;
        document.getElementById('q-img-preview').classList.remove('hidden');
        document.getElementById('q-img-preview').querySelector('img').src = currentImgBase64;
        document.getElementById('q-img-label').innerText = "صورة موجودة";
    }
    
    currentQuestions.splice(idx, 1); renderAddedQuestions();
    document.getElementById('q-editor-box').scrollIntoView({behavior: 'smooth'});
};

window.resetCreateForm = () => {
    document.getElementById('new-test-name').value = ''; document.getElementById('new-test-grade').value = ''; document.getElementById('new-test-duration').value = '';
    const subj = document.getElementById('new-test-subject'); if(subj) subj.value = '';
    document.getElementById('custom-grade-input').classList.add('hidden');
    document.getElementById('create-page-title').innerText = "اختبار جديد";
    document.getElementById('btn-save-test').innerHTML = '<i class="fas fa-save"></i> نشر الاختبار النهائي';
    currentQuestions = []; renderAddedQuestions(); clearQuestionForm(); isEditingMode = false; editingTestId = null;
};

window.editTest = async (testId) => {
    playSound('click');
    const snap = await get(ref(db, `tests/${testId}`));
    if(!snap.exists()) return saAlert("الاختبار غير موجود", "error");
    const data = snap.val(); isEditingMode = true; editingTestId = testId;
    switchTab('t-create');
    document.getElementById('create-page-title').innerText = "تعديل الاختبار: " + data.title;
    document.getElementById('btn-save-test').innerHTML = '<i class="fas fa-save"></i> حفظ التعديلات';
    document.getElementById('new-test-name').value = data.title; document.getElementById('new-test-duration').value = data.duration;
    const gradeSelect = document.getElementById('new-test-grade'); const options = Array.from(gradeSelect.options).map(o => o.value);
    if(options.includes(data.grade)) { gradeSelect.value = data.grade; document.getElementById('custom-grade-input').classList.add('hidden'); } 
    else { gradeSelect.value = 'custom'; document.getElementById('custom-grade-input').classList.remove('hidden'); document.getElementById('custom-grade-input').value = data.grade; }
    currentQuestions = data.questions || []; if(!Array.isArray(currentQuestions)) currentQuestions = Object.values(currentQuestions);
    renderAddedQuestions();
    const subjectEl = document.getElementById('new-test-subject');
    if(subjectEl && data.subject) { subjectEl.value = data.subject; }
};

window.saveTest = async () => {
    playSound('click');
    const title = document.getElementById('new-test-name').value;
    let grade = document.getElementById('new-test-grade').value; if(grade === 'custom') grade = document.getElementById('custom-grade-input').value;
    const duration = document.getElementById('new-test-duration').value;
    const subject = document.getElementById('new-test-subject').value;
    if(!title || !grade || !duration || !subject || currentQuestions.length === 0) {
        if (!subject) {
            const el = document.getElementById('new-test-subject');
            el.classList.add('new-test-subject-required');
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setTimeout(() => el.classList.remove('new-test-subject-required'), 1500);
        }
        return saAlert("البيانات ناقصة — تأكد من اختيار المادة وإضافة سؤال واحد على الأقل", "error");
    }
    const payload = { teacher: currentUser, title, grade, duration, subject, questions: currentQuestions, timestamp: Date.now(), isHidden: false };
    if (isEditingMode && editingTestId) { await update(ref(db, `tests/${editingTestId}`), payload); saAlert("تم تعديل الاختبار بنجاح!", "success"); } 
    else { await push(ref(db, 'tests'), payload); saAlert("تم نشر الاختبار بنجاح!", "success"); }
    resetCreateForm(); switchTab('t-library');
};

window.checkCustomGrade = (el) => { document.getElementById('custom-grade-input').classList.toggle('hidden', el.value !== 'custom'); };
window.toggleTestVisibility = (k, s) => { playSound('click'); update(ref(db, `tests/${k}`), { isHidden: s }); saAlert(s ? "تم إخفاء الاختبار عن الطلاب" : "الاختبار الآن مرئي للطلاب", "info"); };
window.deleteTest = (k) => { saConfirm("هل أنت متأكد من حذف هذا الاختبار؟", () => { remove(ref(db, `tests/${k}`)); remove(ref(db, `results/${k}`)); saAlert("تم الحذف بنجاح", "success"); }); };

window.shareTest = async (title, id) => {
    playSound('click');
    const url = `${window.location.href.split('?')[0]}?examId=${id}`;
    const snap = await get(ref(db, `tests/${id}`)).catch(() => null);
    const subject = snap?.val()?.subject || '';
    const questionCount = snap?.val()?.questions?.length || 0;
    const duration = snap?.val()?.duration || '';
    const teacher = snap?.val()?.teacher || '';
    const shareText = `📚 ${subject ? subject + ' - ' : ''}${title}\n👤 ${teacher}\n❓ ${questionCount} سؤال • ⏱ ${duration} دقيقة\n\nاضغط للدخول للاختبار:`;
    if (navigator.share) {
        navigator.share({ title: `اختبار: ${title}`, text: shareText, url }).catch(() => {});
    } else {
        navigator.clipboard.writeText(`${shareText}\n${url}`).then(() => saAlert("تم نسخ رابط الاختبار!", "success"));
    }
};
function getGradeLabel(c) { return ({'1p':'1 ابتدائي','3s':'3 ثانوي'})[c] || c; }

window.loadTestResults = (testId) => {
    if(!testId || testId.includes('اختر')) return;
    const div = document.getElementById('t-results-container'); div.innerHTML = '<div style="text-align:center;"><i class="fas fa-spinner fa-spin"></i></div>';
    get(ref(db, `results/${testId}`)).then(async snap => {
        div.innerHTML = '';
        if(!snap.exists()) return div.innerHTML = '<p style="text-align:center; color:#666;">لا توجد نتائج لهذا الاختبار بعد</p>';
        snap.forEach(c => {
            const studentName = c.key; const v = c.val(); const color = v.percentage >= 50 ? 'var(--success)' : 'var(--danger)';
            const el = document.createElement('div'); el.className = 'mini-card';
            el.style = "flex-direction:row; justify-content:space-between; align-items:center; margin-bottom:10px;";
            el.innerHTML = `
                <div><span style="font-weight:bold; display:block;">${studentName}</span><span style="font-size:0.8rem; color:#888;">${new Date(v.timestamp).toLocaleDateString()}</span></div>
                <div style="display:flex; align-items:center; gap:10px;">
                    <span style="font-weight:bold; color:${color}; font-size:1.1rem;">${v.percentage}%</span>
                    <button class="action-icon view" onclick="viewStudentDetails('${testId}', '${studentName}')"><i class="fas fa-eye"></i></button>
                </div>`;
            div.appendChild(el);
        });
    });
};

window.viewStudentDetails = async (testId, studentName) => {
    playSound('click');
    let phone = "غير مسجل"; const userSnap = await get(ref(db, `users/students/${studentName}`));
    if(userSnap.exists() && userSnap.val().phone) phone = userSnap.val().phone;
    const resSnap = await get(ref(db, `results/${testId}/${studentName}`)); const res = resSnap.val();
    document.getElementById('td-name').innerText = studentName; document.getElementById('td-phone').innerText = phone;
    const list = document.getElementById('td-answers-list'); list.innerHTML = '';
    if (res.details && Array.isArray(res.details)) {
        res.details.forEach((d, i) => {
            const isEssay = d.type === 'essay';
            let statusColor;
            if (isEssay) statusColor = 'var(--accent-primary)'; 
            else statusColor = d.isCorrect ? 'var(--success)' : 'var(--danger)';
            
            const essayBadge = isEssay ? '<span style="font-size:0.7rem; background:rgba(255,255,255,0.1); padding:2px 5px; border-radius:4px;">مقالي</span>' : '';

            list.innerHTML += `
                <div style="background:#222; padding:10px; border-radius:10px; margin-bottom:10px; border-right:3px solid ${statusColor}">
                    <p style="margin:0 0 5px; font-weight:bold;">س${i+1}: ${d.q} ${essayBadge}</p>
                    ${d.image ? `<img src="${d.image}" style="max-width:100%; height:auto; border-radius:8px; margin-bottom:10px;">` : ''}
                    <div style="font-size:0.9rem; color:#aaa;">إجابة الطالب: <span style="color:#fff; white-space: pre-wrap;">${d.user}</span></div>
                    ${!d.isCorrect && !isEssay ? `<div style="font-size:0.9rem; color:var(--success);">الصحيحة: ${d.correct}</div>` : ''}
                    ${isEssay ? `<div style="font-size:0.9rem; color:var(--accent-primary); margin-top:5px;">الإجابة النموذجية (AI): ${d.correct || 'غير متوفرة'}</div>` : ''}
                </div>`;
        });
    } else { list.innerHTML = '<p>لا توجد تفاصيل.</p>'; }
    document.getElementById('teacher-detail-modal').classList.remove('hidden');
};

function loadStudentExams() {
    const list = document.getElementById('s-exams-list');
    list.innerHTML = getMultipleSkeletons(3);
    onValue(ref(db, 'tests'), async (snap) => {
        list.innerHTML = ''; const tests = snap.val();
        if (!tests) return list.innerHTML = getEmptyStateHTML('exams');
        let foundExam = false;
        const promises = Object.entries(tests).map(async ([key, val]) => {
            if (val.isHidden === true) return null;
            const resSnap = await get(ref(db, `results/${key}/${currentUser}`));
            return { key, val, hasTaken: resSnap.exists(), score: resSnap.exists() ? resSnap.val().percentage : null };
        });
        const results = await Promise.all(promises);
        results.forEach(item => {
            if(!item) return; foundExam = true; const { key, val, hasTaken, score } = item;
            const cardWrapper = document.createElement('div'); cardWrapper.className = 'card-wrapper';
            cardWrapper.setAttribute('data-exam-id', key);
            const subjectBadge = val.subject ? `<span class="subject-badge">${val.subject}</span>` : '';
            let buttonsHtml = hasTaken ? 
                `<button class="action-icon share" onclick="shareTest('${val.title}', '${key}')" title="مشاركة"><i class="fas fa-share-alt"></i></button>
                    <button class="action-icon edit" onclick="checkPhoneAndStart('${key}')" title="إعادة الاختبار"><i class="fas fa-redo"></i></button>
                    <button class="action-icon gold" onclick="reviewTest('${key}')" title="مراجعة"><i class="fas fa-file-alt"></i></button>` :
                `<button class="action-icon share" onclick="shareTest('${val.title}', '${key}')" title="مشاركة"><i class="fas fa-share-alt"></i></button>
                    <button class="action-icon edit" style="width:100%; border-radius:15px; background:var(--accent-primary); color:white; justify-content:center;" onclick="checkPhoneAndStart('${key}')"><i class="fas fa-rocket"></i> ابدأ الآن</button>`;
            const sc = score>=90?'gold':score>=50?'green':'red';
            const scoreBadge = hasTaken
                ? `<div class="score-circle ${sc}">${score}%</div>`
                : `<div class="score-circle blue"><i class="fas fa-play" style="font-size:.65rem"></i></div>`;
            const newBadge = !hasTaken ? '<span class="exam-new-badge">جديد</span>' : '';
            cardWrapper.innerHTML = `
                <div class="mini-card" data-subj="${val.subject||''}">
                    <div class="card-header">
                        <div style="flex:1;min-width:0;">
                            <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
                                <h3 class="card-title" style="flex:1">${val.title}</h3>${newBadge}
                            </div>
                            <div class="card-meta">${subjectBadge}<span style="color:#555">${val.teacher}</span><span style="color:#333">•</span><i class="fas fa-clock" style="font-size:.6rem;color:#444"></i>${val.duration}د</div>
                        </div>
                        ${scoreBadge}
                    </div>
                    <div class="icon-actions">${buttonsHtml}</div>
                </div>`;
            list.appendChild(cardWrapper); { const _ad = createAdBanner(); if (_ad) list.appendChild(_ad); }
        });
        if(!foundExam) list.innerHTML = getEmptyStateHTML('exams');
        // Update ticker with live stats
        _updateStudentTicker();
    });
}

function _updateStudentTicker() {
    const ticker = document.getElementById('student-ticker');
    if (!ticker) return;
    get(ref(db, 'results')).then(snap => {
        const all = snap.val() || {};
        let examCount=0, totalPct=0;
        Object.values(all).forEach(exRes => {
            if (exRes[currentUser]) { examCount++; totalPct += exRes[currentUser].percentage||0; }
        });
        const avg = examCount>0 ? Math.round(totalPct/examCount) : null;
        const lvl = avg===null?'ابدأ أول اختبار الآن':avg>=90?'مستواك ممتاز 🌟':avg>=75?'مستواك جيد جداً 👍':avg>=50?'مستواك جيد، واصل':'تحتاج مراجعة ❤️';
        const items = [
            avg!==null ? `<span><span class="ticker-dot"></span> ${examCount} اختبار أديته</span>` : '',
            avg!==null ? `<span><span class="ticker-dot" style="background:#34d399"></span> متوسطك ${avg}%</span>` : '',
            `<span><span class="ticker-dot" style="background:#a78bfa"></span> ${lvl}</span>`,
            `<span><span class="ticker-dot" style="background:#fbbf24"></span> اضغط لعرض التحليل الكامل</span>`,
        ].filter(Boolean);
        // duplicate for infinite scroll
        const all2 = [...items, ...items];
        ticker.innerHTML = all2.join('');
    }).catch(()=>{});
}

window.loadStudentGrades = () => {
        const list = document.getElementById('s-grades-list');
        list.innerHTML = getMultipleSkeletons(2);
        get(ref(db, 'tests')).then(async (testSnap) => {
            list.innerHTML = ''; const tests = testSnap.val() || {}; let foundAny = false;
            for(const [testId, testData] of Object.entries(tests)) {
                const resSnap = await get(ref(db, `results/${testId}/${currentUser}`));
                if(resSnap.exists()) {
                    foundAny = true; const res = resSnap.val();
                    const color = res.percentage >= 90 ? 'var(--accent-gold)' : (res.percentage >= 50 ? 'var(--success)' : 'var(--danger)');
                    const div = document.createElement('div'); div.className = 'mini-card';
                    div.innerHTML = `
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <div><h3 style="font-size:1rem; margin:0;">${testData.title}</h3><span style="font-size:0.8rem; color:#888;">${new Date(res.timestamp).toLocaleDateString()}</span></div>
                        <div style="text-align:left;"><div style="font-weight:bold; font-size:1.4rem; color:${color};">${res.percentage}%</div><div style="font-size:0.8rem; color:#aaa;">${res.score} / ${res.total}</div></div>
                    </div>
                    <button onclick="reviewTest('${testId}')" class="modern-btn secondary" style="margin-top:10px; font-size:0.8rem; padding:8px; justify-content: center;"><i class="fas fa-list-alt"></i> مراجعة التفاصيل</button>`;
                    list.appendChild(div);
                }
            }
            if(!foundAny) list.innerHTML = '<p style="text-align:center; padding:20px; color:#666;">لم تقم بأي اختبارات بعد.</p>';
        });
};

let tempTestId = null;
window.checkPhoneAndStart = async (id) => {
    playSound('click');
    tempTestId = id; const userSnap = await get(ref(db, `users/students/${currentUser}`));
    if(userSnap.exists() && userSnap.val().phone) startTest(id); else document.getElementById('phone-modal').classList.remove('hidden');
};

window.savePhoneAndStart = async () => {
    playSound('click');
    const phone = document.getElementById('student-phone-input').value.trim();
    if(!phone || phone.length < 10) return saAlert("يرجى إدخال رقم صحيح", "error");
    await update(ref(db, `users/students/${currentUser}`), { phone: phone });
    document.getElementById('phone-modal').classList.add('hidden'); startTest(tempTestId);
};

let activeTest = null; let timerInt = null; let answers = {};

window.startTest = async (id) => {
    const snap = await get(ref(db, `tests/${id}`));
    if (!snap.exists()) return saAlert("عذراً، هذا الاختبار لم يعد موجوداً.", "error");
    activeTest = snap.val(); activeTest.id = id;
    if (!activeTest.questions) activeTest.questions = []; else if (!Array.isArray(activeTest.questions)) activeTest.questions = Object.values(activeTest.questions);
    answers = {};
    document.getElementById('s-taking-test').classList.remove('hidden'); document.getElementById('active-test-title').innerText = activeTest.title;
    const div = document.getElementById('test-questions-render'); div.innerHTML = '';
    if (activeTest.questions.length === 0) { div.innerHTML = '<p style="text-align:center;">لا توجد أسئلة في هذا الاختبار.</p>'; } else {
        activeTest.questions.forEach((q, i) => {
            const isEssay = q.type === 'essay';
            let inputHtml = '';
            
            if (isEssay) {
                inputHtml = `<textarea class="smart-input" style="min-height:80px; margin-top:10px;" placeholder="اكتب إجابتك هنا..." onchange="saveAns(${i}, this.value)"></textarea>`;
            } else {
                if (!q.options) q.options = []; const shuffled = [...q.options].sort(() => Math.random() - 0.5);
                inputHtml = shuffled.map(o => `<label class="mini-card" style="flex-direction:row; align-items:center; gap:10px; cursor:pointer; margin-bottom:8px; padding:12px;"><input type="radio" name="q${i}" value="${o}" onchange="saveAns(${i}, '${o}')"><span>${o}</span></label>`).join('');
            }

            div.innerHTML += `
                <div style="margin-bottom:25px;">
                    <p style="font-weight:bold; font-size:1.1rem; margin-bottom:10px;">${i+1}. ${q.text}</p>
                    ${q.image ? `<img src="${q.image}" style="max-width:100%; border-radius:10px; margin-bottom:10px;">` : ''}
                    ${inputHtml}
                </div>`;
        });
    }
    let time = activeTest.duration * 60; clearInterval(timerInt);
    timerInt = setInterval(() => {
        time--; const m = Math.floor(time/60), s = time%60; document.getElementById('test-timer').innerText = `${m}:${s<10?'0'+s:s}`;
        if(time<=0) submitExam();
    }, 1000);
};

window.saveAns = (i, v) => answers[i] = v;
window.closeExam = () => { saConfirm("خروج من الامتحان؟ ستفقد تقدمك.", () => { clearInterval(timerInt); document.getElementById('s-taking-test').classList.add('hidden'); }); };

window.submitExam = async () => {
    playSound('success');
    clearInterval(timerInt);
    
    // Check if already taken before (first attempt only)
    const existingSnap = await get(ref(db, `results/${activeTest.id}/${currentUser}`));
    const isFirstAttempt = !existingSnap.exists();
    
    let score = 0, total = 0, details = [];
    const questions = activeTest.questions || [];
    questions.forEach((q, i) => {
        const pts = parseInt(q.points) || 1;
        total += pts;
        let isCorrect = false;
        if (q.type === 'essay') {
            if (answers[i] && answers[i].trim().length > 2) { isCorrect = true; score += pts; }
        } else {
            isCorrect = answers[i] === q.correct;
            if (isCorrect) score += pts;
        }
        details.push({ q: q.text, image: q.image || null, user: answers[i]||'-', correct: q.correct, isCorrect, type: q.type || 'mcq' });
    });
    const pct = total === 0 ? 0 : Math.round((score/total)*100);

    // Only save if first attempt
    if (isFirstAttempt) {
        await set(ref(db, `results/${activeTest.id}/${currentUser}`), { score, total, percentage: pct, timestamp: Date.now(), details });
    }

    document.getElementById('s-taking-test').classList.add('hidden');
    
    // Show beautiful result screen
    showExamResultScreen(activeTest.title, score, total, pct, details, isFirstAttempt);
};

function showExamResultScreen(title, score, total, pct, details, isFirstAttempt) {
    const wrongAnswers = details.filter(d => !d.isCorrect && d.type !== 'essay');
    const essayCount  = details.filter(d => d.type === 'essay').length;
    const correctCount = details.filter(d => d.isCorrect).length;
    
    const color = pct >= 90 ? '#ffd700' : pct >= 50 ? '#10b981' : '#ef4444';
    const emoji = pct >= 90 ? '🏆' : pct >= 70 ? '🌟' : pct >= 50 ? '✅' : '📚';
    const msg   = pct >= 90 ? 'ممتاز! أداء رائع جداً' : pct >= 70 ? 'جيد جداً، استمر!' : pct >= 50 ? 'جيد، يمكنك التحسن أكثر' : 'تحتاج لمراجعة أكثر';

    const overlay = document.createElement('div');
    overlay.id = 'exam-result-overlay';
    overlay.style.cssText = `
        position:fixed; inset:0; z-index:99999;
        background: radial-gradient(ellipse at center, #0a0a1a 0%, #000 100%);
        display:flex; align-items:center; justify-content:center;
        padding:20px; overflow-y:auto;
        animation: fadeIn 0.4s ease;
    `;

    const wrongHtml = wrongAnswers.length > 0 ? `
        <div style="margin-top:20px; text-align:right;">
            <div style="font-size:0.85rem; color:#ef4444; font-weight:700; margin-bottom:10px;">❌ الأسئلة الخاطئة:</div>
            ${wrongAnswers.slice(0,5).map(d => `
                <div style="background:rgba(239,68,68,0.08); border:1px solid rgba(239,68,68,0.2); border-radius:12px; padding:10px 14px; margin-bottom:8px; font-size:0.82rem;">
                    <div style="color:#ccc; margin-bottom:4px;">${d.q.substring(0,80)}${d.q.length>80?'...':''}</div>
                    <div style="color:#10b981;">✓ الصح: <strong>${d.correct}</strong></div>
                    <div style="color:#ef4444;">✗ إجابتك: ${d.user}</div>
                </div>
            `).join('')}
            ${wrongAnswers.length > 5 ? `<div style="color:#666;font-size:0.8rem;text-align:center;">+ ${wrongAnswers.length-5} أسئلة أخرى</div>` : ''}
        </div>
    ` : '';

    overlay.innerHTML = `
        <div style="max-width:420px; width:100%; text-align:center;">
            <!-- Score circle -->
            <div style="position:relative; width:140px; height:140px; margin:0 auto 20px;">
                <svg width="140" height="140" style="transform:rotate(-90deg);">
                    <circle cx="70" cy="70" r="60" fill="none" stroke="#1a1a2e" stroke-width="12"/>
                    <circle cx="70" cy="70" r="60" fill="none" stroke="${color}" stroke-width="12"
                        stroke-dasharray="${2*Math.PI*60}" 
                        stroke-dashoffset="${2*Math.PI*60*(1-pct/100)}"
                        stroke-linecap="round"
                        style="filter:drop-shadow(0 0 8px ${color}); transition:stroke-dashoffset 1.2s ease;"/>
                </svg>
                <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;">
                    <div style="font-size:2rem; font-weight:900; color:${color};">${pct}%</div>
                    <div style="font-size:0.75rem; color:#666;">${score}/${total}</div>
                </div>
            </div>

            <div style="font-size:2.5rem; margin-bottom:8px;">${emoji}</div>
            <div style="font-size:1.4rem; font-weight:800; color:#fff; margin-bottom:6px;">${title}</div>
            <div style="color:${color}; font-size:1rem; font-weight:600; margin-bottom:20px;">${msg}</div>

            <!-- Stats -->
            <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:10px; margin-bottom:20px;">
                <div style="background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.2);border-radius:14px;padding:14px 6px;">
                    <div style="font-size:1.5rem;font-weight:900;color:#10b981;">${correctCount}</div>
                    <div style="font-size:0.72rem;color:#555;margin-top:2px;">إجابات صحيحة</div>
                </div>
                <div style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);border-radius:14px;padding:14px 6px;">
                    <div style="font-size:1.5rem;font-weight:900;color:#ef4444;">${wrongAnswers.length}</div>
                    <div style="font-size:0.72rem;color:#555;margin-top:2px;">إجابات خاطئة</div>
                </div>
                <div style="background:rgba(59,130,246,0.08);border:1px solid rgba(59,130,246,0.2);border-radius:14px;padding:14px 6px;">
                    <div style="font-size:1.5rem;font-weight:900;color:#3b82f6;">${essayCount}</div>
                    <div style="font-size:0.72rem;color:#555;margin-top:2px;">أسئلة مقالية</div>
                </div>
            </div>

            ${!isFirstAttempt ? `<div style="background:rgba(255,215,0,0.08);border:1px solid rgba(255,215,0,0.2);border-radius:12px;padding:10px;margin-bottom:16px;font-size:0.82rem;color:#ffd700;">⚡ درجتك الأولى محفوظة — هذه المحاولة لم تُحسب</div>` : ''}

            ${wrongHtml}

            <button onclick="document.getElementById('exam-result-overlay').remove(); loadStudentExams(); loadStudentGrades();"
                style="margin-top:24px; width:100%; padding:16px; background:${color}; color:#000; border:none; border-radius:16px; font-size:1rem; font-weight:800; cursor:pointer; box-shadow:0 6px 0 rgba(0,0,0,0.4), 0 4px 20px ${color}44;">
                ${pct >= 50 ? '🎉 رائع! العودة للرئيسية' : '📚 العودة والمراجعة'}
            </button>
        </div>
    `;

    document.body.appendChild(overlay);
    // Animate circle
    setTimeout(() => {
        const circle = overlay.querySelector('circle:last-child');
        if (circle) circle.style.strokeDashoffset = String(2*Math.PI*60*(1-pct/100));
    }, 100);
    loadStudentGrades();
}

window.reviewTest = async (id) => {
    playSound('click');
    const resSnap = await get(ref(db, `results/${id}/${currentUser}`));
    if(!resSnap.exists()) return saAlert("لم تقم بهذا الاختبار", "info");
    const res = resSnap.val();
    const div = document.getElementById('review-content'); div.innerHTML = `<h1 style="text-align:center; color:var(--accent-primary); margin-bottom:20px;">${res.percentage}%</h1>`;
    if (res.details && Array.isArray(res.details)) {
        res.details.forEach((d, i) => {
            const isEssay = d.type === 'essay';
            const borderColor = d.isCorrect ? 'var(--success)' : (isEssay ? 'var(--accent-primary)' : 'var(--danger)');
            const icon = d.isCorrect ? '<i class="fas fa-check-circle" style="color:var(--success)"></i>' : (isEssay ? '<i class="fas fa-pen" style="color:var(--accent-primary)"></i>' : '<i class="fas fa-times-circle" style="color:var(--danger)"></i>');
            
            div.innerHTML += `
                <div class="mini-card" style="border-right:4px solid ${borderColor}">
                    <div style="display:flex; justify-content:space-between;"><strong>س${i+1}: ${d.q}</strong>${icon}</div>
                    ${d.image ? `<img src="${d.image}" style="max-width:100%; height:auto; border-radius:8px; margin-top:10px;">` : ''}
                    <div style="margin-top:10px; background:rgba(255,255,255,0.05); padding:10px; border-radius:8px;"><p style="margin:0; font-size:0.9rem; color:#aaa;">إجابتك:</p><p style="margin:5px 0 0 0; font-weight:bold; color:${d.isCorrect ? 'var(--success)' : '#fff'}">${d.user}</p></div>
                    ${!isEssay && !d.isCorrect ? `<div style="margin-top:5px; background:rgba(16, 185, 129, 0.1); padding:10px; border-radius:8px;"><p style="margin:0; font-size:0.9rem; color:var(--success);">الإجابة الصحيحة:</p><p style="margin:5px 0 0 0; font-weight:bold;">${d.correct}</p></div>` : ''}
                </div>`;
        });
    } else { div.innerHTML += '<p>لا توجد تفاصيل متاحة للمراجعة.</p>'; }
    document.getElementById('s-review-test').classList.remove('hidden');
};

window.toggleAiGenerator = () => { playSound('click'); document.getElementById('ai-gen-modal').classList.toggle('open'); };

window.previewChatImg = async (prefix) => {
    const input = document.getElementById(`${prefix}-ai-file`);
    if(input.files[0]) {
        const b64 = await getBase64(input.files[0]);
        document.getElementById(`${prefix}-chat-preview`).style.display = 'block';
        document.getElementById(`${prefix}-chat-img-tag`).src = b64;
    }
};

window.previewAiGenImg = async (input) => {
    if(input.files[0]) {
        const b64 = await getBase64(input.files[0]);
        aiGenImgBase64 = b64;
        document.getElementById('ai-gen-preview').classList.remove('hidden');
        document.getElementById('ai-gen-preview').querySelector('img').src = b64;
    }
};

window.clearChatImg = (prefix) => {
    document.getElementById(`${prefix}-ai-file`).value = '';
    document.getElementById(`${prefix}-chat-preview`).style.display = 'none';
};

window.toggleAiSendMic = (role, value) => {
    const micBtn  = document.getElementById(role + '-mic-btn');
    const sendBtn = document.getElementById(role + '-send-btn');
    if (!micBtn || !sendBtn) return;
    const hasText = !!(value && value.trim());
    micBtn.style.display  = hasText ? 'none' : 'flex';
    sendBtn.style.display = hasText ? 'flex' : 'none';
    // char counter
    var counterEl = document.getElementById(role + '-ai-charcnt');
    if (!counterEl) {
        counterEl = document.createElement('div');
        counterEl.id = role + '-ai-charcnt';
        counterEl.className = 'ai-char-counter';
        var wrapper = document.getElementById(role + '-ai-input');
        if (wrapper) wrapper.closest('.gemini-input-wrapper').appendChild(counterEl);
    }
    if (counterEl) {
        var len = (value||'').length;
        if (len > 0) {
            counterEl.textContent = len + ' / 2000';
            counterEl.className = 'ai-char-counter' + (len>2000?' over':len>1700?' warn':'');
            counterEl.style.display = 'block';
        } else {
            counterEl.style.display = 'none';
        }
    }
};

let _isRecording = false;
window._speechRecog = null;

// ── IMPROVED AI VOICE INPUT: Records real audio → Transcribes → Sends to Pollinations ──
let _aiVoiceRecorder = null;
let _aiVoiceChunks = [];
let _aiVoiceRecording = false;
let _aiVoiceHoldTimer = null;

window.startVoiceInput = (role) => {
    const micBtn = document.getElementById(role + '-mic-btn');
    const input = document.getElementById(role + '-ai-input');

    // If already recording via MediaRecorder → stop and transcribe
    if (_aiVoiceRecording && _aiVoiceRecorder) {
        _aiVoiceRecorder.stop();
        return;
    }

    // Try MediaRecorder (real audio recording) first
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
            _aiVoiceChunks = [];
            _aiVoiceRecording = true;
            _aiVoiceRecorder = new MediaRecorder(stream);

            if (micBtn) {
                micBtn.classList.add('recording');
                micBtn.innerHTML = '<i class="fas fa-stop"></i>';
            }
            showToast('جاري التسجيل...', 'اضغط مرة أخرى للإيقاف', 'info', 8000);

            _aiVoiceRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) _aiVoiceChunks.push(e.data);
            };

            _aiVoiceRecorder.onstop = async () => {
                stream.getTracks().forEach(t => t.stop());
                _aiVoiceRecording = false;
                if (micBtn) {
                    micBtn.classList.remove('recording');
                    micBtn.innerHTML = '<i class="fas fa-microphone"></i>';
                }

                if (_aiVoiceChunks.length === 0) return;

                // Convert to base64 and use Web Speech API fallback OR
                // Show "transcribing" loader and use Pollinations to transcribe description
                const blob = new Blob(_aiVoiceChunks, { type: 'audio/webm' });

                // Try Web Speech API for transcription if available
                // Since Pollinations doesn't have a direct speech-to-text endpoint,
                // we use the SpeechRecognition API as transcriber, then send text to Pollinations
                if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
                    // Fallback: use speech recognition to get text, then query AI
                    _doWebSpeechThenAI(role, input);
                } else {
                    // No speech recognition available – show message
                    if (input) {
                        input.value = '[تعذر تحويل الصوت إلى نص على هذا الجهاز]';
                        toggleAiSendMic(role, input.value);
                    }
                }
            };

            _aiVoiceRecorder.start(100);

        }).catch(() => {
            // Microphone access denied — fallback to Speech Recognition
            _doWebSpeechThenAI(role, input);
        });
    } else {
        // No MediaDevices — fallback to Speech Recognition
        _doWebSpeechThenAI(role, input);
    }
};

function _doWebSpeechThenAI(role, input) {
    const micBtn = document.getElementById(role + '-mic-btn');

    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        saAlert('الإدخال الصوتي غير مدعوم على هذا المتصفح. جرب Chrome أو Edge.', 'error');
        return;
    }

    if (_isRecording) {
        if (window._speechRecog) window._speechRecog.stop();
        return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recog = new SpeechRecognition();
    window._speechRecog = recog;
    recog.lang = 'ar-SA';
    recog.continuous = false;
    recog.interimResults = false;

    recog.onstart = () => {
        _isRecording = true;
        if (micBtn) {
            micBtn.classList.add('recording');
            micBtn.innerHTML = '<i class="fas fa-stop"></i>';
        }
        showToast('جاري الاستماع...', 'تحدث الآن', 'info', 5000);
    };

    recog.onresult = (e) => {
        const text = e.results[0][0].transcript;
        if (input) {
            input.value = (input.value + ' ' + text).trim();
            window.toggleAiSendMic(role, input.value);
            // Auto-send after voice input
            setTimeout(() => window.sendAiMsg(role), 300);
        }
    };

    recog.onerror = (e) => {
        _isRecording = false;
        if (micBtn) {
            micBtn.classList.remove('recording');
            micBtn.innerHTML = '<i class="fas fa-microphone"></i>';
        }
        if (e.error !== 'no-speech') showToast('فشل الإدخال الصوتي', '', 'error', 2000);
    };

    recog.onend = () => {
        _isRecording = false;
        if (micBtn) {
            micBtn.classList.remove('recording');
            micBtn.innerHTML = '<i class="fas fa-microphone"></i>';
        }
    };

    recog.start();
}

window.sendAiMsg = async (prefix) => {
    const input = document.getElementById(`${prefix}-ai-input`); 
    const fileInput = document.getElementById(`${prefix}-ai-file`);
    const msgs = document.getElementById(`${prefix}-ai-msgs`); 
    if (!input || !msgs) return;
    let txt = input.value.trim();
    
    const hasFile = fileInput && fileInput.files && fileInput.files[0];
    if(!txt && !hasFile) return;
    
    playSound('sent');

    if (!fileInput || !fileInput.files[0]) {
        if (txt.includes("أنشئ اختبار") || txt.includes("create exam") || txt.includes("امتحان")) {
            if(selectedRole !== 'teacher') {
                return saAlert("عذراً، هذه الميزة للمعلمين فقط.", "error");
            }
            toggleAiGenerator();
            const topic = txt.replace("أنشئ اختبار", "").replace("عن", "").replace("create exam", "").replace("about", "").trim();
            if(topic) document.getElementById('ai-gen-text').value = topic;
            return; 
        }
        if (txt.includes("انشر") || txt.includes("بوست") || txt.includes("post")) {
            openReeseCompose();
            const content = txt.replace("انشر", "").replace("بوست", "").replace("post", "").replace("عن", "").trim();
            if(content) document.getElementById('reese-text-input').value = content;
            return;
        }
    }

    const welcomeScreen = msgs.querySelector('.ai-welcome-screen'); 
    if(welcomeScreen) welcomeScreen.remove();
    
    let imgB64 = null;
    let ocrText = "";

    if(hasFile) {
        const ocrLoadId = 'ocr-loading-' + Date.now();
        const ocrLoader = document.createElement('div');
        ocrLoader.className = 'chat-msg ai';
        ocrLoader.id = ocrLoadId;
        ocrLoader.innerHTML = '<i class="fas fa-eye fa-spin"></i> جاري تحليل الصورة...';
        msgs.appendChild(ocrLoader);
        
        try {
            imgB64 = await getBase64(fileInput.files[0]);
            ocrText = await recognizeImageText(imgB64);
            document.getElementById(ocrLoadId).remove();
            clearChatImg(prefix);
        } catch (e) {
            document.getElementById(ocrLoadId).innerHTML = "فشل تحليل الصورة.";
            console.error(e);
            return;
        }
    }
    
    currentChatMessages.push({ role: 'user', content: txt, image: imgB64 });
    renderMessageUI(prefix, 'user', txt, imgB64);
    input.value = '';
    window.toggleAiSendMic(prefix, '');
    saveChatToLocal();
    
    const loadId = 'loading-' + Date.now();
    const loaderDiv = document.createElement('div');
    loaderDiv.className = 'ai-thinking-row';
    loaderDiv.id = loadId;
    loaderDiv.innerHTML = '<div class="ai-dot-trio"><span></span><span></span><span></span></div>';
    msgs.appendChild(loaderDiv);
    msgs.scrollTo({ top: msgs.scrollHeight, behavior: 'smooth' });
    
    try {
        let finalPrompt = "";
        
        // Correct Arabic spelling before sending
        const correctedTxt = correctArabicSpelling(txt);

        // ── DEEP USER PROFILE ──
        const userName = currentUser || 'الطالب';
        const userRole = selectedRole === 'student' ? 'طالب' : 'معلم';
        let gradesContext = '';
        let deepProfile = '';
        try {
            if (selectedRole === 'student') {
                const [stuSnap, testsSnap, resultsSnap] = await Promise.all([
                    get(ref(db, 'users/students/' + currentUser)),
                    get(ref(db, 'tests')),
                    get(ref(db, 'results')),
                ]);
                const stuData = stuSnap.val() || {};
                const tests   = testsSnap.val()  || {};
                const allRes  = resultsSnap.val() || {};
                let totalS=0, totalM=0, examCount=0;
                const examLines=[], subjectMap={};
                for (const [tid, td] of Object.entries(tests)) {
                    const r = allRes[tid]?.[currentUser];
                    if (r) {
                        examCount++;
                        totalS += r.score||0; totalM += r.total||0;
                        examLines.push('  • '+td.title+' ('+(td.subject||'—')+'): '+r.percentage+'% ('+r.score+'/'+r.total+')');
                        const subj = td.subject||'أخرى';
                        if (!subjectMap[subj]) subjectMap[subj]=[];
                        subjectMap[subj].push(r.percentage);
                    }
                }
                const avg = totalM>0 ? Math.round(totalS/totalM*100) : null;
                const lvl = avg===null?'لم يؤدِ اختبارات':avg>=90?'ممتاز':avg>=75?'جيد جداً':avg>=60?'جيد':avg>=50?'مقبول':'يحتاج دعم';
                const subjLines = Object.entries(subjectMap).map(([s,arr])=>'  • '+s+': متوسط '+Math.round(arr.reduce((a,b)=>a+b,0)/arr.length)+'%');
                deepProfile = [
                    '=== ملف الطالب ===',
                    'الاسم: '+userName,
                    'الصف: '+(stuData.grade||'—'),
                    'المدرسة: '+(stuData.school||'—'),
                    'عدد الاختبارات: '+examCount,
                    avg!==null?'المتوسط: '+avg+'% — '+lvl:'',
                    examLines.length?'الاختبارات:\n'+examLines.join('\n'):'',
                    subjLines.length?'الأداء بالمادة:\n'+subjLines.join('\n'):'',
                    '==================',
                ].filter(Boolean).join('\n');
                gradesContext = deepProfile;
            } else {
                const [testsSnap, resultsSnap] = await Promise.all([
                    get(ref(db, 'tests')),
                    get(ref(db, 'results')),
                ]);
                const tests  = testsSnap.val()  || {};
                const allRes = resultsSnap.val() || {};
                const myExams = Object.entries(tests).filter(([,e])=>e.teacher===currentUser);
                let totalStud=0;
                myExams.forEach(([tid])=>{ totalStud+=Object.keys(allRes[tid]||{}).length; });
                deepProfile = [
                    '=== ملف المعلم ===',
                    'الاسم: '+userName,
                    'عدد اختباراته: '+myExams.length,
                    'إجمالي الطلاب: '+totalStud,
                    myExams.map(([,e])=>'  • '+e.title+' ('+(e.subject||'—')+')').join('\n'),
                    '==================',
                ].filter(Boolean).join('\n');
                gradesContext = deepProfile;
            }
        } catch(e2) {
            deepProfile = 'الاسم: '+userName+'. الدور: '+userRole+'.';
            gradesContext = deepProfile;
        }
        const userContext = deepProfile;

        // Check repeated question cache
        const _cacheKey = `sa_ai_cache_${correctedTxt.trim().toLowerCase().substring(0,80)}`;
        const _cached = sessionStorage.getItem(_cacheKey);
        const _forceNew = txt.includes('إجابة ثانية') || txt.includes('اجابة ثانية') || txt.includes('جاوب تاني') || txt.includes('غير الإجابة');

        if (_cached && !_forceNew) {
            playSound('recv');
            const loaderElCached = document.getElementById(loadId);
            if (loaderElCached) loaderElCached.remove();
            currentChatMessages.push({ role: 'ai', content: _cached, image: null });
            renderMessageUI(prefix, 'ai', _cached, null);
            saveChatToLocal();
            return;
        }

        // Smart intent detection
        const qLow = correctedTxt.toLowerCase();
        const isGreet  = /^(مرحبا|هلا|هاي|سلام|اهلا|صباح|مساء|ازيك|ايه|hi|hello)/.test(qLow.trim());
        const isMath   = /\d[+\-*/]\d|معادل|احسب|اشتق|تكامل|رياضيات/.test(qLow);
        const isShort  = correctedTxt.length < 35 || isGreet;
        const style    = isShort ? 'رد بجملتين فقط.' : isMath ? 'اشرح خطوة بخطوة.' : 'رد بشكل مناسب لطول السؤال.';

        if (selectedRole === 'student') {
            finalPrompt += 'أنت SA AI مساعد دراسي ذكي.\n'
                + deepProfile + '\n'
                + 'قواعد: افهم العامية والأخطاء الإملائية بدون تعليق. ' + style
                + ' أجب بالعربية فقط.\n';
        } else {
            finalPrompt += 'أنت SA AI مساعد معلمين ذكي.\n'
                + deepProfile + '\n'
                + 'قواعد: افهم الأخطاء الإملائية بدون تعليق. ' + style
                + ' أجب بالعربية فقط.\n';
        }

        finalPrompt += `معلومات المستخدم: ${userContext}`;

        if (ocrText) {
            finalPrompt += `Context from image: "${ocrText}". `;
        }
        finalPrompt += correctedTxt;
        
        const reply = await callPollinationsAI(finalPrompt);

        // Cache this answer for repeated questions (max 200 chars questions)
        if (correctedTxt.length < 200) {
            try { sessionStorage.setItem(_cacheKey, reply); } catch(e) {}
        }
        
        playSound('recv');
        const loaderEl = document.getElementById(loadId);
        if (loaderEl) loaderEl.remove();
        currentChatMessages.push({ role: 'ai', content: reply, image: null });
        renderMessageUI(prefix, 'ai', reply, null); 
        saveChatToLocal();
    } catch (e) {
        // AI never shows error — retry with fallback message
        const loaderEl = document.getElementById(loadId);
        if (loaderEl) loaderEl.remove();
        const fallbackReply = 'عذراً، واجهت مشكلة مؤقتة. أعد كتابة سؤالك وسأجيبك فوراً! 🔄';
        currentChatMessages.push({ role: 'ai', content: fallbackReply, image: null });
        renderMessageUI(prefix, 'ai', fallbackReply, null);
        saveChatToLocal();
        console.error('AI error (handled):', e);
    }
};

window.generateAiQuestions = async () => {
    playSound('click');
    const topic = document.getElementById('ai-gen-text').value;
    const mcqCount = document.getElementById('ai-mcq-count').value || 0;
    const essayCount = document.getElementById('ai-essay-count').value || 0;
    
    if (!topic && !aiGenImgBase64) return saAlert("أدخل الموضوع أو ارفع صورة", "error");
    const totalQ = parseInt(mcqCount||0) + parseInt(essayCount||0);
    if (totalQ === 0) return saAlert("يجب إدخال عدد الأسئلة المطلوبة", "error");
    if (totalQ > 100) return saAlert("الحد الأقصى 100 سؤال في المرة الواحدة", "error");

    toggleConstructionOverlay(true);
    toggleAiGenerator(); 
    
    let contextData = topic;
    if (aiGenImgBase64) {
        try {
            const textFromImage = await recognizeImageText(aiGenImgBase64);
            contextData += "\nContent from image: " + textFromImage;
        } catch(e) {
            toggleConstructionOverlay(false);
            return saAlert("فشل في قراءة الصورة", "error");
        }
    }
    
    const totalNeeded = parseInt(mcqCount||0) + parseInt(essayCount||0);
    const prompt = `You are an Arabic exam generator. Create EXACTLY ${totalNeeded} questions in JSON format.
IMPORTANT: Output ONLY a raw JSON array. No markdown, no explanation, no extra text.
Topic: "${contextData}"
Requirements:
- EXACTLY ${mcqCount} questions of type "mcq" (each with 4 options in Arabic)
- EXACTLY ${essayCount} questions of type "essay"
- All questions and answers in Arabic
- mcq structure: {"type":"mcq","text":"السؤال؟","options":["أ)","ب)","ج)","د)"],"correct":"أ)","points":1}
- essay structure: {"type":"essay","text":"السؤال؟","correct":"نموذج الإجابة","points":5}
Return ONLY the JSON array starting with [ and ending with ]`;
    
    try {
        let jsonStr = await callPollinationsAI(prompt);
        jsonStr = jsonStr.replace(/```json/g, '').replace(/```/g, '').trim();
        
        const firstBracket = jsonStr.indexOf('[');
        const lastBracket = jsonStr.lastIndexOf(']');
        if(firstBracket !== -1 && lastBracket !== -1) {
            jsonStr = jsonStr.substring(firstBracket, lastBracket + 1);
        }

        const questions = JSON.parse(jsonStr);
        
        if (Array.isArray(questions)) {
            questions.forEach(q => {
                if(!q.type) q.type = (q.options && q.options.length > 1) ? 'mcq' : 'essay';
            });

            currentQuestions = [...currentQuestions, ...questions];
            renderAddedQuestions();
            
            toggleConstructionOverlay(false);
            saAlert(`✅ تم توليد ${questions.length} سؤال بنجاح!`, "success");
            switchTab('t-create'); 
        } else {
            throw new Error("Invalid format");
        }
    } catch (e) { 
        console.error(e);
        toggleConstructionOverlay(false);
        saAlert("فشل البناء. حاول مرة أخرى.", "error"); 
    }
};

window.openStudentAnalytics = async () => {
    playSound('click');
    switchTab('s-analytics');
    const content = document.getElementById('student-analytics-content');
    content.innerHTML = '<div style="text-align:center;padding:40px;"><div class="analytics-loading-spin"></div><p style="color:#888;margin-top:15px;">جاري تحليل مستواك...</p></div>';

    const testSnap = await get(ref(db, 'tests'));
    const allTests = testSnap.val() || {};
    let totalScore = 0, totalPossible = 0, examCount = 0;
    let grades = {}, subjectStats = {}, weeklyData = {};

    for (const [testId, testData] of Object.entries(allTests)) {
        const resSnap = await get(ref(db, `results/${testId}/${currentUser}`));
        if (resSnap.exists()) {
            const res = resSnap.val();
            examCount++;
            totalScore += res.score;
            totalPossible += res.total;
            if (testData.grade) grades[testData.grade] = (grades[testData.grade] || 0) + 1;

            let subject = testData.subject || "عام";
            if (!testData.subject && testData.title) {
                if (testData.title.includes("فيزياء")) subject = "فيزياء";
                else if (testData.title.includes("كيمياء")) subject = "كيمياء";
                else if (testData.title.includes("أحياء")) subject = "أحياء";
                else if (testData.title.includes("رياضيات")) subject = "رياضيات";
                else if (testData.title.includes("عربي")) subject = "لغة عربية";
                else if (testData.title.includes("نجليزي") || testData.title.includes("انجليزي")) subject = "إنجليزية";
            }
            if (!subjectStats[subject]) subjectStats[subject] = { score: 0, total: 0, count: 0 };
            subjectStats[subject].score += res.score;
            subjectStats[subject].total += res.total;
            subjectStats[subject].count++;

            const weekKey = new Date(res.timestamp).toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' });
            if (!weeklyData[weekKey]) weeklyData[weekKey] = { score: 0, total: 0 };
            weeklyData[weekKey].score += res.score;
            weeklyData[weekKey].total += res.total;
        }
    }

    if (examCount === 0) {
        content.innerHTML = '<div style="text-align:center;padding:40px;color:#888;"><div style="font-size:3rem;margin-bottom:15px;">📊</div><p>لم تقم بأي اختبارات بعد</p></div>';
        return;
    }

    const overallPct = Math.round((totalScore / totalPossible) * 100);
    let levelLabel = "مبتدئ", levelColor = "#aaa";
    if (overallPct >= 90) { levelLabel = "عبقري"; levelColor = "var(--accent-gold)"; }
    else if (overallPct >= 75) { levelLabel = "ممتاز"; levelColor = "var(--success)"; }
    else if (overallPct >= 60) { levelLabel = "جيد جداً"; levelColor = "var(--accent-primary)"; }
    else if (overallPct >= 50) { levelLabel = "جيد"; levelColor = "var(--warning)"; }
    else { levelLabel = "يحتاج تحسين"; levelColor = "var(--danger)"; }

    const xpData = getXPData();
    const xpLevel = getCurrentLevel(xpData.totalXP);

    const subjectEntries = Object.entries(subjectStats);
    const worstSubject = subjectEntries.reduce((w, [s, d]) => {
        const p = d.total > 0 ? d.score / d.total : 1;
        return p < (w.pct ?? 1) ? { name: s, pct: p } : w;
    }, { name: '-', pct: 1 });

    const weeklyEntries = Object.entries(weeklyData).slice(-7);
    const maxWeekly = Math.max(...weeklyEntries.map(([, d]) => d.total > 0 ? Math.round(d.score / d.total * 100) : 0), 1);

    const subjectBars = subjectEntries.map(([subj, data]) => {
        const pct = Math.round((data.score / data.total) * 100);
        const col = pct >= 75 ? 'var(--success)' : pct >= 50 ? 'var(--accent-gold)' : 'var(--danger)';
        return `<div class="ana-subject-row">
            <div class="ana-subject-label">${subj}</div>
            <div class="ana-bar-wrap"><div class="ana-bar-fill" style="width:${pct}%;background:${col};"></div></div>
            <div class="ana-subject-pct" style="color:${col};">${pct}%</div>
        </div>`;
    }).join('');

    const weeklyBars = weeklyEntries.map(([dateKey, data]) => {
        const pct = data.total > 0 ? Math.round(data.score / data.total * 100) : 0;
        const h = Math.round((pct / maxWeekly) * 100);
        const col = pct >= 75 ? 'var(--success)' : pct >= 50 ? 'var(--accent-gold)' : 'var(--danger)';
        return `<div class="ana-chart-bar-wrap">
            <div class="ana-chart-bar-pct">${pct}%</div>
            <div class="ana-chart-bar" style="height:${Math.max(h, 5)}%;background:${col};"></div>
            <div class="ana-chart-label">${dateKey}</div>
        </div>`;
    }).join('');

    const donutOffset = 100 - overallPct;

    content.innerHTML = `
        <div class="ana-hero">
            <div class="ana-donut-wrap">
                <svg viewBox="0 0 36 36" class="ana-donut-svg">
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="#1a1a1a" stroke-width="3.8"/>
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="${levelColor}" stroke-width="3.8"
                        stroke-dasharray="${overallPct} ${100-overallPct}" stroke-dashoffset="25"
                        stroke-linecap="round" class="ana-donut-ring"/>
                </svg>
                <div class="ana-donut-center">
                    <div class="ana-donut-pct" style="color:${levelColor};">${overallPct}%</div>
                    <div class="ana-donut-lbl">${levelLabel}</div>
                </div>
            </div>
            <div class="ana-hero-stats">
                <div class="ana-stat-chip"><span class="ana-stat-val">${examCount}</span><span class="ana-stat-name">اختبار</span></div>
                <div class="ana-stat-chip"><span class="ana-stat-val" style="color:var(--accent-gold);">⚡${xpData.totalXP}</span><span class="ana-stat-name">XP</span></div>
                <div class="ana-stat-chip"><span class="ana-stat-val" style="color:#f97316;">🔥${xpData.streak}</span><span class="ana-stat-name">أيام</span></div>
                <div class="ana-stat-chip"><span class="ana-stat-val">${xpLevel.icon}</span><span class="ana-stat-name">${xpLevel.name}</span></div>
            </div>
        </div>

        <div class="ana-section-title"><i class="ph-bold ph-chart-bar"></i> أداء المواد</div>
        <div class="ana-subjects">${subjectBars}</div>

        <div class="ana-section-title"><i class="ph-bold ph-trend-up"></i> التقدم الأسبوعي</div>
        <div class="ana-chart-area">${weeklyBars}</div>

        <div class="ana-insights">
            <div class="ana-insight-card warn">
                <i class="ph-bold ph-warning-circle"></i>
                <div>
                    <div style="font-weight:700;margin-bottom:3px;">أضعف مادة</div>
                    <div style="color:#aaa;font-size:0.85rem;">${worstSubject.name !== '-' ? worstSubject.name + ' · ' + Math.round(worstSubject.pct*100) + '%' : 'لا بيانات'}</div>
                </div>
            </div>
            <div class="ana-insight-card ok">
                <i class="ph-bold ph-medal"></i>
                <div>
                    <div style="font-weight:700;margin-bottom:3px;">الشارات</div>
                    <div style="color:#aaa;font-size:0.85rem;">${xpData.earnedBadges.length} شارة مكتسبة</div>
                </div>
            </div>
        </div>
        <div style="text-align:center;font-size:0.75rem;color:#555;margin-top:15px;">بناءً على ${examCount} اختبار</div>
    `;
};


const XP_LEVELS = [
    { name: 'مبتدئ', minXP: 0, maxXP: 200, cssClass: 'level-1', icon: '🌱', unlocks: 'اختبارات سهلة' },
    { name: 'متوسط', minXP: 200, maxXP: 600, cssClass: 'level-2', icon: '📘', unlocks: 'تحديات أصعب' },
    { name: 'متقدم', minXP: 600, maxXP: 1200, cssClass: 'level-3', icon: '⚡', unlocks: 'وضع تحدي الوقت' },
    { name: 'خبير', minXP: 1200, maxXP: Infinity, cssClass: 'level-4', icon: '👑', unlocks: 'لوحة الشرف الذهبية' }
];

const BADGES_DEF = [
    { id: 'first_exam', label: '🥇 أول اختبار', condition: (s) => s.totalExams >= 1 },
    { id: 'streak5', label: '🔥 5 أيام متتالية', condition: (s) => s.streak >= 5 },
    { id: 'correct100', label: '🎯 100 إجابة صحيحة', condition: (s) => s.correctAnswers >= 100 },
    { id: 'speed_demon', label: '⚡ منهي سريع', condition: (s) => s.fastFinishes >= 1 },
    { id: 'perfect', label: '💯 إجابة مثالية', condition: (s) => s.perfectExams >= 1 },
    { id: 'streak3', label: '🔥 3 أيام متتالية', condition: (s) => s.streak >= 3 },
];

const DAILY_XP_GOAL = 50;
const REWARD_BOX_THRESHOLD = 200;

function getXPData() {
    const key = `xp_data_${currentUser}`;
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw);
    return {
        totalXP: 0,
        dailyXP: 0,
        dailyDate: '',
        streak: 0,
        lastPlayDate: '',
        totalExams: 0,
        correctAnswers: 0,
        fastFinishes: 0,
        perfectExams: 0,
        earnedBadges: [],
        lifetimeXP: 0,
        rewardBoxCount: 0,
        lastRewardAt: 0,
    };
}

function saveXPData(data) {
    localStorage.setItem(`xp_data_${currentUser}`, JSON.stringify(data));
}

function getCurrentLevel(xp) {
    for (let i = XP_LEVELS.length - 1; i >= 0; i--) {
        if (xp >= XP_LEVELS[i].minXP) return XP_LEVELS[i];
    }
    return XP_LEVELS[0];
}

function updateStreakOnLogin() {
    const data = getXPData();
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    if (data.lastPlayDate === today) return data;
    if (data.lastPlayDate === yesterday) {
        data.streak += 1;
    } else if (data.lastPlayDate !== '') {
        data.streak = 1;
    } else {
        data.streak = 1;
    }
    data.lastPlayDate = today;
    if (today !== data.dailyDate) {
        data.dailyXP = 0;
        data.dailyDate = today;
    }
    saveXPData(data);
    return data;
}

function showXPGainToast(amount, reason) {
    const el = document.createElement('div');
    el.className = 'xp-gain-toast';
    el.innerHTML = `+${amount} XP ${reason}`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2100);
}

function checkAndAwardBadges(data) {
    let newBadge = false;
    BADGES_DEF.forEach(b => {
        if (!data.earnedBadges.includes(b.id) && b.condition(data)) {
            data.earnedBadges.push(b.id);
            newBadge = true;
            showToast('شارة جديدة! ' + b.label, '', 'success', 4000);
        }
    });
    return newBadge;
}

function checkRewardBox(data) {
    const boxes = Math.floor(data.lifetimeXP / REWARD_BOX_THRESHOLD);
    if (boxes > data.rewardBoxCount) {
        data.rewardBoxCount = boxes;
        const rewards = [
            { title: '🎉 +30 XP مجاني!', msg: 'حظ سعيد! حصلت على مكافأة XP.', xp: 30 },
            { title: '🏅 لقب خاص: نجم ساطع', msg: 'أنت تستحق هذا اللقب!', xp: 0 },
            { title: '⚡ +50 XP بونص!', msg: 'استمر في التقدم!', xp: 50 },
        ];
        const r = rewards[Math.floor(Math.random() * rewards.length)];
        if (r.xp > 0) { data.totalXP += r.xp; data.lifetimeXP += r.xp; data.dailyXP += r.xp; }
        document.getElementById('xp-reward-title').innerText = r.title;
        document.getElementById('xp-reward-msg').innerText = r.msg;
        document.getElementById('xp-reward-modal').classList.remove('hidden');
        document.getElementById('xp-reward-icon').style.animation = 'none';
        setTimeout(() => { document.getElementById('xp-reward-icon').style.animation = 'rewardPop 0.5s ease'; }, 50);
    }
    return data;
}

function awardXP(baseXP, reason, opts = {}) {
    if (selectedRole !== 'student') return;
    let data = getXPData();
    const today = new Date().toDateString();
    if (today !== data.dailyDate) { data.dailyXP = 0; data.dailyDate = today; }

    let bonus = 0;
    let bonusMsg = '';
    if (opts.allCorrect) { bonus += Math.round(baseXP * 0.5); bonusMsg += ' 🎯بونص مثالي'; }
    if (opts.fast) { bonus += Math.round(baseXP * 0.3); bonusMsg += ' ⚡بونص سرعة'; }

    let multiplier = 1;
    if (data.streak >= 3) { multiplier = 1.5; bonusMsg += ' 🔥×1.5'; }

    const earned = Math.round((baseXP + bonus) * multiplier);
    data.totalXP += earned;
    data.lifetimeXP += earned;
    data.dailyXP += earned;
    if (opts.examCompleted) data.totalExams += 1;
    if (opts.correctCount) data.correctAnswers += opts.correctCount;
    if (opts.fast) data.fastFinishes += 1;
    if (opts.allCorrect) data.perfectExams += 1;

    checkAndAwardBadges(data);
    data = checkRewardBox(data);
    saveXPData(data);

    showXPGainToast(earned, reason + bonusMsg);
    renderXPHud();
}

function renderXPHud() {
    if (selectedRole !== 'student') return;
    const data = getXPData();
    const level = getCurrentLevel(data.totalXP);
    const el = document.getElementById('xp-level-badge');
    if (el) {
        el.className = 'xp-level-badge ' + level.cssClass;
        document.getElementById('xp-level-name').innerText = level.icon + ' ' + level.name;
    }
    const sc = document.getElementById('xp-streak-count');
    if (sc) sc.innerText = data.streak;
    const tc = document.getElementById('xp-total-count');
    if (tc) tc.innerText = data.totalXP;
    const pct = Math.min(100, Math.round((data.dailyXP / DAILY_XP_GOAL) * 100));
    const fill = document.getElementById('xp-daily-fill');
    if (fill) fill.style.width = pct + '%';
    const lbl = document.getElementById('xp-daily-label');
    if (lbl) lbl.innerText = `${data.dailyXP} / ${DAILY_XP_GOAL} XP`;

    const badgesRow = document.getElementById('xp-badges-row');
    if (badgesRow) {
        badgesRow.innerHTML = '';
        data.earnedBadges.forEach(bid => {
            const def = BADGES_DEF.find(b => b.id === bid);
            if (def) {
                const chip = document.createElement('div');
                chip.className = 'xp-badge-chip';
                chip.innerText = def.label;
                badgesRow.appendChild(chip);
            }
        });
    }
}

window.openLeaderboard = async () => {
    document.getElementById('leaderboard-modal').classList.remove('hidden');
    const list = document.getElementById('leaderboard-list');
    list.innerHTML = '<div style="text-align:center;"><i class="fas fa-spinner fa-spin"></i> جاري التحميل...</div>';

    const myData = getXPData();
    await update(ref(db, `xp_scores/${currentUser}`), { xp: myData.totalXP, name: currentUser });

    const snap = await get(ref(db, 'xp_scores'));
    list.innerHTML = '';
    if (!snap.exists()) { list.innerHTML = '<p style="color:#666; text-align:center;">لا يوجد بيانات بعد</p>'; return; }

    const entries = [];
    snap.forEach(child => { entries.push({ name: child.val().name || child.key, xp: child.val().xp || 0 }); });
    entries.sort((a, b) => b.xp - a.xp);

    const medals = ['🥇', '🥈', '🥉'];
    entries.slice(0, 10).forEach((entry, i) => {
        const div = document.createElement('div');
        div.className = 'leaderboard-item' + (i < 3 ? ` top-${i+1}` : '');
        const isMe = entry.name === currentUser;
        div.innerHTML = `
            <div class="leaderboard-rank">${medals[i] || (i+1)}</div>
            <div class="leaderboard-name">${entry.name}${isMe ? ' <span style="color:var(--accent-primary); font-size:0.75rem;">(أنت)</span>' : ''}</div>
            <div class="leaderboard-xp"><i class="fas fa-bolt"></i> ${entry.xp} XP</div>
        `;
        list.appendChild(div);
    });
    if (entries.length === 0) list.innerHTML = '<p style="color:#666; text-align:center;">لا يوجد بيانات كافية بعد</p>';
};

const _origSubmitExam = window.submitExam;
window.submitExam = async function() {
    const startTime = window._examStartTime || Date.now();
    const durationMs = (activeTest ? activeTest.duration * 60 * 1000 : 999999999);
    const elapsed = Date.now() - startTime;
    const fast = elapsed < durationMs * 0.5;

    let score = 0, total = 0;
    const questions = activeTest ? activeTest.questions || [] : [];
    questions.forEach((q, i) => {
        const pts = parseInt(q.points) || 1;
        total += pts;
        if (q.type === 'essay') { if (answers[i] && answers[i].trim().length > 2) score += pts; }
        else { if (answers[i] === q.correct) score += pts; }
    });
    const allCorrect = total > 0 && score === total;
    const correctCount = questions.filter((q, i) => {
        if (q.type === 'essay') return answers[i] && answers[i].trim().length > 2;
        return answers[i] === q.correct;
    }).length;
    const baseXP = Math.max(10, Math.round((score / Math.max(total, 1)) * 50));

    await _origSubmitExam.call(this);

    const xpData = getXPData();
    const streakMultiplier = xpData.streak >= 3 ? 1.5 : 1;
    awardXP(baseXP, '🎓 إتمام اختبار', {
        allCorrect,
        fast,
        examCompleted: true,
        correctCount,
    });
    renderXPHud();
};

const _origStartTest = window.startTest;
window.startTest = async function(id) {
    window._examStartTime = Date.now();
    await _origStartTest.call(this, id);
};

const savedUser = localStorage.getItem('sa_user'); const savedRole = localStorage.getItem('sa_role'); const savedIcon = localStorage.getItem('sa_icon'); const savedUid = localStorage.getItem('sa_uid');
if (savedUser && savedRole) {
    currentUser = savedUser; selectedRole = savedRole; myUid = savedUid;
    document.getElementById('landing-layer').classList.add('hidden');
    loginSuccess(currentUser, savedIcon, savedUid);
} else { document.getElementById('landing-layer').classList.remove('hidden'); }

let deferredPrompt;
const pwaBanner = document.getElementById('pwa-install-banner');

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    setTimeout(() => {
        pwaBanner.classList.add('visible');
    }, 2000); 
});

window.installPWA = async () => {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            deferredPrompt = null;
        }
        closePWA();
    }
};

window.closePWA = () => {
    pwaBanner.classList.remove('visible');
};

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./service-worker.js');
    });
}

// ======================================================
// SA EDU — DIRECT VOICE CALL SYSTEM (PeerJS-based)
// ======================================================

let _dcPeer = null;
let _dcLocalStream = null;
let _dcRemoteConn = null;
let _dcCallTimer = null;
let _dcSeconds = 0;
let _dcMuted = false;
let _dcActiveCallId = null;
let _dcCallerData = null;

function getDCPeer() {
    if (_dcPeer && !_dcPeer.destroyed) return _dcPeer;
    const peerId = 'sa-edu-' + myUid;
    _dcPeer = new Peer(peerId, {
        debug: 0,
        config: {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        }
    });
    _dcPeer.on('call', (incomingCall) => {
        // Incoming call notification via Firebase
        // incomingCall.metadata has caller info
        const meta = incomingCall.metadata || {};
        showIncomingCallNotification(meta.callerName || '...', meta.callerIcon || 'fa-user', incomingCall);
    });
    _dcPeer.on('error', (err) => { console.error('PeerJS error:', err); });
    return _dcPeer;
}

window.startDirectCall = async (targetUid, targetName, targetIcon) => {
    if (!targetUid || targetUid === myUid) return;
    _callTargetUid = targetUid;
    _callTargetName = targetName;
    _callTargetIcon = targetIcon || 'fa-user';
    
    try {
        _dcLocalStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    } catch(e) {
        saAlert('يرجى السماح بالوصول للمايكروفون.', 'error');
        return;
    }
    
    const peer = getDCPeer();
    const targetPeerId = 'sa-edu-' + targetUid;
    
    // Notify target via Firebase signaling
    const callSignalRef = ref(db, `call_signals/${targetUid}`);
    await set(callSignalRef, {
        callerUid: myUid,
        callerName: currentUser,
        callerIcon: localStorage.getItem('sa_icon') || 'fa-user-astronaut',
        callerPeerId: peer.id,
        timestamp: Date.now()
    });
    
    // Show calling UI
    showCallOverlay(targetName, targetIcon, 'calling');
    
    // Actually call via PeerJS
    try {
        _dcRemoteConn = peer.call(targetPeerId, _dcLocalStream, {
            metadata: { callerName: currentUser, callerIcon: localStorage.getItem('sa_icon') || 'fa-user-astronaut' }
        });
        
        if (_dcRemoteConn) {
            _dcRemoteConn.on('stream', (remoteStream) => {
                const audio = document.getElementById('direct-call-remote-audio');
                if (audio) { audio.srcObject = remoteStream; }
                onCallConnected();
            });
            _dcRemoteConn.on('close', () => { endDirectCall(); });
            _dcRemoteConn.on('error', (e) => { console.error(e); endDirectCall(); });
        }
    } catch(e) { 
        console.error(e);
        saAlert('تعذر بدء المكالمة.', 'error');
        endDirectCall();
    }
    
    // Auto-cancel after 30s if not answered
    setTimeout(() => {
        if (_dcRemoteConn && !_dcRemoteConn.open) { endDirectCall(); }
    }, 30000);
};

function showIncomingCallNotification(callerName, callerIcon, incomingCall) {
    _dcCallerData = incomingCall;
    
    // Show toast notification
    const toast = document.getElementById('call-toast-banner');
    const toastAvatar = document.getElementById('call-toast-avatar');
    const toastName = document.getElementById('call-toast-name');
    if (toast) {
        toastAvatar.innerHTML = `<i class="fas ${callerIcon}"></i>`;
        toastName.textContent = callerName;
        toast.classList.add('show');
    }
    
    // Also show overlay
    showCallOverlay(callerName, callerIcon, 'incoming');
    
    // Auto-reject after 25s
    setTimeout(() => {
        if (_dcCallerData) { 
            toast?.classList.remove('show');
            hideCallOverlay();
        }
    }, 25000);
}

function showCallOverlay(name, icon, mode) {
    const overlay = document.getElementById('direct-call-overlay');
    const avatarEl = document.getElementById('call-overlay-avatar');
    const nameEl = document.getElementById('call-overlay-name');
    const statusEl = document.getElementById('call-overlay-status');
    const acceptBtn = document.getElementById('call-accept-btn');
    const muteRow = document.getElementById('call-mute-row');
    
    if (!overlay) return;
    if (avatarEl) avatarEl.innerHTML = `<i class="fas ${icon}"></i>`;
    if (nameEl) nameEl.textContent = name;
    
    if (mode === 'calling') {
        if (statusEl) statusEl.textContent = 'جاري الاتصال...';
        if (acceptBtn) acceptBtn.style.display = 'none';
        if (muteRow) muteRow.style.display = 'none';
    } else if (mode === 'incoming') {
        if (statusEl) statusEl.textContent = 'مكالمة واردة...';
        if (acceptBtn) acceptBtn.style.display = 'flex';
        if (muteRow) muteRow.style.display = 'none';
    }
    
    overlay.classList.add('show');
    overlay.classList.remove('in-call');
}

function hideCallOverlay() {
    const overlay = document.getElementById('direct-call-overlay');
    if (overlay) overlay.classList.remove('show', 'in-call');
}

function onCallConnected() {
    const overlay = document.getElementById('direct-call-overlay');
    const statusEl = document.getElementById('call-overlay-status');
    const muteRow = document.getElementById('call-mute-row');
    
    if (overlay) overlay.classList.add('in-call');
    if (statusEl) statusEl.textContent = 'متصل';
    if (muteRow) muteRow.style.display = 'flex';
    
    // Hide toast
    document.getElementById('call-toast-banner')?.classList.remove('show');
    
    // Start timer
    _dcSeconds = 0;
    _dcCallTimer = setInterval(() => {
        _dcSeconds++;
        const m = Math.floor(_dcSeconds / 60);
        const s = _dcSeconds % 60;
        const timerEl = document.getElementById('call-duration-timer');
        if (timerEl) timerEl.textContent = `${m}:${s.toString().padStart(2,'0')}`;
    }, 1000);
}

window.acceptDirectCall = async () => {
    document.getElementById('call-toast-banner')?.classList.remove('show');
    
    if (_dcCallerData) {
        // Incoming call from PeerJS
        try {
            _dcLocalStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            _dcCallerData.answer(_dcLocalStream);
            _dcRemoteConn = _dcCallerData;
            _dcCallerData = null;
            
            _dcRemoteConn.on('stream', (remoteStream) => {
                const audio = document.getElementById('direct-call-remote-audio');
                if (audio) { audio.srcObject = remoteStream; }
                onCallConnected();
            });
            _dcRemoteConn.on('close', () => { endDirectCall(); });
        } catch(e) {
            saAlert('يرجى السماح بالوصول للمايكروفون.', 'error');
            hideCallOverlay();
        }
    }
};

window.rejectOrEndDirectCall = () => {
    document.getElementById('call-toast-banner')?.classList.remove('show');
    _dcCallerData = null;
    endDirectCall();
};

function endDirectCall() {
    if (_dcCallTimer) { clearInterval(_dcCallTimer); _dcCallTimer = null; }
    if (_dcRemoteConn) { try { _dcRemoteConn.close(); } catch(e) {} _dcRemoteConn = null; }
    if (_dcLocalStream) { _dcLocalStream.getTracks().forEach(t => t.stop()); _dcLocalStream = null; }
    const audio = document.getElementById('direct-call-remote-audio');
    if (audio) { audio.srcObject = null; }
    hideCallOverlay();
    _dcCallerData = null;
    _dcSeconds = 0;
}

window.toggleCallMute = () => {
    _dcMuted = !_dcMuted;
    if (_dcLocalStream) {
        _dcLocalStream.getAudioTracks().forEach(t => { t.enabled = !_dcMuted; });
    }
    const btn = document.getElementById('call-mute-btn');
    if (btn) {
        btn.classList.toggle('active', _dcMuted);
        btn.innerHTML = _dcMuted ? '<i class="ph-bold ph-microphone-slash"></i>' : '<i class="ph-bold ph-microphone"></i>';
    }
};

window.toggleCallSpeaker = () => {
    const btn = document.getElementById('call-speaker-btn');
    if (btn) btn.classList.toggle('active');
};

// Listen for incoming call signals via Firebase
function listenForCallSignals() {
    if (!myUid) return;
    const signalRef = ref(db, `call_signals/${myUid}`);
    onValue(signalRef, async (snap) => {
        if (!snap.exists()) return;
        const data = snap.val();
        // Only process recent signals (within 30s)
        if (Date.now() - data.timestamp > 30000) { await remove(signalRef); return; }
        
        // Show incoming call notification
        showIncomingCallNotification(data.callerName, data.callerIcon, null);
        
        // Wait for PeerJS incoming call event
        // Clean signal
        await remove(signalRef);
    });
}

// Attach call signal listener after login
const _origLoginSuccess = loginSuccess;
// We can't easily override loginSuccess, so we'll call it in the existing listener.
// Add to initVoiceModule callback or after initialization:

// Watch for Firebase call signals
const _watchCallsInterval = setInterval(() => {
    if (myUid && db) {
        listenForCallSignals();
        clearInterval(_watchCallsInterval);
    }
}, 1000);


// ======================================================
// SA EDU — HERO SECTION UPDATES
// ======================================================

function updateHeroSections() {
    try {
        const icon = localStorage.getItem('sa_icon') || 'fa-user-astronaut';
        if (selectedRole === 'teacher') {
            const heroAvatar = document.getElementById('teacher-hero-avatar');
            const heroName = document.getElementById('teacher-hero-name');
            if (heroAvatar) { 
                heroAvatar.innerHTML = `<i class="fas ${icon}"></i>`;
                heroAvatar.style.color = 'var(--accent-gold)';
                heroAvatar.style.borderColor = 'var(--accent-gold)';
            }
            if (heroName) heroName.textContent = currentUser?.split(' ')[0] || 'المعلم';
        } else {
            const heroAvatar = document.getElementById('student-hero-avatar');
            const heroName = document.getElementById('student-hero-name');
            if (heroAvatar) {
                heroAvatar.innerHTML = `<i class="fas ${icon}"></i>`;
            }
            if (heroName) heroName.textContent = currentUser?.split(' ')[0] || 'الطالب';
        }
    } catch(e) {}
}

// Update heroes when tab switches
const _origSwitchTab = window.switchTab;
window.switchTab = (tabId, btn) => {
    _origSwitchTab(tabId, btn);
    setTimeout(updateHeroSections, 100);
    setTimeout(() => {
        const xpCount = document.getElementById('xp-total-count');
        const heroXp = document.getElementById('student-hero-xp');
        if (xpCount && heroXp) heroXp.textContent = xpCount.textContent + ' XP';
    }, 500);
};

// Update exam count for teacher hero
function updateTeacherExamCount(count) {
    const el = document.getElementById('teacher-exam-count');
    if (el) el.textContent = count;
}


// ══════════════════════════════════════════════════════
//  TEACHER ANALYTICS
// ══════════════════════════════════════════════════════
window.loadTeacherAnalytics = async function() {
    try {
        const testsSnap = await get(ref(db, `tests`));
        let totalExams = 0, totalStudents = 0, scores = [], recentActivity = [];
        
        if (testsSnap.exists()) {
            testsSnap.forEach(testNode => {
                const t = testNode.val();
                if (t.uid === myUid) {
                    totalExams++;
                    // Count attempts
                    if (t.attempts) {
                        const attList = Object.values(t.attempts);
                        attList.forEach(a => {
                            scores.push(Math.round((a.score / (t.questions?.length || 1)) * 100));
                            recentActivity.push({
                                name: t.title,
                                student: a.name || 'طالب',
                                score: Math.round((a.score / (t.questions?.length || 1)) * 100),
                                time: a.time || 0
                            });
                        });
                    }
                }
            });
        }
        
        const avgScore = scores.length ? Math.round(scores.reduce((a,b)=>a+b,0)/scores.length) : 0;
        totalStudents = scores.length;
        
        const el = (id) => document.getElementById(id);
        if(el('t-stat-total-exams')) el('t-stat-total-exams').textContent = totalExams;
        if(el('t-stat-total-students')) el('t-stat-total-students').textContent = totalStudents;
        if(el('t-stat-avg-score')) el('t-stat-avg-score').textContent = avgScore + '%';
        
        const actList = el('t-recent-activity');
        if (actList) {
            recentActivity.sort((a,b)=>b.time-a.time);
            if (recentActivity.length === 0) {
                actList.innerHTML = '<div style="text-align:center;color:#444;padding:30px;font-size:0.85rem;"><i class="fas fa-chart-line" style="font-size:2rem;margin-bottom:10px;display:block;opacity:0.3;"></i>ستظهر هنا آخر نتائج طلابك</div>';
            } else {
                actList.innerHTML = recentActivity.slice(0,10).map(a => `
                    <div class="analytics-recent-item">
                        <div>
                            <div class="item-name">${a.name}</div>
                            <div style="font-size:0.72rem;color:#555;">${a.student}</div>
                        </div>
                        <div class="item-score">${a.score}%</div>
                    </div>`).join('');
            }
        }
    } catch(e) { console.error('Analytics error:', e); }
};

// ══════════════════════════════════════════════════════
//  STUDENT PROGRESS
// ══════════════════════════════════════════════════════
window.loadStudentProgress = async function() {
    const el = (id) => document.getElementById(id);
    // Show loading state
    if(el('s-prog-exams')) el('s-prog-exams').textContent = '...';
    if(el('s-prog-avg')) el('s-prog-avg').textContent = '...';
    if(el('s-subj-breakdown-content')) el('s-subj-breakdown-content').innerHTML = '<div style="text-align:center;padding:20px;color:#555;"><i class="fas fa-circle-notch fa-spin"></i></div>';

    try {
        // ── Fetch all tests meta ──
        const testsSnap = await get(ref(db, 'tests'));
        const allTests = testsSnap.exists() ? testsSnap.val() : {};
        
        let takenCount = 0, scores = [], subjScores = {};
        const SUBJ_COLORS = {
            'رياضيات':'#3b82f6','فيزياء':'#f59e0b','كيمياء':'#8b5cf6',
            'أحياء':'#10b981','عربية':'#ef4444','إنجليزية':'#06b6d4',
            'تاريخ':'#d97706','علوم':'#84cc16','حاسب':'#6366f1','عام':'#6366f1'
        };

        // ── Loop each test and check if this student has a result ──
        const promises = Object.entries(allTests).map(async ([testId, testData]) => {
            const resSnap = await get(ref(db, `results/${testId}/${currentUser}`));
            if (resSnap.exists()) {
                const res = resSnap.val();
                const pct = res.percentage !== undefined ? Math.round(res.percentage) : Math.round((res.score / (res.total || 1)) * 100);
                scores.push(pct);
                takenCount++;
                
                let subj = testData.subject || 'عام';
                // Auto-detect from title if no subject
                if (!testData.subject && testData.title) {
                    const t = testData.title;
                    if (t.includes('فيزياء')) subj = 'فيزياء';
                    else if (t.includes('كيمياء')) subj = 'كيمياء';
                    else if (t.includes('أحياء') || t.includes('احياء')) subj = 'أحياء';
                    else if (t.includes('رياضيات') || t.includes('رياضه')) subj = 'رياضيات';
                    else if (t.includes('عربي')) subj = 'عربية';
                    else if (t.includes('نجليز') || t.includes('انجليز')) subj = 'إنجليزية';
                    else if (t.includes('حاسب') || t.includes('كمبيوتر')) subj = 'حاسب';
                }
                if (!subjScores[subj]) subjScores[subj] = [];
                subjScores[subj].push(pct);
            }
        });
        await Promise.all(promises);

        const avgScore = scores.length ? Math.round(scores.reduce((a,b)=>a+b,0)/scores.length) : 0;
        const xpData2 = getXPData ? getXPData() : {totalXP:0};
        const xp = xpData2.totalXP || '0';

        // ── Update stat cards ──
        if(el('s-prog-exams')) el('s-prog-exams').textContent = takenCount;
        if(el('s-prog-avg')) el('s-prog-avg').textContent = avgScore ? avgScore + '%' : '--';
        if(el('s-prog-xp')) el('s-prog-xp').textContent = xp + ' XP';

        const trendEl = el('s-prog-avg-trend');
        if (trendEl) {
            if (avgScore >= 90)      { trendEl.textContent = '🌟 ممتاز!'; trendEl.className = 'stat-trend'; }
            else if (avgScore >= 75) { trendEl.textContent = '👍 جيد جداً'; trendEl.className = 'stat-trend'; }
            else if (avgScore >= 60) { trendEl.textContent = '✔ جيد'; trendEl.className = 'stat-trend'; }
            else if (avgScore > 0)   { trendEl.textContent = '💪 تحتاج تحسين'; trendEl.className = 'stat-trend down'; }
            else                     { trendEl.textContent = 'لم تؤدِ اختبارات بعد'; }
        }

        // ── Subject breakdown bars ──
        const breakdownEl = el('s-subj-breakdown-content');
        if (breakdownEl) {
            if (Object.keys(subjScores).length === 0) {
                breakdownEl.innerHTML = '<div style="text-align:center;color:#444;padding:24px;font-size:0.85rem;"><i class="fas fa-chart-pie" style="font-size:2rem;margin-bottom:10px;display:block;opacity:0.3;"></i>أدِّ بعض الاختبارات لترى تحليل مواد دراستك</div>';
            } else {
                const sorted = Object.entries(subjScores).sort((a,b) => {
                    const avgA = a[1].reduce((x,y)=>x+y,0)/a[1].length;
                    const avgB = b[1].reduce((x,y)=>x+y,0)/b[1].length;
                    return avgB - avgA;
                });
                breakdownEl.innerHTML = sorted.map(([subj, arr]) => {
                    const avg = Math.round(arr.reduce((a,b)=>a+b,0)/arr.length);
                    const color = SUBJ_COLORS[subj] || '#6366f1';
                    const html = '<div class="subj-bar-row">' +
                        '<div class="subj-bar-name">' + subj + '</div>' +
                        '<div class="subj-bar-track">' +
                            '<div class="subj-bar-fill" style="width:' + avg + '%;background:' + color + ';"></div>' +
                        '</div>' +
                        '<div class="subj-bar-pct" style="color:' + color + ';">' + avg + '%</div>' +
                    '</div>';
                    return html;
                }).join('');
            }
        }

        // ── Leaderboard from xp_scores ──
        const lbEl = el('s-leaderboard-list');
        if (lbEl) {
            const xpSnap = await get(ref(db, 'xp_scores'));
            if (xpSnap.exists()) {
                const users = [];
                xpSnap.forEach(u => {
                    const d = u.val();
                    users.push({ name: d.name || u.key, xp: d.xp || 0 });
                });
                users.sort((a,b) => b.xp - a.xp);
                const medals = ['🥇','🥈','🥉'];
                lbEl.innerHTML = users.slice(0,10).map((u,i) => `
                    <div class="leaderboard-item ${i<3?'rank-'+(i+1):''}">
                        <div class="leaderboard-rank">${medals[i]||(i+1+'.')}</div>
                        <div class="leaderboard-crown">👑</div>
                        <div style="width:32px;height:32px;border-radius:50%;background:#111;display:flex;align-items:center;justify-content:center;font-size:0.85rem;border:1px solid #222;flex-shrink:0;">
                            <i class="fas fa-user-graduate" style="color:#888;"></i>
                        </div>
                        <div class="leaderboard-name">${u.name}${u.name===currentUser?'<span style="color:#60a5fa;font-size:0.7rem;margin-right:5px;">أنت</span>':''}</div>
                        <div class="leaderboard-xp">⚡ ${u.xp}</div>
                    </div>`).join('');
            } else {
                lbEl.innerHTML = '<div style="text-align:center;color:#444;padding:24px;"><i class="fas fa-users" style="font-size:2rem;margin-bottom:10px;display:block;opacity:0.3;"></i>لا توجد بيانات بعد</div>';
            }
        }
    } catch(e) {
        console.error('Progress error:', e);
        const el2 = (id) => document.getElementById(id);
        if(el2('s-prog-exams')) el2('s-prog-exams').textContent = '!';
    }
};

// ══════════════════════════════════════════════════════════════════
//  CHAT UPGRADE v8: GROUPS + AI IN CHAT + REACTIONS + REPLY
// ══════════════════════════════════════════════════════════════════

let _currentChatTab = {}; // { 't': 'chats'|'groups', 's': 'chats'|'groups' }
let _selectedGroupEmoji = '📚';
let _createGroupMembers = [];

// ── Switch between "المحادثات" and "الجروبات" tabs ──
window.switchChatTab = (prefix, type, btn) => {
    _currentChatTab[prefix] = type;
    document.querySelectorAll(`#${prefix}-chat-type-tabs .chat-type-tab`).forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    const list = document.getElementById(`${prefix}-chat-list`);
    list.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;padding:30px;color:#444;"><i class="fas fa-circle-notch fa-spin" style="margin-left:8px;"></i></div>';
    if (type === 'chats') {
        initDardasha_real(prefix);
    } else {
        loadGroupsList(prefix);
    }
};

// ── Plus menu (new chat / new group) ──
window.showChatPlusMenu = (prefix) => {
    const existing = document.getElementById('chat-plus-menu-popup');
    if (existing) { existing.remove(); return; }
    
    const menu = document.createElement('div');
    menu.id = 'chat-plus-menu-popup';
    menu.className = 'chat-plus-menu';
    menu.style.cssText = 'bottom:80px;left:16px;';
    menu.innerHTML = `
        <button onclick="toggleUserSearchModal();document.getElementById('chat-plus-menu-popup')?.remove()">
            <i class="fas fa-user-plus" style="color:#60a5fa;"></i> محادثة جديدة
        </button>
        <button onclick="openCreateGroupSheet('${prefix}');document.getElementById('chat-plus-menu-popup')?.remove()">
            <i class="fab fa-telegram-plane" style="color:#34d399;"></i> إنشاء جروب جديد
        </button>
        <hr style="border:none;border-top:1px solid #1f1f1f;margin:4px 0;">
        <button onclick="window.switchChatTab('${prefix}','groups',document.querySelector('#${prefix}-chat-type-tabs .chat-type-tab:last-child'));document.getElementById('chat-plus-menu-popup')?.remove()">
            <i class="fas fa-users" style="color:#f59e0b;"></i> عرض الجروبات
        </button>
    `;
    document.body.appendChild(menu);
    
    setTimeout(() => {
        document.addEventListener('click', function handler(e) {
            if (!menu.contains(e.target)) { menu.remove(); document.removeEventListener('click', handler); }
        });
    }, 100);
};

// ── Create Group Sheet ──
window.openCreateGroupSheet = async (prefix) => {
    const existing = document.getElementById('create-group-overlay');
    if (existing) existing.remove();
    
    // Load users for member selection
    const usersSnap = await get(ref(db, 'users'));
    const users = [];
    if (usersSnap.exists()) {
        usersSnap.forEach(u => {
            const d = u.val();
            if (u.key !== myUid) users.push({ uid: u.key, name: d.name, role: d.role, icon: d.icon || 'fa-user' });
        });
    }
    
    _createGroupMembers = [];
    const emojis = ['📚','🎓','⚡','🔥','🌟','💡','🎯','🏆','🧠','🌍','🎨','🚀'];
    
    const overlay = document.createElement('div');
    overlay.id = 'create-group-overlay';
    overlay.className = 'create-group-overlay';
    overlay.innerHTML = `
        <div class="create-group-sheet">
            <h3><i class="fas fa-users" style="color:#60a5fa;"></i> إنشاء جروب جديد</h3>
            
            <!-- Group photo -->
            <div style="text-align:center;margin-bottom:16px;">
                <div id="new-group-photo-preview" style="width:70px;height:70px;border-radius:18px;background:linear-gradient(135deg,#1d4ed8,#7c3aed);display:flex;align-items:center;justify-content:center;font-size:2rem;margin:0 auto 8px;cursor:pointer;position:relative;border:2px solid #2a2a2a;" onclick="document.getElementById('new-group-photo-input').click()">
                    📚
                    <div style="position:absolute;bottom:-4px;right:-4px;width:22px;height:22px;background:#3b82f6;border-radius:50%;display:flex;align-items:center;justify-content:center;border:2px solid #111;"><i class="fas fa-camera" style="font-size:0.6rem;color:#fff;"></i></div>
                </div>
                <input id="new-group-photo-input" type="file" hidden accept="image/*" onchange="previewNewGroupPhoto(this)">
                <p style="font-size:0.7rem;color:#555;">اضغط لإضافة صورة للجروب</p>
            </div>
            <label style="font-size:0.8rem;color:#888;margin-bottom:6px;display:block;">اسم الجروب</label>
            <input id="new-group-name" class="smart-input" placeholder="مثال: مجموعة الرياضيات" style="margin-bottom:14px;">
            
            <label style="font-size:0.8rem;color:#888;margin-bottom:6px;display:block;">وصف الجروب (اختياري)</label>
            <input id="new-group-desc" class="smart-input" placeholder="موضوع الجروب..." style="margin-bottom:14px;">
            
            <label style="font-size:0.8rem;color:#888;margin-bottom:6px;display:block;">أيقونة الجروب</label>
            <div class="emoji-picker-row">
                ${emojis.map(e => `<div class="emoji-option${e==='📚'?' selected':''}" onclick="selectGroupEmoji(this,'${e}')">${e}</div>`).join('')}
            </div>
            
            <label style="font-size:0.8rem;color:#888;margin-bottom:6px;display:block;">إضافة أعضاء</label>
            <div class="member-select-list">
                ${users.map(u => `
                    <div class="member-select-item" onclick="toggleGroupMember('${u.uid}','${u.name}',this)">
                        <div style="width:34px;height:34px;border-radius:50%;background:#111;display:flex;align-items:center;justify-content:center;border:1px solid #222;flex-shrink:0;">
                            <i class="fas ${u.icon}" style="font-size:0.8rem;color:#888;"></i>
                        </div>
                        <div>
                            <div style="font-size:0.85rem;font-weight:600;">${u.name}</div>
                            <div style="font-size:0.7rem;color:#555;">${u.role === 'teacher' ? 'معلم' : 'طالب'}</div>
                        </div>
                        <div class="checkmark"><i class="fas fa-check" style="font-size:0.55rem;color:#fff;opacity:0;"></i></div>
                    </div>`).join('')}
            </div>
            
            <div style="display:flex;gap:10px;margin-top:20px;">
                <button onclick="document.getElementById('create-group-overlay').remove()" style="flex:1;background:#1a1a1a;border:1px solid #2a2a2a;color:#888;padding:12px;border-radius:12px;cursor:pointer;">إلغاء</button>
                <button onclick="createNewGroup('${prefix}')" style="flex:2;background:linear-gradient(135deg,#1d4ed8,#7c3aed);border:none;color:#fff;padding:12px;border-radius:12px;cursor:pointer;font-weight:700;"><i class="fas fa-check"></i> إنشاء الجروب</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
};

window.selectGroupEmoji = (el, emoji) => {
    _selectedGroupEmoji = emoji;
    document.querySelectorAll('.emoji-option').forEach(e => e.classList.remove('selected'));
    el.classList.add('selected');
};

window.toggleGroupMember = (uid, name, el) => {
    const idx = _createGroupMembers.findIndex(m => m.uid === uid);
    if (idx === -1) {
        _createGroupMembers.push({ uid, name });
        el.classList.add('selected');
        el.querySelector('.checkmark i').style.opacity = '1';
    } else {
        _createGroupMembers.splice(idx, 1);
        el.classList.remove('selected');
        el.querySelector('.checkmark i').style.opacity = '0';
    }
};

window.createNewGroup = async (prefix) => {
    const name = document.getElementById('new-group-name').value.trim();
    const desc = document.getElementById('new-group-desc').value.trim();
    if (!name) return saAlert('أدخل اسم الجروب', 'error');
    
    const groupId = 'grp_' + Date.now() + '_' + Math.random().toString(36).substr(2,6);
    const members = { [myUid]: { name: currentUser, role: selectedRole, joinedAt: Date.now(), isAdmin: true } };
    _createGroupMembers.forEach(m => { members[m.uid] = { name: m.name, joinedAt: Date.now(), isAdmin: false }; });
    
    const photoPreview = document.getElementById('new-group-photo-preview');
    const groupPhoto = photoPreview?.dataset?.photo || null;
    
    const groupData = {
        name,
        desc: desc || '',
        emoji: _selectedGroupEmoji,
        photoBase64: groupPhoto,
        createdBy: myUid,
        createdAt: Date.now(),
        members,
        lastMsg: '🎉 تم إنشاء الجروب',
        lastMsgTime: Date.now(),
        enableAI: true
    };
    
    await set(ref(db, `groups/${groupId}`), groupData);
    
    // Add group to each member's group list
    const notifyPromises = Object.keys(members).map(uid => 
        update(ref(db, `user_groups/${uid}/${groupId}`), { name, emoji: _selectedGroupEmoji, lastMsg: groupData.lastMsg, lastMsgTime: Date.now() })
    );
    await Promise.all(notifyPromises);
    
    document.getElementById('create-group-overlay').remove();
    saAlert(`✅ تم إنشاء "${name}" بنجاح!`, 'success');
    window.switchChatTab(prefix, 'groups');
    openGroupRoom(groupId, prefix);
};

// ── Load groups list ──
window.loadGroupsList = (prefix) => {
    const list = document.getElementById(`${prefix}-chat-list`);
    
    onValue(ref(db, `user_groups/${myUid}`), async (snap) => {
        list.innerHTML = '';
        if (!snap.exists()) {
            list.innerHTML = `<div style="text-align:center;padding:40px 20px;color:#444;">
                <i class="fas fa-users" style="font-size:2.5rem;margin-bottom:12px;display:block;opacity:0.25;"></i>
                <p style="font-size:0.85rem;margin-bottom:16px;">لا توجد جروبات بعد</p>
                <button onclick="openCreateGroupSheet('${prefix}')" style="background:rgba(59,130,246,0.15);border:1px solid rgba(59,130,246,0.3);color:#60a5fa;padding:8px 18px;border-radius:10px;cursor:pointer;font-size:0.82rem;">
                    <i class="fas fa-plus"></i> إنشاء جروب
                </button>
            </div>`;
            return;
        }
        
        const entries = [];
        snap.forEach(g => entries.push({ id: g.key, ...g.val() }));
        entries.sort((a,b) => (b.lastMsgTime||0) - (a.lastMsgTime||0));
        
        entries.forEach(g => {
            const item = document.createElement('div');
            item.className = 'group-list-item';
            const timeStr = g.lastMsgTime ? new Date(g.lastMsgTime).toLocaleTimeString('ar-EG', { hour:'2-digit', minute:'2-digit' }) : '';
            item.innerHTML = `
                <div class="group-avatar">
                    ${g.emoji || '👥'}
                    <div class="group-type-badge">👥</div>
                </div>
                <div class="group-info">
                    <div class="group-name">${g.name}</div>
                    <div class="group-last-msg">${g.lastMsg || '...'}</div>
                </div>
                <div class="group-meta">
                    <div class="group-time">${timeStr}</div>
                </div>
            `;
            item.onclick = () => openGroupRoom(g.id, prefix);
            list.appendChild(item);
        });
    });
};

// ── Open group chat room ──
window.openGroupRoom = async (groupId, prefix) => {
    playSound('click');
    if (window._activeGroupListener) { window._activeGroupListener(); window._activeGroupListener = null; }
    window._activeGroupId = groupId;
    window._activeGroupPrefix = prefix;

    const sidebar = document.getElementById(`${prefix}-chat-sidebar`);
    const win = document.getElementById(`${prefix}-chat-window`);
    if (window.innerWidth < 768) sidebar.classList.add('hidden');
    win.classList.remove('hidden');

    const groupSnap = await get(ref(db, `groups/${groupId}`));
    if (!groupSnap.exists()) return;
    const group = groupSnap.val();
    const membersCount = Object.keys(group.members || {}).length;
    const isAdmin = group.members?.[myUid]?.isAdmin;

    const avatarHTML = group.photoBase64
        ? `<img src="${group.photoBase64}" style="width:42px;height:42px;border-radius:14px;object-fit:cover;flex-shrink:0;">`
        : `<div style="width:42px;height:42px;border-radius:14px;background:linear-gradient(135deg,#1d4ed8,#7c3aed);display:flex;align-items:center;justify-content:center;font-size:1.4rem;flex-shrink:0;">${group.emoji||'👥'}</div>`;

    win.innerHTML = `
        <div class="group-header" style="padding-top:calc(var(--nav-height) + 8px);background:#0a0a0a;border-bottom:1px solid #1a1a1a;display:flex;align-items:center;gap:10px;padding-bottom:12px;padding-left:14px;padding-right:14px;flex-shrink:0;">
            <button class="icon-btn-small" onclick="closeGroupRoom('${prefix}')" style="flex-shrink:0;"><i class="ph-bold ph-arrow-right"></i></button>
            ${avatarHTML}
            <div class="group-header-info" onclick="showGroupInfo('${groupId}','${prefix}')" style="cursor:pointer;flex:1;min-width:0;">
                <div class="group-header-name" style="font-weight:800;font-size:0.95rem;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${group.name}</div>
                <div id="gm-count-${groupId}" style="font-size:0.72rem;color:#555;">${membersCount} عضو</div>
            </div>
            <div style="display:flex;gap:8px;flex-shrink:0;">
                <button class="icon-btn-small" onclick="copyGroupInviteLink('${groupId}')" title="رابط الدعوة" style="background:rgba(59,130,246,0.12);border-color:rgba(59,130,246,0.3);color:#60a5fa;"><i class="fas fa-link"></i></button>
                <button class="icon-btn-small" onclick="addMemberToGroup('${groupId}','${prefix}')" title="إضافة عضو" style="background:rgba(52,211,153,0.12);border-color:rgba(52,211,153,0.3);color:#34d399;"><i class="fas fa-user-plus"></i></button>
                <button class="icon-btn-small" onclick="showGroupMoreMenu('${groupId}','${prefix}',${isAdmin})" title="خيارات"><i class="fas fa-ellipsis-v"></i></button>
            </div>
        </div>
        ${group.pinnedMsg ? `<div class="pinned-msg-bar"><i class="fas fa-thumbtack" style="color:#60a5fa;margin-left:6px;"></i><span>${group.pinnedMsg.substring(0,60)}</span></div>` : ''}
        <div class="chat-msgs-area" id="group-msgs-${groupId}" style="flex:1;overflow-y:auto;padding:8px 0;-webkit-overflow-scrolling:touch;position:relative;"></div>
        <div id="group-reply-bar-${groupId}" style="display:none;"></div>
        ${group.enableAI ? `<div class="group-ai-hint"><i class="fas fa-robot" style="color:#7c3aed;margin-left:4px;"></i> اكتب <strong>@AI</strong> للحصول على رد ذكي</div>` : ""}
        <div class="chat-input-area" id="group-input-${groupId}" style="flex-shrink:0;padding:10px 12px;background:#0a0a0a;border-top:1px solid rgba(255,255,255,0.06);display:flex;align-items:center;gap:8px;position:sticky;bottom:0;">
            <button class="icon-btn-small" onclick="showGroupAttachMenu('${groupId}','${prefix}')" style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:#888;width:38px;height:38px;border-radius:50%;flex-shrink:0;font-size:1.1rem;"><i class="fas fa-paperclip"></i></button>
            <input type="text" id="group-chat-input-${groupId}" placeholder="رسالة..."
                onkeypress="if(event.key==='Enter')sendGroupMessage('${groupId}','${prefix}')"
                oninput="toggleGroupMicSend('${groupId}')"
                style="flex:1;background:#1a1a1a;border:1px solid rgba(255,255,255,0.08);padding:12px 16px;border-radius:24px;color:#fff;font-family:var(--font-main);font-size:0.95rem;outline:none;">
            <button class="icon-btn-small" onclick="showGroupStickerPicker('${groupId}')" style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:#888;width:38px;height:38px;border-radius:50%;flex-shrink:0;font-size:1.2rem;" title="ستيكر">😊</button>
            <button id="group-send-btn-${groupId}" class="send-btn" style="display:none;" onclick="sendGroupMessage('${groupId}','${prefix}')"><i class="ph-bold ph-paper-plane-tilt"></i></button>
            <button id="group-mic-btn-${groupId}" class="send-btn" style="background:rgba(255,255,255,0.06);color:#aaa;" onclick="toggleGroupVoiceRecord('${groupId}','${prefix}')"><i class="ph-bold ph-microphone"></i></button>
        </div>
        <div id="group-voice-bar-${groupId}" class="voice-recording-bar hidden">
            <div class="voice-wave-anim"><span></span><span></span><span></span><span></span><span></span></div>
            <span id="group-voice-timer-${groupId}" style="color:#ef4444;font-weight:bold;font-size:0.9rem;min-width:40px;">0:00</span>
            <button onclick="cancelGroupVoice('${groupId}')" style="background:none;border:none;color:#ef4444;font-size:1.2rem;cursor:pointer;"><i class="ph-bold ph-x"></i></button>
            <button onclick="stopGroupVoice('${groupId}','${prefix}')" style="background:#25d366;border:none;color:#fff;padding:8px 16px;border-radius:20px;font-weight:bold;cursor:pointer;font-size:0.85rem;"><i class="ph-bold ph-paper-plane-tilt"></i> إرسال</button>
        </div>
    `;

    // ── Listen for messages ──
    const MEMBER_COLORS = ['#60a5fa','#34d399','#f59e0b','#f87171','#a78bfa','#fb923c','#22d3ee','#4ade80'];
    const colorMap = {};
    let memberColorIdx = 0;

    const listener = onValue(ref(db, `group_messages/${groupId}`), (snap) => {
        const msgsContainer = document.getElementById(`group-msgs-${groupId}`);
        if (!msgsContainer) return;
        msgsContainer.innerHTML = '';
        if (!snap.exists()) {
            const avatarBig = group.photoBase64
                ? `<img src="${group.photoBase64}" style="width:64px;height:64px;border-radius:16px;object-fit:cover;margin-bottom:12px;">`
                : `<div style="font-size:3rem;margin-bottom:10px;">${group.emoji||'👥'}</div>`;
            msgsContainer.innerHTML = `<div style="text-align:center;color:#333;padding:50px 20px;font-size:0.85rem;">${avatarBig}<p style="font-weight:700;color:#555;">${group.name}</p><p style="margin-top:4px;font-size:0.78rem;">${membersCount} أعضاء</p><p style="margin-top:12px;color:#444;">ابدأ المحادثة الآن 🎉</p></div>`;
            return;
        }

        const messages = [];
        snap.forEach(msgNode => messages.push({ key: msgNode.key, ...msgNode.val() }));

        let i = 0, prevDate = '';
        while (i < messages.length) {
            const msg = messages[i];
            const msgDate = new Date(msg.time).toLocaleDateString('ar-EG', {weekday:'short',day:'numeric',month:'long'});
            if (msgDate !== prevDate) {
                const sep = document.createElement('div');
                sep.className = 'date-sep';
                sep.innerHTML = `<span>${msgDate}</span>`;
                msgsContainer.appendChild(sep);
                prevDate = msgDate;
            }
            const isMe = msg.senderUid === myUid;
            const isAI = msg.isAI;

            // ── Sticker message ──
            if (msg.type === 'sticker') {
                const wrap = document.createElement('div');
                wrap.className = `group-msg-wrap${isMe?' me':''}`;
                wrap.innerHTML = `${!isMe?`<div class="group-sender-name" style="--sender-color:${colorMap[msg.senderUid]||'#60a5fa'};">${msg.senderName}</div>`:''}
                    <div style="font-size:3rem;line-height:1;padding:4px;">${msg.sticker}</div>
                    <div class="group-msg-meta">${new Date(msg.time).toLocaleTimeString('ar-EG',{hour:'2-digit',minute:'2-digit'})}</div>`;
                msgsContainer.appendChild(wrap);
                i++; continue;
            }

            // ── Voice message ──
            if (msg.type === 'voice') {
                if (!colorMap[msg.senderUid]) colorMap[msg.senderUid] = MEMBER_COLORS[memberColorIdx++%MEMBER_COLORS.length];
                const sc = colorMap[msg.senderUid];
                const wrap = document.createElement('div');
                wrap.className = `group-msg-wrap${isMe?' me':''}`;
                wrap.innerHTML = `${!isMe?`<div class="group-sender-name" style="--sender-color:${sc};">${msg.senderName}</div>`:''}
                    <div class="${isMe?'group-msg-bubble':'group-msg-bubble'}" style="${isMe?'background:linear-gradient(135deg,#1d4ed8,#2563eb);border-radius:18px 4px 18px 18px;':'border-radius:4px 18px 18px 18px;'}padding:10px 14px;">
                        <div class="wapp-voice-player">
                            <button class="voice-play-btn" onclick="toggleVoicePlay(this,'grp-${msg.key}')"><i class="ph-bold ph-play"></i></button>
                            <div class="voice-waveform">${Array.from({length:18},()=>`<div class="waveform-bar" style="height:${Math.random()*18+4}px"></div>`).join('')}</div>
                            <span class="voice-duration">${msg.duration||'0:00'}</span>
                            <audio id="audio-grp-${msg.key}" src="${msg.audioUrl||msg.text}" preload="metadata" onended="resetVoiceBtn('grp-${msg.key}')"></audio>
                        </div>
                    </div>
                    <div class="group-msg-meta">${new Date(msg.time).toLocaleTimeString('ar-EG',{hour:'2-digit',minute:'2-digit'})}</div>`;
                msgsContainer.appendChild(wrap);
                i++; continue;
            }

            // ── Image grid grouping ──
            if (msg.type === 'image' || msg.imageUrl) {
                let imgGroup = [msg];
                while (i+imgGroup.length < messages.length && (messages[i+imgGroup.length].type==='image'||messages[i+imgGroup.length].imageUrl) && messages[i+imgGroup.length].senderUid===msg.senderUid && imgGroup.length<9) {
                    imgGroup.push(messages[i+imgGroup.length]);
                }
                if (!colorMap[msg.senderUid]) colorMap[msg.senderUid] = MEMBER_COLORS[memberColorIdx++%MEMBER_COLORS.length];
                const sc = colorMap[msg.senderUid];
                const gridCols = imgGroup.length===1?1:imgGroup.length<=4?2:3;
                const wrap = document.createElement('div');
                wrap.className = `group-msg-wrap${isMe?' me':''}`;
                wrap.innerHTML = `${!isMe?`<div class="group-sender-name" style="--sender-color:${sc};">${msg.senderName}</div>`:''}
                    <div style="display:grid;grid-template-columns:repeat(${gridCols},1fr);gap:2px;border-radius:12px;overflow:hidden;max-width:240px;">
                        ${imgGroup.map(m=>`<img src="${m.imageUrl||m.text}" style="width:100%;height:${imgGroup.length===1?'auto':'90px'};object-fit:cover;cursor:pointer;" onclick="openImageViewer('${m.imageUrl||m.text}')">`).join('')}
                    </div>
                    <div class="group-msg-meta">${new Date(msg.time).toLocaleTimeString('ar-EG',{hour:'2-digit',minute:'2-digit'})}</div>`;
                msgsContainer.appendChild(wrap);
                i += imgGroup.length; continue;
            }

            // ── Text message ──
            if (!colorMap[msg.senderUid]) colorMap[msg.senderUid] = MEMBER_COLORS[memberColorIdx++%MEMBER_COLORS.length];
            const sc = colorMap[msg.senderUid];
            const wrap = document.createElement('div');
            wrap.className = `group-msg-wrap${isMe?' me':''}`;
            const replyHtml = msg.replyText ? `<div class="group-reply-preview" style="border-right:3px solid ${sc};padding:4px 8px;margin-bottom:4px;background:rgba(255,255,255,0.04);border-radius:0 6px 0 0;font-size:0.75rem;color:#888;"><strong style="color:${sc};font-size:0.7rem;">${msg.replySender||''}</strong><div style="overflow:hidden;white-space:nowrap;text-overflow:ellipsis;">${(msg.replyText||'').substring(0,50)}</div></div>` : '';
            const aiLabel = isAI ? `<div class="ai-group-label"><i class="fas fa-robot"></i> SA AI</div>` : '';
            const reactions = msg.reactions ? Object.entries(msg.reactions).map(([emoji,uids])=>`<span class="reaction-pill${Object.values(uids||{}).includes(myUid)?' mine':''}" onclick="addGroupReaction('${groupId}','${msg.key}','${emoji}')">${emoji} ${Object.keys(uids||{}).length}</span>`).join('') : '';
            wrap.innerHTML = `
                ${!isMe&&!isAI?`<div class="group-sender-name" style="--sender-color:${sc};">${msg.senderName}</div>`:''}
                ${aiLabel}
                <div class="${isMe?'group-msg-bubble':'group-msg-bubble'}" style="${isMe?'background:linear-gradient(135deg,#1d4ed8,#2563eb);border-radius:18px 4px 18px 18px;':'border-radius:4px 18px 18px 18px;'}${isAI?'background:linear-gradient(135deg,#1a0a2e,#2d1b4e);border:1px solid rgba(217,70,239,0.2);':''}" oncontextmenu="showGroupMsgCtx(event,'${groupId}','${msg.key}','${(msg.text||'').replace(/'/g,"\'")}',${isMe})">
                    ${replyHtml}
                    <span style="white-space:pre-wrap;word-wrap:break-word;">${makeLinksClickable(msg.text||'')}</span>
                    <div class="group-msg-meta">${new Date(msg.time).toLocaleTimeString('ar-EG',{hour:'2-digit',minute:'2-digit'})}${isMe?'<i class="fas fa-check-double" style="color:#53bdeb;margin-right:3px;font-size:0.6rem;"></i>':''}</div>
                </div>
                ${reactions?`<div class="msg-reactions">${reactions}</div>`:''}
            `;
            msgsContainer.appendChild(wrap);
            i++;
        }
        msgsContainer.scrollTop = msgsContainer.scrollHeight;

        // AI auto-reply check
        if (group.enableAI && messages.length > 0) {
            const lastMsg = messages[messages.length-1];
            if (lastMsg && !lastMsg.isAI && lastMsg.senderUid !== myUid && (lastMsg.text||'').startsWith('@AI')) {
                triggerGroupAIReply(groupId, lastMsg.text.replace('@AI','').trim(), group.name);
            }
        }
    });
    window._activeGroupListener = listener;
};

// ── Trigger AI reply in group ──
async function triggerGroupAIReply(groupId, question, groupName) {
    if (!question) return;
    try {
        const prompt = `أنت SA AI مساعد ذكي في جروب "${groupName}" على منصة SA EDU التعليمية.
السؤال: ${question}
أجب بالعربية بشكل مختصر ومفيد.`;
        const reply = await callPollinationsAI(prompt);
        await push(ref(db, `group_messages/${groupId}`), {
            text: reply, senderUid: 'sa_ai', senderName: 'SA AI', time: Date.now(), type: 'text', isAI: true
        });
        await update(ref(db, `groups/${groupId}`), { lastMsg: 'SA AI: ' + reply.substring(0,40), lastMsgTime: Date.now() });
    } catch(e) { console.error('Group AI error:', e); }
}

// ── Copy group invite link ──
window.copyGroupInviteLink = async (groupId) => {
    playSound('click');
    // Save invite token
    await update(ref(db, `groups/${groupId}`), { inviteToken: groupId });
    const url = `${window.location.href.split('?')[0]}?groupInvite=${groupId}`;
    if (navigator.share) {
        navigator.share({ title: 'انضم للجروب', text: 'انضم إلى الجروب على SA EDU', url }).catch(()=>{});
    } else {
        navigator.clipboard.writeText(url).then(() => showToast('تم نسخ رابط الدعوة!','شارك مع من تريد','success',3000));
    }
};

// ── Add member to group by UID ──
window.addMemberToGroup = (groupId, prefix) => {
    playSound('click');
    const existing = document.getElementById('add-member-popup');
    if (existing) { existing.remove(); return; }
    const popup = document.createElement('div');
    popup.id = 'add-member-popup';
    popup.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:9999;display:flex;align-items:flex-end;justify-content:center;';
    popup.innerHTML = `
        <div style="background:#111;border-radius:24px 24px 0 0;padding:24px 20px;width:100%;max-width:600px;animation:slideUp .3s ease;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
                <h3 style="margin:0;font-size:1rem;"><i class="fas fa-user-plus" style="color:#34d399;margin-left:8px;"></i> إضافة عضو للجروب</h3>
                <button onclick="document.getElementById('add-member-popup').remove()" style="background:none;border:none;color:#666;font-size:1.2rem;cursor:pointer;"><i class="fas fa-times"></i></button>
            </div>
            <div style="display:flex;gap:10px;">
                <input id="add-member-uid-input" class="smart-input" placeholder="أدخل معرف المستخدم (ID)..." style="margin:0;flex:1;">
                <button onclick="doAddMemberToGroup('${groupId}')" style="background:linear-gradient(135deg,#10b981,#059669);border:none;color:#fff;padding:0 20px;border-radius:14px;cursor:pointer;font-weight:700;font-family:var(--font-main);">إضافة</button>
            </div>
            <div id="add-member-result" style="margin-top:12px;font-size:0.85rem;color:#888;"></div>
        </div>`;
    document.body.appendChild(popup);
    popup.querySelector('#add-member-uid-input').focus();
};

window.doAddMemberToGroup = async (groupId) => {
    const uid = document.getElementById('add-member-uid-input')?.value?.trim();
    const resultEl = document.getElementById('add-member-result');
    if (!uid) return;
    if (resultEl) resultEl.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> جاري البحث...';
    // Search user by UID
    let foundUser = null;
    const [sSnap, tSnap] = await Promise.all([get(ref(db,'users/students')), get(ref(db,'users/teachers'))]);
    if (sSnap.exists()) Object.entries(sSnap.val()).forEach(([name,data]) => { if (data.uid===uid) foundUser={name,...data}; });
    if (!foundUser && tSnap.exists()) Object.entries(tSnap.val()).forEach(([name,data]) => { if (data.uid===uid) foundUser={name,...data}; });
    if (!foundUser) {
        if (resultEl) resultEl.innerHTML = '<span style="color:var(--danger);">المستخدم غير موجود</span>';
        return;
    }
    // Add to group
    await update(ref(db, `groups/${groupId}/members/${uid}`), { name: foundUser.name, joinedAt: Date.now(), isAdmin: false });
    await update(ref(db, `user_groups/${uid}/${groupId}`), { name: '...', emoji: '👥', lastMsg: 'تمت إضافتك للجروب', lastMsgTime: Date.now() });
    await push(ref(db, `group_messages/${groupId}`), { text: `تمت إضافة ${foundUser.name} للجروب 🎉`, senderUid: myUid, senderName: currentUser, time: Date.now(), type: 'text', isSystem: true });
    if (resultEl) resultEl.innerHTML = `<span style="color:var(--success);">✅ تمت إضافة ${foundUser.name} بنجاح!</span>`;
    setTimeout(() => { document.getElementById('add-member-popup')?.remove(); }, 1500);
};

// ── Sticker picker ──
const STICKERS = ['😂','❤️','🔥','👍','💯','😍','🎉','🤔','😭','🙏','😎','🤣','💪','✅','⚡','🌟','🎯','🧠','📚','✨','🎓','👏','🥳','😅','🤩','💡','🚀','🏆','😊','🤝'];
window.showGroupStickerPicker = (groupId) => {
    const existing = document.getElementById('sticker-picker-popup');
    if (existing) { existing.remove(); return; }
    const popup = document.createElement('div');
    popup.id = 'sticker-picker-popup';
    popup.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#111;border:1px solid #2a2a2a;border-radius:20px;padding:14px;z-index:9999;display:flex;flex-wrap:wrap;gap:6px;max-width:300px;box-shadow:0 -8px 40px rgba(0,0,0,0.7);animation:popIn .2s ease;';
    popup.innerHTML = STICKERS.map(s => `<button onclick="sendGroupSticker('${groupId}','${s}')" style="background:none;border:none;font-size:1.8rem;cursor:pointer;padding:4px;border-radius:8px;transition:0.15s;" onmouseover="this.style.background='rgba(255,255,255,0.1)'" onmouseout="this.style.background='none'">${s}</button>`).join('');
    document.body.appendChild(popup);
    setTimeout(() => { document.addEventListener('click', function h(e) { if (!popup.contains(e.target)) { popup.remove(); document.removeEventListener('click',h); } }); }, 100);
};

window.sendGroupSticker = async (groupId, sticker) => {
    document.getElementById('sticker-picker-popup')?.remove();
    playSound('sent');
    const prefix = window._activeGroupPrefix || (selectedRole==='teacher'?'t':'s');
    await push(ref(db, `group_messages/${groupId}`), { sticker, senderUid: myUid, senderName: currentUser, time: Date.now(), type: 'sticker' });
    await update(ref(db, `groups/${groupId}`), { lastMsg: `${currentUser}: ${sticker}`, lastMsgTime: Date.now() });
};

// ── Attach menu (images + docs) ──
window.showGroupAttachMenu = (groupId, prefix) => {
    const existing = document.getElementById('group-attach-menu');
    if (existing) { existing.remove(); return; }
    const menu = document.createElement('div');
    menu.id = 'group-attach-menu';
    menu.style.cssText = 'position:fixed;bottom:80px;right:16px;background:#111;border:1px solid #2a2a2a;border-radius:16px;padding:8px;z-index:9999;min-width:180px;box-shadow:0 -8px 40px rgba(0,0,0,0.7);animation:popIn .2s ease;';
    menu.innerHTML = `
        <label style="display:flex;align-items:center;gap:10px;padding:10px 14px;cursor:pointer;color:#ccc;font-size:0.85rem;border-radius:8px;" onmouseover="this.style.background='rgba(255,255,255,0.06)'" onmouseout="this.style.background='none'">
            <i class="fas fa-images" style="color:#60a5fa;width:20px;text-align:center;"></i> صور متعددة
            <input type="file" hidden accept="image/*" multiple onchange="sendGroupImages(this,'${groupId}','${prefix}');document.getElementById('group-attach-menu')?.remove()">
        </label>
        <label style="display:flex;align-items:center;gap:10px;padding:10px 14px;cursor:pointer;color:#ccc;font-size:0.85rem;border-radius:8px;" onmouseover="this.style.background='rgba(255,255,255,0.06)'" onmouseout="this.style.background='none'">
            <i class="fas fa-camera" style="color:#34d399;width:20px;text-align:center;"></i> كاميرا
            <input type="file" hidden accept="image/*" capture="environment" onchange="sendGroupImages(this,'${groupId}','${prefix}');document.getElementById('group-attach-menu')?.remove()">
        </label>`;
    document.body.appendChild(menu);
    setTimeout(() => { document.addEventListener('click', function h(e) { if (!menu.contains(e.target)) { menu.remove(); document.removeEventListener('click',h); } }); }, 100);
};

// ── Group voice recording ──
let _grpVoiceRecorder=null, _grpVoiceChunks=[], _grpVoiceRecording=false;
window.toggleGroupVoiceRecord = async (groupId, prefix) => {
    if (_grpVoiceRecording) { stopGroupVoice(groupId, prefix); return; }
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        _grpVoiceChunks = []; _grpVoiceRecording = true;
        _grpVoiceRecorder = new MediaRecorder(stream);
        const bar = document.getElementById(`group-voice-bar-${groupId}`);
        const micBtn = document.getElementById(`group-mic-btn-${groupId}`);
        if (bar) bar.classList.remove('hidden');
        if (micBtn) { micBtn.style.background='#ef4444'; micBtn.style.color='#fff'; }
        let sec=0;
        const timerEl = document.getElementById(`group-voice-timer-${groupId}`);
        const tInt = setInterval(() => { sec++; const m=Math.floor(sec/60),s=sec%60; if(timerEl) timerEl.innerText=`${m}:${s<10?'0':''}${s}`; }, 1000);
        _grpVoiceRecorder._tInt = tInt; _grpVoiceRecorder._sec = () => sec;
        _grpVoiceRecorder.ondataavailable = e => { if(e.data.size>0) _grpVoiceChunks.push(e.data); };
        _grpVoiceRecorder.start(100);
    } catch(e) { saAlert('لم يُسمح بالوصول للمايكروفون','error'); }
};
window.cancelGroupVoice = (groupId) => {
    if(_grpVoiceRecorder){clearInterval(_grpVoiceRecorder._tInt);_grpVoiceRecorder.stop();_grpVoiceRecorder.stream?.getTracks().forEach(t=>t.stop());}
    _grpVoiceRecording=false; _grpVoiceChunks=[];
    document.getElementById(`group-voice-bar-${groupId}`)?.classList.add('hidden');
    const mic=document.getElementById(`group-mic-btn-${groupId}`);
    if(mic){mic.style.background='rgba(255,255,255,0.06)';mic.style.color='#aaa';}
};
window.stopGroupVoice = async (groupId, prefix) => {
    if(!_grpVoiceRecorder||!_grpVoiceRecording) return;
    const sec = _grpVoiceRecorder._sec();
    clearInterval(_grpVoiceRecorder._tInt);
    return new Promise(resolve => {
        _grpVoiceRecorder.onstop = async () => {
            const blob = new Blob(_grpVoiceChunks, {type:'audio/webm'});
            const reader = new FileReader();
            reader.onload = async () => {
                const b64 = reader.result;
                const m=Math.floor(sec/60),s=sec%60;
                playSound('sent');
                await push(ref(db,`group_messages/${groupId}`), { audioUrl:b64, text:'', senderUid:myUid, senderName:currentUser, time:Date.now(), type:'voice', duration:`${m}:${s<10?'0':''}${s}` });
                await update(ref(db,`groups/${groupId}`), { lastMsg:`${currentUser}: 🎤 رسالة صوتية`, lastMsgTime:Date.now() });
                resolve();
            };
            reader.readAsDataURL(blob);
        };
        _grpVoiceRecorder.stop();
        _grpVoiceRecorder.stream?.getTracks().forEach(t=>t.stop());
        _grpVoiceRecording=false; _grpVoiceChunks=[];
        document.getElementById(`group-voice-bar-${groupId}`)?.classList.add('hidden');
        const mic=document.getElementById(`group-mic-btn-${groupId}`);
        if(mic){mic.style.background='rgba(255,255,255,0.06)';mic.style.color='#aaa';}
    });
};

// ── sendGroupImages: multiple images support ──
window.sendGroupImages = async (input, groupId, prefix) => {
    if (!input.files || input.files.length === 0) return;
    const files = Array.from(input.files).slice(0, 9);
    try {
        const images = await Promise.all(files.map(f => getBase64(f)));
        // Send as a group of images
        if (images.length === 1) {
            await push(ref(db, `group_messages/${groupId}`), { imageUrl: images[0], text:'', senderUid:myUid, senderName:currentUser, time:Date.now(), type:'image' });
        } else {
            // Send multiple images as separate messages or batch
            for (const img of images) {
                await push(ref(db, `group_messages/${groupId}`), { imageUrl:img, text:'', senderUid:myUid, senderName:currentUser, time:Date.now(), type:'image' });
            }
        }
        await update(ref(db, `groups/${groupId}`), { lastMsg:`${currentUser}: 📷 ${images.length} صور`, lastMsgTime:Date.now() });
        playSound('sent');
    } catch(e) { saAlert('فشل إرسال الصور','error'); }
};

// ── Context menu for group messages ──
window.showGroupMsgCtx = (e, groupId, key, text, isMe) => {
window.showGroupMoreMenu = (groupId, prefix, isAdmin) => {
    const existing = document.getElementById('group-more-menu');
    if (existing) { existing.remove(); return; }
    const menu = document.createElement('div');
    menu.id = 'group-more-menu';
    menu.className = 'chat-plus-menu';
    menu.style.cssText = 'top:60px;left:10px;min-width:180px;';
    menu.innerHTML = `
        <button onclick="showGroupInfo('${groupId}','${prefix}');document.getElementById('group-more-menu')?.remove()">
            <i class="fas fa-info-circle" style="color:#60a5fa;"></i> معلومات الجروب
        </button>
        <button onclick="shareGroupLink('${groupId}');document.getElementById('group-more-menu')?.remove()">
            <i class="fas fa-share-alt" style="color:#34d399;"></i> مشاركة رابط الجروب
        </button>
        ${isAdmin ? `
        <button onclick="toggleGroupAI('${groupId}');document.getElementById('group-more-menu')?.remove()">
            <i class="fas fa-robot" style="color:#c4b5fd;"></i> تفعيل/إيقاف AI
        </button>
        <button onclick="changeGroupPhoto('${groupId}');document.getElementById('group-more-menu')?.remove()">
            <i class="fas fa-camera" style="color:#f59e0b;"></i> تغيير صورة الجروب
        </button>` : ''}
        <hr style="border:none;border-top:1px solid #1f1f1f;margin:4px 0;">
        <button onclick="leaveGroup('${groupId}','${prefix}');document.getElementById('group-more-menu')?.remove()" style="color:#f87171;">
            <i class="fas fa-sign-out-alt"></i> مغادرة الجروب
        </button>
    `;
    document.body.appendChild(menu);
    setTimeout(() => {
        document.addEventListener('click', function h(e) {
            if (!menu.contains(e.target)) { menu.remove(); document.removeEventListener('click', h); }
        });
    }, 100);
};

// ── Share group link ──
window.shareGroupLink = (groupId) => {
    const link = `${window.location.origin}${window.location.pathname}#group:${groupId}`;
    if (navigator.share) {
        navigator.share({ title: 'انضم للجروب على SA EDU', url: link });
    } else {
        navigator.clipboard?.writeText(link).then(() => showToast('✅ تم نسخ رابط الجروب','','success',2500));
    }
};

// ── Change group photo ──
window.changeGroupPhoto = (groupId) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async () => {
        if (!input.files[0]) return;
        try {
            const b64 = await getBase64(input.files[0]);
            await update(ref(db, `groups/${groupId}`), { photoBase64: b64 });
            showToast('✅ تم تغيير صورة الجروب','','success',2000);
            // Refresh the room
            openGroupRoom(groupId, window._activeGroupPrefix || 's');
        } catch(e) { saAlert('فشل تغيير الصورة','error'); }
    };
    input.click();
};

// ── Leave group ──
window.leaveGroup = async (groupId, prefix) => {
    saConfirm('هل تريد مغادرة الجروب؟', async () => {
        await remove(ref(db, `groups/${groupId}/members/${myUid}`));
        await remove(ref(db, `user_groups/${myUid}/${groupId}`));
        closeGroupRoom(prefix);
        saAlert('تم مغادرة الجروب','success');
    });
};
window.toggleGroupMicSend = (groupId) => {
    const input = document.getElementById(`group-chat-input-${groupId}`);
    const send = document.getElementById(`group-send-btn-${groupId}`);
    const mic = document.getElementById(`group-mic-btn-${groupId}`);
    const has = input && input.value.trim().length > 0;
    if (send) send.style.display = has ? 'flex' : 'none';
    if (mic) mic.style.display = has ? 'none' : 'flex';
};

window.sendGroupMessage = async (groupId, prefix, textOverride) => {
    const input = document.getElementById(`group-chat-input-${groupId}`);
    const txt = textOverride || (input ? input.value.trim() : '');
    if (!txt) return;

    // Clear reply state
    const replyBar = document.getElementById(`group-reply-bar-${groupId}`);
    let replyData = null;
    if (input && input.dataset.replyKey) {
        replyData = { key: input.dataset.replyKey, text: input.dataset.replyText, sender: input.dataset.replySender };
        delete input.dataset.replyKey; delete input.dataset.replyText; delete input.dataset.replySender;
        input.placeholder = 'رسالة...';
        if (replyBar) replyBar.style.display = 'none';
    }

    if (input) { input.value = ''; toggleGroupMicSend(groupId); }

    // ── Optimistic UI: show the message immediately without waiting for Firebase ──
    const msgsNow = document.getElementById(`group-msgs-${groupId}`);
    if (msgsNow) {
        // Remove empty-state placeholder if present
        const placeholder = msgsNow.querySelector('div[style*="text-align:center"]');
        if (placeholder) placeholder.remove();

        const optWrap = document.createElement('div');
        optWrap.className = 'group-msg-wrap me';
        optWrap.id = `opt-msg-${Date.now()}`;
        optWrap.innerHTML = `
            <div class="group-msg-bubble">
                <div style="word-break:break-word;">${txt}</div>
                <div class="group-msg-meta" style="justify-content:flex-end;">
                    <span>${new Date().toLocaleTimeString('ar-EG',{hour:'2-digit',minute:'2-digit'})}</span>
                    <span class="msg-read-ticks"><i class="fas fa-clock" style="font-size:0.55rem;opacity:0.5;"></i></span>
                </div>
            </div>
            <div class="msg-reactions"></div>
        `;
        msgsNow.appendChild(optWrap);
        msgsNow.scrollTop = msgsNow.scrollHeight;
        playSound('sent');
    }

    const msgData = {
        text: txt, senderUid: myUid, senderName: currentUser,
        time: Date.now(), type: 'text',
        ...(replyData ? { replyTo: replyData } : {})
    };

    try {
        const msgRef = await push(ref(db, `group_messages/${groupId}`), msgData);
        const shortMsg = `${currentUser}: ${txt.substring(0,40)}`;
        await update(ref(db, `groups/${groupId}`), { lastMsg: shortMsg, lastMsgTime: Date.now() });

        // Notify all members
        const membersSnap = await get(ref(db, `groups/${groupId}/members`));
        if (membersSnap.exists()) {
            const ups = [];
            membersSnap.forEach(m => ups.push(update(ref(db, `user_groups/${m.key}/${groupId}`), { lastMsg: shortMsg, lastMsgTime: Date.now() })));
            await Promise.all(ups);
        }
    } catch (firebaseErr) {
        console.error('Group message send error:', firebaseErr);
        // Remove optimistic message on failure
        const optEl = document.getElementById(`opt-msg-${Date.now()}`);
        if (optEl) optEl.remove();
    }

    // ── AI auto-response: if group has AI enabled and message mentions @AI or starts with /ai ──
    const groupInfoSnap = await get(ref(db, `groups/${groupId}/enableAI`));
    const aiEnabled = groupInfoSnap.exists() ? groupInfoSnap.val() : false;
    const wantsAI = txt.includes('@AI') || txt.includes('@ai') || txt.startsWith('/ai') || txt.startsWith('يا AI') || txt.startsWith('يا ai');
    
    if (aiEnabled && wantsAI) {
        const question = txt.replace(/@[Aa][Ii]/g,'').replace(/^\/ai\s*/,'').replace(/^يا ai\s*/i,'').trim();
        if (!question) return;
        try {
            const aiSnap = await get(ref(db, `groups/${groupId}`));
            const grpName = aiSnap.exists() ? aiSnap.val().name : 'الجروب';
            const ctxSnap = await get(ref(db, `group_messages/${groupId}`));
            let context = '';
            if (ctxSnap.exists()) {
                const recent = [];
                ctxSnap.forEach(m => { const v = m.val(); if (v.text && !v.isAI) recent.push(v.senderName + ': ' + v.text); });
                context = recent.slice(-5).join('\n');
            }
            const aiPrompt = `أنت SA AI مساعد ذكي في جروب "${grpName}" على منصة SA EDU التعليمية. أجب بالعربية بشكل مختصر ومفيد وودود.
السياق الأخير:
${context}
السؤال/الطلب: ${question}`;
            
            const typingKey = `typing_${Date.now()}`;
            await set(ref(db, `group_messages/${groupId}/${typingKey}`), {
                text: '...يكتب', senderUid: 'ai_sa', senderName: 'SA AI',
                isAI: true, isTyping: true, time: Date.now() + 1
            });

            const reply = await callPollinationsAI(aiPrompt);
            await remove(ref(db, `group_messages/${groupId}/${typingKey}`));
            await push(ref(db, `group_messages/${groupId}`), {
                text: reply, senderUid: 'ai_sa', senderName: 'SA AI',
                isAI: true, time: Date.now(), type: 'ai'
            });
            await update(ref(db, `groups/${groupId}`), { lastMsg: '🤖 SA AI: ' + reply.substring(0,35), lastMsgTime: Date.now() });
        } catch(e) { console.error('AI group error:', e); }
    }
};

window.askGroupAI = async (groupId, prefix) => {
    const input = document.getElementById(`group-chat-input-${groupId}`);
    const question = input ? input.value.trim() : '';
    
    if (!question) {
        // Show AI prompt hint
        if (input) { input.placeholder = 'اكتب سؤالك هنا...'; input.focus(); }
        return;
    }
    
    if (input) { input.value = ''; toggleGroupMicSend(groupId); }
    
    // Post user message first
    await push(ref(db, `group_messages/${groupId}`), {
        text: question, senderUid: myUid, senderName: currentUser, time: Date.now(), type: 'text'
    });
    
    // Typing indicator
    const typingId = 'typing_' + Date.now();
    await set(ref(db, `group_messages/${groupId}/${typingId}`), {
        text: '...', senderUid: 'ai', senderName: 'SA AI', isAI: true, isTyping: true, time: Date.now()
    });
    
    try {
        const response = await callPollinationsAI(`أنت مساعد تعليمي ذكي. أجب بالعربية بشكل مختصر ومفيد. السؤال: ${question}`);
        await remove(ref(db, `group_messages/${groupId}/${typingId}`));
        await push(ref(db, `group_messages/${groupId}`), {
            text: response, senderUid: 'ai', senderName: 'SA AI', isAI: true, time: Date.now(), type: 'ai'
        });
        await update(ref(db, `groups/${groupId}`), { lastMsg: '🤖 SA AI رد على سؤال', lastMsgTime: Date.now() });
    } catch(e) {
        await remove(ref(db, `group_messages/${groupId}/${typingId}`));
    }
};

window.addGroupReaction = async (groupId, msgKey, emoji) => {
    const current = await get(ref(db, `group_messages/${groupId}/${msgKey}/reactions/${myUid}`));
    if (current.exists() && current.val() === emoji) {
        await remove(ref(db, `group_messages/${groupId}/${msgKey}/reactions/${myUid}`));
    } else {
        await set(ref(db, `group_messages/${groupId}/${msgKey}/reactions/${myUid}`), emoji);
    }
};

window.showGroupMsgMenu = (e, key, groupId, prefix, text, isMe) => {
    e.preventDefault();
    const existing = document.getElementById('group-msg-ctx');
    if (existing) existing.remove();
    
    const EMOJIS = ['👍','❤️','😂','😮','🔥','✅'];
    const menu = document.createElement('div');
    menu.id = 'group-msg-ctx';
    menu.className = 'chat-plus-menu';
    menu.style.cssText = `position:fixed;top:${e.clientY}px;right:${Math.max(10,window.innerWidth-e.clientX-200)}px;z-index:9999;`;
    menu.innerHTML = `
        <div style="display:flex;gap:6px;padding:6px;justify-content:center;">
            ${EMOJIS.map(em => `<button onclick="addGroupReaction('${groupId}','${key}','${em}');document.getElementById('group-msg-ctx')?.remove()" style="font-size:1.3rem;background:none;border:none;cursor:pointer;padding:4px;border-radius:8px;transition:background 0.15s;" onmouseover="this.style.background='rgba(255,255,255,0.1)'" onmouseout="this.style.background='none'">${em}</button>`).join('')}
        </div>
        <hr style="border:none;border-top:1px solid #1f1f1f;margin:4px 0;">
        <button onclick="replyToGroupMsg('${groupId}','${key}','${text}');document.getElementById('group-msg-ctx')?.remove()">
            <i class="fas fa-reply" style="color:#60a5fa;"></i> رد
        </button>
        <button onclick="navigator.clipboard?.writeText(\`${text}\`).then(()=>showToast('تم النسخ','','success',1500));document.getElementById('group-msg-ctx')?.remove()">
            <i class="fas fa-copy" style="color:#888;"></i> نسخ
        </button>
        ${isMe ? `<button onclick="remove(window._fbRef('group_messages/${groupId}/${key}'));document.getElementById('group-msg-ctx')?.remove()" style="color:#f87171;">
            <i class="fas fa-trash"></i> حذف
        </button>` : ''}
    `;
    document.body.appendChild(menu);
    setTimeout(() => {
        document.addEventListener('click', function h(e) {
            if (!menu.contains(e.target)) { menu.remove(); document.removeEventListener('click', h); }
        });
    }, 100);
};

// Expose firebase ref helper for inline delete
window._fbRef = (path) => ref(db, path);

window.replyToGroupMsg = (groupId, key, text, sender) => {
    const input = document.getElementById(`group-chat-input-${groupId}`);
    const replyBar = document.getElementById(`group-reply-bar-${groupId}`);
    if (!input) return;
    input.dataset.replyKey = key;
    input.dataset.replyText = (text||'').substring(0,60);
    input.dataset.replySender = sender || 'مجهول';
    if (replyBar) {
        replyBar.style.display = 'block';
        replyBar.innerHTML = `<div class="reply-preview-bar">
            <div><strong style="color:#60a5fa;font-size:0.7rem;">${sender || 'مجهول'}</strong><div style="font-size:0.78rem;color:#888;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;max-width:220px;">${(text||'').substring(0,50)}</div></div>
            <button onclick="cancelReply('${groupId}')" style="background:none;border:none;color:#555;cursor:pointer;font-size:0.9rem;"><i class="fas fa-times"></i></button>
        </div>`;
    }
    input.placeholder = 'رسالتك...';
    input.focus();
};
window.cancelReply = (groupId) => {
    const input = document.getElementById(`group-chat-input-${groupId}`);
    const replyBar = document.getElementById(`group-reply-bar-${groupId}`);
    if (input) { delete input.dataset.replyKey; delete input.dataset.replyText; delete input.dataset.replySender; input.placeholder = 'رسالة...'; }
    if (replyBar) replyBar.style.display = 'none';
};

window.closeGroupRoom = (prefix) => {
    // Unsubscribe the Firebase listener BEFORE clearing innerHTML
    // to prevent the callback from firing on a detached/orphaned msgsContainer
    if (window._activeGroupListener) {
        window._activeGroupListener();
        window._activeGroupListener = null;
    }
    window._activeGroupId = null;
    const win = document.getElementById(`${prefix}-chat-window`);
    if (win) { win.classList.add('hidden'); win.innerHTML = ''; }
    const sidebar = document.getElementById(`${prefix}-chat-sidebar`);
    if (sidebar) sidebar.classList.remove('hidden');
};

window.showGroupInfo = async (groupId, prefix) => {
    const groupSnap = await get(ref(db, `groups/${groupId}`));
    if (!groupSnap.exists()) return;
    const group = groupSnap.val();
    const members = group.members || {};
    
    const memberList = Object.entries(members).map(([uid, m]) => 
        `<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid #1a1a1a;">
            <div style="width:32px;height:32px;border-radius:50%;background:#111;display:flex;align-items:center;justify-content:center;border:1px solid #222;">
                <i class="fas fa-user" style="font-size:0.75rem;color:#888;"></i>
            </div>
            <div style="flex:1;font-size:0.85rem;">${m.name || uid}</div>
            ${m.isAdmin ? '<span style="font-size:0.65rem;color:#f59e0b;background:rgba(245,158,11,0.1);padding:2px 8px;border-radius:20px;">أدمن</span>' : ''}
        </div>`
    ).join('');
    
    saAlert(`<div style="text-align:right;">
        <div style="text-align:center;margin-bottom:14px;font-size:2rem;">${group.emoji}</div>
        <strong>${group.name}</strong><br>
        <span style="font-size:0.75rem;color:#666;">${group.desc || ''}</span>
        <div style="margin-top:12px;font-size:0.8rem;color:#888;">الأعضاء (${Object.keys(members).length}):</div>
        ${memberList}
    </div>`, 'info');
};

window.toggleGroupAI = async (groupId) => {
    const snap = await get(ref(db, `groups/${groupId}/enableAI`));
    const current = snap.exists() ? snap.val() : true;
    await set(ref(db, `groups/${groupId}/enableAI`), !current);
    saAlert(!current ? '🤖 AI مفعّل في الجروب' : 'AI معطّل', 'success');
};

// ── initDardasha for tab switching ──
window.initDardasha_real = (prefix) => {
    // Directly re-listen to user_chats to refresh the list
    const list = document.getElementById(`${prefix}-chat-list`);
    if (!list) return;
    list.innerHTML = '';
    
    onValue(ref(db, `user_chats/${myUid}`), (snap) => {
        list.innerHTML = '';
        if (!snap.exists()) {
            list.innerHTML = getEmptyStateHTML('chats');
            return;
        }
        const chats = snap.val();
        const chatEntries = Object.entries(chats).sort((a,b) => (b[1].lastMsgTime||0)-(a[1].lastMsgTime||0));
        chatEntries.forEach(([chatId, chatInfo]) => {
            const el = document.createElement('div');
            el.className = 'chat-item';
            el.onclick = () => openChatRoom(chatId, chatInfo.otherName, chatInfo.otherIcon, chatInfo.otherUid);
            const timeStr = chatInfo.lastMsgTime ? new Date(chatInfo.lastMsgTime).toLocaleTimeString('ar-EG', {hour:'2-digit',minute:'2-digit'}) : '';
            const lastMsg = chatInfo.lastMsg ? (chatInfo.lastMsg.includes('data:image') ? '📷 صورة' : (chatInfo.lastMsg.includes('data:audio') || chatInfo.lastMsg === '🎤 رسالة صوتية') ? '🎤 رسالة صوتية' : chatInfo.lastMsg) : 'ابدأ المحادثة...';
            const unread = chatInfo.unread && chatInfo.lastSenderUid !== myUid;
            el.innerHTML = `
                <div class="avatar-frame mini-frame" style="border-color:#444;color:#ccc;flex-shrink:0;"><i class="fas ${chatInfo.otherIcon||'fa-user'}"></i></div>
                <div style="flex:1;min-width:0;">
                    <div style="font-weight:700;color:#fff;display:flex;justify-content:space-between;align-items:center;gap:6px;">
                        <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${chatInfo.otherName}</span>
                        <span style="font-size:0.65rem;color:${unread?'#25d366':'#555'};flex-shrink:0;">${timeStr}</span>
                    </div>
                    <div style="font-size:0.78rem;color:${unread?'#fff':'#666'};overflow:hidden;white-space:nowrap;text-overflow:ellipsis;margin-top:2px;font-weight:${unread?'600':'400'};">${lastMsg}</div>
                </div>
                ${unread ? '<div style="width:9px;height:9px;border-radius:50%;background:#25d366;flex-shrink:0;"></div>' : ''}
            `;
            list.appendChild(el);
        });
    });
};

window.startGroupVoice = (groupId) => {
    saAlert('الرسائل الصوتية في الجروبات ستتوفر قريباً 🎙️', 'info');
};

window.sendGroupImage = async (input, groupId, prefix) => {
    if (!input.files[0]) return;
    try {
        const b64 = await getBase64(input.files[0]);
        await push(ref(db, `group_messages/${groupId}`), {
            text: '', imageUrl: b64, senderUid: myUid, senderName: currentUser, time: Date.now(), type: 'image'
        });
        await update(ref(db, `groups/${groupId}`), { lastMsg: `${currentUser}: 📷 صورة`, lastMsgTime: Date.now() });
        playSound('sent');
    } catch(e) { saAlert('فشل إرسال الصورة', 'error'); }
};

window.previewNewGroupPhoto = (input) => {
    if (!input.files[0]) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        const preview = document.getElementById('new-group-photo-preview');
        if (preview) {
            preview.innerHTML = `<img src="${e.target.result}" style="width:100%;height:100%;object-fit:cover;border-radius:16px;"><div style="position:absolute;bottom:-4px;right:-4px;width:22px;height:22px;background:#3b82f6;border-radius:50%;display:flex;align-items:center;justify-content:center;border:2px solid #111;"><i class="fas fa-camera" style="font-size:0.6rem;color:#fff;"></i></div>`;
            preview.dataset.photo = e.target.result;
        }
    };
    reader.readAsDataURL(input.files[0]);
};
