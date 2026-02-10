import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, set, get, onValue, push, remove, update } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

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

let lastScrollTop = 0;
window.addEventListener("scroll", function() {
    let st = window.pageYOffset || document.documentElement.scrollTop;
    if (st > lastScrollTop && st > 10){
        document.querySelector('.top-nav').classList.add('nav-hidden');
    } else {
        document.querySelector('.top-nav').classList.remove('nav-hidden');
    }
    lastScrollTop = st <= 0 ? 0 : st;
}, false);

// Handle clicking outside modals to close them
window.addEventListener('click', function(e) {
    const searchModal = document.getElementById('user-search-modal');
    const profileModal = document.getElementById('profile-info-modal');
    const teacherDetailModal = document.getElementById('teacher-detail-modal');
    const phoneModal = document.getElementById('phone-modal');

    // Check if the click target IS the modal container (which is the dark overlay)
    if (e.target === searchModal) {
        searchModal.classList.add('hidden');
    }
    if (e.target === profileModal) {
        profileModal.classList.add('hidden');
    }
    if (e.target === teacherDetailModal) {
        teacherDetailModal.classList.add('hidden');
    }
    // Phone modal is usually mandatory, so we might not want to close it by clicking outside, 
    // but if needed:
    // if (e.target === phoneModal) phoneModal.classList.add('hidden');
});

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

window.closeSaAlert = () => { document.getElementById('sa-custom-alert').classList.remove('active'); };

function createAdBanner() {
    const container = document.createElement('div'); container.className = 'ad-banner';
    const iframe = document.createElement('iframe');
    iframe.style.width = '468px'; iframe.style.height = '60px'; iframe.style.border = 'none';
    iframe.style.overflow = 'hidden'; iframe.style.maxWidth = '100%'; 
    const adContent = `<html><body style="margin:0;padding:0;background:transparent;display:flex;justify-content:center;align-items:center;"><script async>atOptions={'key':'e0f63746bfceb42ce1134aaff1b6709d','format':'iframe','height':60,'width':468,'params':{}};<\/script><script async src="https://www.highperformanceformat.com/e0f63746bfceb42ce1134aaff1b6709d/invoke.js"><\/script></body></html>`;
    container.appendChild(iframe);
    setTimeout(() => { 
        const doc = iframe.contentWindow.document; 
        doc.open(); doc.write(adContent); doc.close(); 
    }, 50);
    return container;
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

async function callPollinationsAI(prompt) {
    const url = `https://text.pollinations.ai/${encodeURIComponent(prompt)}`;
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('API Error');
        return await response.text();
    } catch (error) {
        console.error("AI Error:", error);
        throw error;
    }
}

window.goToAuth = () => {
        document.getElementById('landing-layer').classList.add('hidden');
        document.getElementById('auth-layer').classList.remove('hidden');
        setAuthRole('student');
};

window.setAuthRole = (role) => {
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
    document.getElementById('auth-layer').classList.add('hidden');
    document.getElementById('landing-layer').classList.remove('hidden');
};

window.handleSmartAuth = async () => {
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
    currentUser = name;
    myUid = uid;
    localStorage.setItem('sa_user', name);
    localStorage.setItem('sa_role', selectedRole);
    localStorage.setItem('sa_icon', icon || (selectedRole === 'student' ? 'fa-user-astronaut' : 'fa-user-tie'));
    localStorage.setItem('sa_uid', uid);
    
    document.getElementById('landing-layer').classList.add('hidden');
    document.getElementById('auth-layer').classList.add('hidden');
    updateMenuInfo();
    
    // Handle Deep Links
    handleDeepLinks();

    if (selectedRole === 'teacher') {
        document.getElementById('teacher-app').classList.remove('hidden');
        initTeacherApp();
    } else {
        document.getElementById('student-app').classList.remove('hidden');
        loadStudentExams(); loadStudentGrades(); initStudentReese(); 
    }
    initDardasha();
}

function handleDeepLinks() {
    const params = new URLSearchParams(window.location.search);
    const shareId = params.get('shareId');
    const examId = params.get('examId');
    const postId = params.get('postId');
    const chatTarget = params.get('chat');

    // AI Chat Share
    if(shareId) { 
        const prefix = selectedRole === 'teacher' ? 't' : 's';
        switchTab(`${prefix}-ai`); loadSharedChat(shareId, prefix); 
    }
    
    // Exam Share
    if(examId) {
        if(selectedRole === 'student') {
            switchTab('s-exams');
            checkPhoneAndStart(examId);
        } else {
             // Teacher viewing shared exam (maybe for editing or checking)
             switchTab('t-library');
             saAlert("هذا رابط امتحان. كمعلم يمكنك تعديله من المكتبة.", "info");
        }
    }

    // Post Share
    if(postId) {
        const prefix = selectedRole === 'teacher' ? 't' : 's';
        switchTab(`${prefix}-reese`);
        // Highlight post logic could go here, for now just load feed
        setTimeout(() => {
             const el = document.getElementById(`post-${postId}`);
             if(el) { el.scrollIntoView({behavior: "smooth"}); el.style.border = "2px solid var(--accent-primary)"; }
        }, 1500);
    }

    // Chat with User
    if(chatTarget && chatTarget !== myUid) {
        const prefix = selectedRole === 'teacher' ? 't' : 's';
        switchTab(`${prefix}-dardasha`);
        searchUserById(chatTarget);
    }
}

window.toggleMenu = () => {
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
    
    // Update Profile Modal info
    document.getElementById('pi-name').innerText = currentUser;
    document.getElementById('pi-avatar').innerHTML = `<i class="fas ${iconClass}"></i>`;
    document.getElementById('pi-avatar').style.color = color;
    document.getElementById('pi-avatar').style.borderColor = color;
    document.getElementById('pi-id-box').innerText = myUid;
    
    // Update Chat sidebar Avatar
    const prefix = selectedRole === 'teacher' ? 't' : 's';
    const chatAv = document.getElementById(`${prefix}-chat-my-avatar`);
    if(chatAv) {
        chatAv.innerHTML = `<i class="fas ${iconClass}"></i>`;
        chatAv.style.color = color;
        chatAv.style.borderColor = color;
    }
}

window.toggleEditProfile = () => {
    document.getElementById('menu-edit-section').classList.toggle('hidden');
    document.getElementById('menu-avatar-section').classList.add('hidden');
};

window.saveProfileName = async () => {
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
    document.getElementById('menu-avatar-section').classList.toggle('hidden');
    document.getElementById('menu-edit-section').classList.add('hidden');
};

window.saveAvatar = async (iconClass) => {
    localStorage.setItem('sa_icon', iconClass);
    await update(ref(db, `users/${selectedRole}s/${currentUser}`), { icon: iconClass });
    updateMenuInfo(); toggleAvatarSelect();
};

window.logout = () => { localStorage.clear(); location.reload(); };

window.shareApp = () => {
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

window.switchTab = (tabId, btn) => {
    const portal = selectedRole === 'teacher' ? 'teacher-app' : 'student-app';
    document.querySelectorAll(`#${portal} .app-section`).forEach(s => s.classList.add('hidden'));
    document.getElementById(tabId).classList.remove('hidden');
    if(btn) { document.querySelectorAll(`#${portal} .nav-btn`).forEach(b => b.classList.remove('active')); btn.classList.add('active'); }
    
    if(tabId === 's-grades') loadStudentGrades();
    if(tabId === 's-exams') {
        loadStudentExams();
        startTypewriter("student-type-text", "الاختبارات المتاحة لتطويرك");
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
};

// --- Dardasha Logic ---

function initDardasha() {
    const prefix = selectedRole === 'teacher' ? 't' : 's';
    const list = document.getElementById(`${prefix}-chat-list`);
    list.innerHTML = getMultipleSkeletons(2);
    
    // Listen for my chats
    onValue(ref(db, `user_chats/${myUid}`), (snap) => {
        list.innerHTML = '';
        if(!snap.exists()) {
            list.innerHTML = getEmptyStateHTML('chats');
            return;
        }
        
        const chats = snap.val();
        Object.entries(chats).forEach(([chatId, chatInfo]) => {
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
        });
    });
}

window.openMyProfileModal = () => {
    document.getElementById('profile-info-modal').classList.remove('hidden');
};

window.copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => saAlert("تم النسخ: " + text, "success"));
};

window.copyProfileLink = () => {
    const url = `${window.location.href.split('?')[0]}?chat=${myUid}`;
    navigator.clipboard.writeText(url).then(() => saAlert("تم نسخ رابط المحادثة المباشر!", "success"));
};

window.toggleUserSearchModal = () => {
    document.getElementById('user-search-modal').classList.remove('hidden');
    document.getElementById('user-search-result').innerHTML = '';
    document.getElementById('user-search-id-input').value = '';
};

window.searchUserById = async (forcedId = null) => {
    const id = forcedId || document.getElementById('user-search-id-input').value.trim();
    if(!id) return;
    
    const resultDiv = document.getElementById('user-search-result');
    if(!forcedId) resultDiv.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري البحث...';
    
    // Search in both students and teachers
    let foundUser = null;
    let foundRole = '';
    
    // Try students
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
             // Directly open chat if deep link
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
    // Create consistent Chat ID (smaller UID first)
    const chatId = myUid < otherUid ? `${myUid}_${otherUid}` : `${otherUid}_${myUid}`;
    
    // Update User Chats List for both
    const myUpdate = { otherName, otherIcon, otherUid, lastMsg: '', lastMsgTime: Date.now() };
    const otherUpdate = { otherName: currentUser, otherIcon: localStorage.getItem('sa_icon'), otherUid: myUid, lastMsg: '', lastMsgTime: Date.now() };
    
    await update(ref(db, `user_chats/${myUid}/${chatId}`), myUpdate);
    await update(ref(db, `user_chats/${otherUid}/${chatId}`), otherUpdate);
    
    openChatRoom(chatId, otherName, otherIcon, otherUid);
};

window.openChatRoom = (chatId, name, icon, uid) => {
    activeChatRoomId = chatId;
    const prefix = selectedRole === 'teacher' ? 't' : 's';
    const win = document.getElementById(`${prefix}-chat-window`);
    
    // Hide sidebar on mobile
    if(window.innerWidth < 768) {
        document.getElementById(`${prefix}-chat-sidebar`).classList.add('hidden');
    }
    win.classList.remove('hidden');
    
    win.innerHTML = `
        <div class="chat-header">
            <button class="icon-btn-small" onclick="closeChatWindow('${prefix}')"><i class="fas fa-arrow-right"></i></button>
            <div class="avatar-frame mini-frame" style="width:35px; height:35px; font-size:1rem;"><i class="fas ${icon}"></i></div>
            <div style="font-weight:bold;">${name}</div>
            <div style="margin-right:auto; display:flex; gap:10px;">
                <button class="icon-btn-small" title="اتصال صوتي (قريباً)"><i class="fas fa-phone"></i></button>
                <button class="icon-btn-small" onclick="copyProfileLinkFor('${uid}')" title="نسخ رابط المستخدم"><i class="fas fa-link"></i></button>
            </div>
        </div>
        <div class="chat-msgs-area" id="chat-msgs-${chatId}"></div>
        <div class="chat-input-area">
            <label class="icon-btn-small" style="cursor:pointer;"><i class="fas fa-camera"></i><input type="file" hidden accept="image/*" onchange="sendChatImage(this, '${chatId}', '${uid}')"></label>
            <input type="text" id="chat-input-${chatId}" placeholder="اكتب رسالة..." onkeypress="handleChatEnter(event, '${chatId}', '${uid}')">
            <button class="send-btn" style="width:35px; height:35px;" onclick="sendChatMessage('${chatId}', '${uid}')"><i class="fas fa-paper-plane"></i></button>
        </div>
    `;

    // Listen for messages
    const msgContainer = document.getElementById(`chat-msgs-${chatId}`);
    onValue(ref(db, `chats/${chatId}`), (snap) => {
        msgContainer.innerHTML = '';
        if(snap.exists()) {
            const msgs = snap.val();
            Object.values(msgs).forEach(msg => {
                const isMe = msg.sender === myUid;
                const div = document.createElement('div');
                div.className = `msg-bubble ${isMe ? 'sent' : 'recv'}`;
                
                let content = msg.text;
                if(msg.type === 'image') {
                    content = `<img src="${msg.text}" class="whatsapp-img" onclick="openImageViewer(this.src)">`;
                }
                
                div.innerHTML = `
                    ${content}
                    <div class="msg-time">${new Date(msg.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</div>
                `;
                msgContainer.appendChild(div);
            });
            msgContainer.scrollTop = msgContainer.scrollHeight;
        }
    });
};

window.closeChatWindow = (prefix) => {
    document.getElementById(`${prefix}-chat-window`).classList.add('hidden');
    document.getElementById(`${prefix}-chat-sidebar`).classList.remove('hidden');
    activeChatRoomId = null;
};

window.handleChatEnter = (e, chatId, otherUid) => {
    if(e.key === 'Enter') sendChatMessage(chatId, otherUid);
};

window.sendChatMessage = async (chatId, otherUid) => {
    const input = document.getElementById(`chat-input-${chatId}`);
    const text = input.value.trim();
    if(!text) return;
    
    await push(ref(db, `chats/${chatId}`), {
        sender: myUid,
        text: text,
        type: 'text',
        timestamp: Date.now()
    });
    
    // Update last msg
    await update(ref(db, `user_chats/${myUid}/${chatId}`), { lastMsg: text, lastMsgTime: Date.now() });
    await update(ref(db, `user_chats/${otherUid}/${chatId}`), { lastMsg: text, lastMsgTime: Date.now() });
    
    input.value = '';
};

window.sendChatImage = async (input, chatId, otherUid) => {
    if(input.files && input.files[0]) {
        // Check Limit (5 per day)
        const today = new Date().toDateString();
        const usageKey = `img_usage_${myUid}_${today}`;
        let count = parseInt(localStorage.getItem(usageKey) || '0');
        
        if(count >= 5) {
            saAlert("عفواً، لقد تجاوزت الحد الأقصى لإرسال الصور اليوم (5 صور).", "error");
            input.value = '';
            return;
        }
        
        const b64 = await getBase64(input.files[0]);
        
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

window.copyProfileLinkFor = (uid) => {
     const url = `${window.location.href.split('?')[0]}?chat=${uid}`;
    navigator.clipboard.writeText(url).then(() => saAlert("تم نسخ رابط المستخدم!", "success"));
};

window.filterChats = (prefix, term) => {
    const items = document.querySelectorAll(`#${prefix}-chat-list .chat-item`);
    items.forEach(item => {
        const name = item.querySelector('div[style*="font-weight:bold"]').innerText.toLowerCase();
        if(name.includes(term.toLowerCase())) item.classList.remove('hidden');
        else item.classList.add('hidden');
    });
};

// --- End Dardasha Logic ---

window.openReeseCompose = () => {
    document.getElementById('reese-compose-modal').classList.add('open');
    const icon = localStorage.getItem('sa_icon');
    const color = selectedRole === 'teacher' ? 'var(--accent-gold)' : 'var(--accent-primary)';
    const frame = document.getElementById('compose-avatar');
    frame.innerHTML = `<i class="fas ${icon}"></i>`;
    frame.style.color = color; frame.style.borderColor = color;
    document.getElementById('compose-name').innerText = currentUser;
    reeseImages = []; renderReeseMediaPreview();
    
    document.getElementById('ai-reese-suggestions').innerHTML = '';
    document.getElementById('ai-reese-suggestions').classList.add('hidden');
};

window.closeReeseCompose = () => {
    document.getElementById('reese-compose-modal').classList.remove('open');
    document.getElementById('reese-text-input').value = '';
    document.getElementById('reese-text-input').style.height = 'auto';
    reeseImages = []; renderReeseMediaPreview();
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
                <div class="reese-content">${post.content}</div>${imagesHtml}
                <div class="reese-actions">
                    <button class="reese-btn ${isLiked ? 'liked' : ''}" onclick="likeReese('${post.id}', ${post.likes || 0})"><i class="fas ${isLiked ? 'fa-thumbs-up' : 'fa-thumbs-up'}"></i> <span>${post.likes || 0}</span></button>
                    <button class="reese-btn" onclick="shareReese('${post.id}')"><i class="fas fa-share"></i> مشاركة</button>
                </div>`;
            container.appendChild(div); container.appendChild(createAdBanner());
        });
        if(visibleCount === 0) container.innerHTML = getEmptyStateHTML('posts');
    });
};

window.toggleMyPostsView = () => {
    isMyPostsView = !isMyPostsView;
    const prefix = selectedRole === 'teacher' ? 't' : 's';
    const icon = document.getElementById(`${prefix}-eraser-icon`);
    if(isMyPostsView) { icon.style.color = 'var(--danger)'; } else { icon.style.color = '#aaa'; }
    loadReesePosts(prefix);
    saAlert(isMyPostsView ? "عرض منشوراتك فقط (وضع الإدارة)" : "عرض كل المنشورات", "info");
};

window.likeReese = async (id, currentLikes) => {
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
    const url = `${window.location.href.split('?')[0]}?postId=${id}`;
    if(navigator.share) { navigator.share({ title: 'Reese SA', text: 'شاهد هذا المنشور', url: url }).catch(e=>console.log(e)); } 
    else { navigator.clipboard.writeText(url).then(() => saAlert("تم نسخ رابط المنشور", "success")); }
};

window.generateAiReese = async () => {
    toggleConstructionOverlay(true, "SA AI THINKING", "توليد أفكار إبداعية...");
    const prompt = `Generate 3 distinct, engaging, and short social media post ideas for a ${selectedRole} on an educational app. Return them as a JSON array of strings (e.g., ["Idea 1", "Idea 2", "Idea 3"]). Language: Arabic. Keep them under 150 characters.`;
    
    try {
        let text = await callPollinationsAI(prompt);
        text = text.replace(/```json/g, '').replace(/```/g, '').trim();
        let suggestions = [];
        try {
            suggestions = JSON.parse(text);
        } catch(e) {
            suggestions = [text];
        }

        if (!Array.isArray(suggestions)) suggestions = [text];

        const container = document.getElementById('ai-reese-suggestions');
        container.innerHTML = '';
        container.classList.remove('hidden');

        suggestions.forEach(sug => {
            const chip = document.createElement('div');
            chip.className = 'suggestion-chip';
            chip.innerHTML = `${sug} <i class="fas fa-plus-circle"></i>`;
            chip.onclick = () => {
                document.getElementById('reese-text-input').value = sug;
            };
            container.appendChild(chip);
        });
        toggleConstructionOverlay(false);
    } catch(e) { 
        console.error(e);
        toggleConstructionOverlay(false);
        saAlert("فشل التوليد، تأكد من الاتصال.", "error"); 
    }
};

function generateChatId() { return Date.now().toString(36) + Math.random().toString(36).substr(2); }

window.startNewChat = (prefix) => {
    currentChatId = generateChatId(); currentChatMessages = []; isIncognito = false;
    document.getElementById(`${prefix}-ai-msgs`).innerHTML = ''; 
    document.getElementById(`${prefix}-incognito-btn`).classList.remove('active');
    renderAiWelcome(prefix); toggleHistory(false);
};

window.renderAiWelcome = (prefix) => {
    const msgs = document.getElementById(`${prefix}-ai-msgs`);
    const firstName = currentUser.split(' ')[0];
    msgs.innerHTML = `
        <div class="ai-welcome-screen">
            <div class="ai-logo-large"><i class="fas fa-wand-magic-sparkles"></i></div>
            <h3 class="ai-welcome-title">مرحباً ${firstName} 👋</h3>
            <p class="ai-welcome-text">أنا مساعدك الذكي SA AI. <br>يمكنني قراءة الصور، إنشاء الاختبارات، ونشر الأفكار!</p>
            <div class="ai-chips">
                <div class="ai-chip" onclick="fillAiInput('${prefix}', 'أنشئ اختبار عن الكيمياء العضوية')"><i class="fas fa-flask"></i> إنشاء اختبار</div>
                <div class="ai-chip" onclick="fillAiInput('${prefix}', 'انشر بوست عن أهمية التعليم')"><i class="fas fa-feather"></i> كتابة منشور</div>
                <div class="ai-chip" onclick="fillAiInput('${prefix}', 'اشرح لي هذا المفهوم المعقد ببساطة')"><i class="fas fa-lightbulb"></i> شرح مفهوم</div>
            </div>
        </div>`;
};

window.fillAiInput = (prefix, text) => { document.getElementById(`${prefix}-ai-input`).value = text; };

window.toggleIncognito = (prefix) => {
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
    return safeText;
}

function renderMessageUI(prefix, role, text, imgB64) {
    const msgs = document.getElementById(`${prefix}-ai-msgs`);
    const div = document.createElement('div'); 
    div.className = `chat-msg ${role}`; 
    
    if (role === 'ai') {
        div.innerHTML = formatAiResponseText(text);
    } else {
        div.innerText = text;
    }

    if(imgB64) { const img = document.createElement('img'); img.src = imgB64.startsWith('data:') ? imgB64 : `data:image/jpeg;base64,${imgB64}`; div.appendChild(img); }
    msgs.appendChild(div); msgs.scrollTop = msgs.scrollHeight;
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
                cardWrapper.innerHTML = `
                    <div class="mini-card" style="${hiddenStyle}">
                        <div class="card-header">
                            <div><h3 class="card-title">${val.title}</h3><div class="card-meta"><span>${getGradeLabel(val.grade)}</span> • <span>${val.duration} دقيقة</span></div></div>
                            <div class="teacher-badge">نشط</div>
                        </div>
                        <div class="icon-actions">
                            <button class="action-icon edit" onclick="editTest('${key}')" title="تعديل"><i class="fas fa-pen"></i></button>
                            <button class="action-icon share" onclick="shareTest('${val.title}', '${key}')" title="مشاركة"><i class="fas fa-share-alt"></i></button>
                            <button class="action-icon gold" onclick="toggleTestVisibility('${key}', ${!val.isHidden})" title="إخفاء/إظهار"><i class="fas fa-eye${val.isHidden ? '' : '-slash'}"></i></button>
                            <button class="action-icon results-icon" onclick="openResultsTab('${key}')" title="النتائج"><i class="fas fa-chart-bar"></i></button>
                            <button class="action-icon delete" onclick="deleteTest('${key}')" title="حذف"><i class="fas fa-trash"></i></button>
                        </div>
                    </div>`;
                list.appendChild(cardWrapper); list.appendChild(createAdBanner());
            }
        });
        if(count === 0) list.innerHTML = getEmptyStateHTML('exams');
    });
    resultSelect.onchange = (e) => loadTestResults(e.target.value);
}

window.openResultsTab = (testId) => { switchTab('t-results'); document.getElementById('t-result-select').value = testId; loadTestResults(testId); };

let currentQType = 'mcq';

window.setQType = (type, label) => {
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
    document.getElementById('custom-grade-input').classList.add('hidden');
    document.getElementById('create-page-title').innerText = "اختبار جديد";
    document.getElementById('btn-save-test').innerHTML = '<i class="fas fa-save"></i> نشر الاختبار النهائي';
    currentQuestions = []; renderAddedQuestions(); clearQuestionForm(); isEditingMode = false; editingTestId = null;
};

window.editTest = async (testId) => {
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
};

window.saveTest = async () => {
    const title = document.getElementById('new-test-name').value;
    let grade = document.getElementById('new-test-grade').value; if(grade === 'custom') grade = document.getElementById('custom-grade-input').value;
    const duration = document.getElementById('new-test-duration').value;
    if(!title || !grade || !duration || currentQuestions.length === 0) return saAlert("البيانات ناقصة (تأكد من إضافة سؤال واحد على الأقل)", "error");
    const payload = { teacher: currentUser, title, grade, duration, questions: currentQuestions, timestamp: Date.now(), isHidden: false };
    if (isEditingMode && editingTestId) { await update(ref(db, `tests/${editingTestId}`), payload); saAlert("تم تعديل الاختبار بنجاح!", "success"); } 
    else { await push(ref(db, 'tests'), payload); saAlert("تم نشر الاختبار بنجاح!", "success"); }
    resetCreateForm(); switchTab('t-library');
};

window.checkCustomGrade = (el) => { document.getElementById('custom-grade-input').classList.toggle('hidden', el.value !== 'custom'); };
window.toggleTestVisibility = (k, s) => { update(ref(db, `tests/${k}`), { isHidden: s }); saAlert(s ? "تم إخفاء الاختبار عن الطلاب" : "الاختبار الآن مرئي للطلاب", "info"); };
window.deleteTest = (k) => { saConfirm("هل أنت متأكد من حذف هذا الاختبار؟", () => { remove(ref(db, `tests/${k}`)); remove(ref(db, `results/${k}`)); saAlert("تم الحذف بنجاح", "success"); }); };

window.shareTest = (title, id) => {
    const url = `${window.location.href.split('?')[0]}?examId=${id}`;
    if(navigator.share) { navigator.share({ title: 'SA EDU Exam', text: `ندعوكم لأداء اختبار "${title}"`, url: url }).catch(err=>console.log(err)); } 
    else { navigator.clipboard.writeText(url).then(() => saAlert("تم نسخ رابط الاختبار المباشر!", "success")); }
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
            let buttonsHtml = hasTaken ? 
                `<button class="action-icon share" onclick="shareTest('${val.title}', '${key}')" title="مشاركة"><i class="fas fa-share-alt"></i></button>
                    <button class="action-icon edit" onclick="checkPhoneAndStart('${key}')" title="إعادة الاختبار"><i class="fas fa-redo"></i></button>
                    <button class="action-icon gold" onclick="reviewTest('${key}')" title="مراجعة"><i class="fas fa-file-alt"></i></button>` :
                `<button class="action-icon share" onclick="shareTest('${val.title}', '${key}')" title="مشاركة"><i class="fas fa-share-alt"></i></button>
                    <button class="action-icon edit" style="width:100%; border-radius:15px; background:var(--accent-primary); color:white; justify-content:center;" onclick="checkPhoneAndStart('${key}')"><i class="fas fa-rocket"></i> ابدأ الآن</button>`;
            cardWrapper.innerHTML = `
                <div class="mini-card">
                    <div class="card-header">
                        <div><h3 class="card-title">${val.title}</h3><div class="card-meta"><span>${val.teacher}</span> • ${val.duration} دقيقة</div></div>
                        ${hasTaken ? `<span style="color:var(--success); font-weight:bold;">${score}%</span>` : ''}
                    </div>
                    <div class="icon-actions">${buttonsHtml}</div>
                </div>`;
            list.appendChild(cardWrapper); list.appendChild(createAdBanner());
        });
        if(!foundExam) list.innerHTML = getEmptyStateHTML('exams');
    });
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
    tempTestId = id; const userSnap = await get(ref(db, `users/students/${currentUser}`));
    if(userSnap.exists() && userSnap.val().phone) startTest(id); else document.getElementById('phone-modal').classList.remove('hidden');
};

window.savePhoneAndStart = async () => {
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
    clearInterval(timerInt); let score = 0, total = 0, details = [];
    const questions = activeTest.questions || [];
    questions.forEach((q, i) => {
        const pts = parseInt(q.points) || 1; 
        total += pts; 
        
        let isCorrect = false;
        if (q.type === 'essay') {
            if (answers[i] && answers[i].trim().length > 2) {
                isCorrect = true; 
                score += pts;
            }
        } else {
            isCorrect = answers[i] === q.correct;
            if(isCorrect) score += pts; 
        }
        
        details.push({ 
            q: q.text, 
            image: q.image || null, 
            user: answers[i]||'-', 
            correct: q.correct, 
            isCorrect,
            type: q.type || 'mcq'
        });
    });
    const pct = total === 0 ? 0 : Math.round((score/total)*100);
    await set(ref(db, `results/${activeTest.id}/${currentUser}`), { score, total, percentage: pct, timestamp: Date.now(), details });
    saAlert(`تم التسليم! النتيجة التقريبية: ${pct}%`, "success");
    document.getElementById('s-taking-test').classList.add('hidden'); loadStudentExams(); loadStudentGrades(); 
};

window.reviewTest = async (id) => {
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

window.toggleAiGenerator = () => { document.getElementById('ai-gen-modal').classList.toggle('open'); };

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

window.sendAiMsg = async (prefix) => {
    const input = document.getElementById(`${prefix}-ai-input`); 
    const fileInput = document.getElementById(`${prefix}-ai-file`);
    const msgs = document.getElementById(`${prefix}-ai-msgs`); 
    let txt = input.value.trim();
    
    if(!txt && !fileInput.files[0]) return;
    
    if (!fileInput.files[0]) {
        if (txt.includes("أنشئ اختبار") || txt.includes("create exam") || txt.includes("امتحان")) {
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

    if(fileInput.files[0]) {
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
    saveChatToLocal();
    
    const loadId = 'loading-' + Date.now();
    const loaderDiv = document.createElement('div');
    loaderDiv.className = 'chat-msg ai'; 
    loaderDiv.id = loadId; 
    loaderDiv.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i>';
    msgs.appendChild(loaderDiv); 
    msgs.scrollTop = msgs.scrollHeight;
    
    try {
        let finalPrompt = "Reply in Arabic. ";
        if (ocrText) {
            finalPrompt += `Context from image: "${ocrText}". `;
        }
        finalPrompt += txt;
        
        const reply = await callPollinationsAI(finalPrompt);
        
        document.getElementById(loadId).remove();
        currentChatMessages.push({ role: 'ai', content: reply, image: null });
        renderMessageUI(prefix, 'ai', reply, null); 
        saveChatToLocal();
    } catch (e) { 
        document.getElementById(loadId).innerText = "حدث خطأ في الاتصال بالذكاء الاصطناعي."; 
        console.error(e);
    }
};

window.generateAiQuestions = async () => {
    const topic = document.getElementById('ai-gen-text').value;
    const mcqCount = document.getElementById('ai-mcq-count').value || 0;
    const essayCount = document.getElementById('ai-essay-count').value || 0;
    const total = parseInt(mcqCount) + parseInt(essayCount);
    
    if (!topic && !aiGenImgBase64) return saAlert("أدخل الموضوع أو ارفع صورة", "error");
    if (total === 0) return saAlert("يجب تحديد عدد الأسئلة", "error");

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
    
    const prompt = `Create a strict JSON array of ${total} questions based on: "${contextData}". 
    Language: Arabic. 
    Requirements: Exactly ${mcqCount} MCQ questions and ${essayCount} Essay questions.
    Structure: [{"type":"mcq", "text":"Question?", "options":["A","B"], "correct":"A", "points":1}, {"type":"essay", "text":"Question?", "correct":"Model Answer for Teacher", "points":1}].
    Return ONLY raw JSON.`;
    
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
            saAlert(`تم بناء ${questions.length} سؤال بنجاح!`, "success");
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
