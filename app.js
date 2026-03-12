// MÃ NGUỒN FRONTEND CHO APP AN TOÀN HỌC ĐƯỜNG
// Hãy thay thế đường dẫn này bằng Web App URL của Google Apps Script sau khi Deploy
const GAS_URL = "https://script.google.com/macros/s/AKfycbzETkDWmmlhpYxu9aapWkpAWB3Qc3BUtgjEwC7xGO0MYzVFwXokaL10GlpLW7VqBHHN/exec";

let currentUser = null;
let currentRole = 'student';
let currentFileBase64 = null;
let currentFileMimeType = null;
let currentFileName = null;
let studentReportsCache = []; // Cache for chat history
let currentAdminTab = 'reports'; // Global for admin navigation

// --- UI Utilities ---
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast show ${type}`;
    setTimeout(() => {
        toast.className = 'toast';
    }, 3000);
}

function showLoader() {
    document.getElementById('loader').classList.add('active');
}

function hideLoader() {
    document.getElementById('loader').classList.remove('active');
}

function switchScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
}

function openModal(modalId) {
    document.getElementById(modalId).classList.add('active');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

let currentConfirmCallback = null;
function customConfirm(message, callback) {
    document.getElementById('confirm-msg').textContent = message;
    document.getElementById('custom-confirm').classList.add('active');
    currentConfirmCallback = callback;
}

function closeCustomConfirm() {
    document.getElementById('custom-confirm').classList.remove('active');
    currentConfirmCallback = null;
}

function handleConfirmYes() {
    document.getElementById('custom-confirm').classList.remove('active');
    if (currentConfirmCallback) {
        currentConfirmCallback();
        currentConfirmCallback = null;
    }
}

function toggleRegisterBtn() {
    const role = document.querySelector('input[name="role"]:checked').value;
    const btn = document.getElementById('btn-register');
    if (role === 'student') {
        btn.classList.remove('hidden');
    } else {
        btn.classList.add('hidden');
    }
}

// --- API Helper ---
async function apiCall(data) {
    if (GAS_URL.includes("YOUR_SPREADSHEET")) {
        showToast("Vui lòng cập nhật GAS_URL trong file app.js", "error");
        return { success: false };
    }
    try {
        const response = await fetch(`${GAS_URL}?action=${data.action}`, {
            method: 'POST',
            body: JSON.stringify(data),
            headers: {
                'Content-Type': 'text/plain;charset=utf-8',
            }
        });
        const result = await response.json();
        return result;
    } catch (error) {
        console.error("API Error:", error);
        return { success: false, message: "Lỗi kết nối máy chủ." };
    }
}

// --- Auth ---
async function login() {
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();
    const role = document.querySelector('input[name="role"]:checked').value;

    if (!username || !password) {
        showToast("Vui lòng nhập đầy đủ Tài khoản/Mật khẩu!", "error");
        return;
    }

    showLoader();
    const res = await apiCall({ action: 'login', username, password, role });
    hideLoader();

    if (res && res.success) {
        showToast("Đăng nhập thành công!", "success");
        currentUser = username;
        currentRole = role;

        if (role === 'student') {
            document.getElementById('student-name').textContent = username;
            switchScreen('student-dashboard');
            loadStudentData();
        } else {
            document.getElementById('admin-name').textContent = username;
            switchScreen('admin-dashboard');
            backToAdminMenu();
        }
    } else {
        showToast(res && res.message ? res.message : "Tài khoản hoặc mật khẩu không đúng. Vui lòng thử lại.", "error");
    }
}

async function register() {
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();
    const role = document.querySelector('input[name="role"]:checked').value;

    if (role !== 'student') {
        showToast("Chỉ học sinh mới có thể đăng ký!", "error");
        return;
    }

    if (!username || !password) {
        showToast("Vui lòng nhập đầy đủ thông tin!", "error");
        return;
    }

    showLoader();
    const res = await apiCall({ action: 'register', username, password, role });
    hideLoader();

    if (res && res.success) {
        showToast("Đăng ký thành công! Hãy đăng nhập.", "success");
    } else {
        showToast(res && res.message ? res.message : "Lỗi đăng ký.", "error");
    }
}

function logout() {
    currentUser = null;
    currentRole = 'student';
    switchScreen('login-screen');
}

// --- Student Dashboard ---
async function loadStudentData() {
    if (!currentUser) return;
    const res = await apiCall({ action: 'getData', username: currentUser });
    if (res && res.success) {
        studentReportsCache = res.reports; // Update cache
        document.getElementById('stat-total-sent').textContent = res.stats.sent;
        document.getElementById('stat-sent').textContent = res.stats.sent;
        document.getElementById('stat-processed').textContent = res.stats.processed;

        const container = document.getElementById('student-reports-container');
        container.innerHTML = '';
        if (res.reports.length === 0) {
            container.innerHTML = '<div class="empty-state">Chưa có báo cáo nào</div>';
        } else {
            res.reports.forEach(r => {
                const dateStr = new Date(r.time).toLocaleString('vi-VN');
                const linkHtml = r.fileUrl ? `<a href="${r.fileUrl}" target="_blank" style="margin-bottom:8px; display:inline-block;"><i class="fa-solid fa-link"></i> Xem bằng chứng</a><br>` : '';
                const statusHtml = (r.status === "Đã xử lý") ? `<span style="color:var(--c-green);font-size:12px;display:inline-block;margin-top:5px;font-weight:600;"><i class="fa-solid fa-check-circle"></i> Đã xử lý</span>` : `<span style="color:#f59e0b;font-size:12px;display:inline-block;margin-top:5px;font-weight:600;"><i class="fa-regular fa-clock"></i> Đang chờ xử lý</span>`;

                let simplifiedReply = '';
                if (r.type === 'Hỏi đáp & Tâm sự' && r.details) {
                    simplifiedReply = `<div style="margin-top: 8px; padding: 10px; background: rgba(14, 165, 233, 0.1); border-left: 3px solid var(--primary); border-radius: 4px; font-size: 13px;"><strong><i class="fa-solid fa-headset"></i> Phản hồi từ Admin:</strong><br>${r.details}</div>`;
                } else if (r.type === 'SOS Khẩn cấp' && r.status === 'Đã xử lý' && r.details) {
                    simplifiedReply = `<div style="margin-top: 8px; padding: 10px; background: rgba(239, 68, 68, 0.1); border-left: 3px solid var(--c-red); border-radius: 4px; font-size: 13px;"><strong><i class="fa-solid fa-headset"></i> Phản hồi hỗ trợ:</strong><br>${r.details}</div>`;
                }

                container.innerHTML += `
                    <div class="report-item" style="position:relative;">
                        <button class="delete-btn-item" onclick="deleteSingleReport(${r.id}, 'student')" title="Xóa">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                        <h4 style="padding-right:30px;">${r.type}</h4>
                        <p>${r.content}</p>
                        ${simplifiedReply}
                        ${linkHtml}
                        <small>${dateStr}</small>
                        ${statusHtml}
                    </div>
                `;
            });
        }
    }
}

async function deleteSingleReport(id, role) {
    customConfirm("Bạn có chắc chắn muốn xóa nội dung này? Hành động này cũng sẽ xóa dữ liệu trên Google Sheet.", async () => {
        showLoader();
        const res = await apiCall({ action: 'deleteReport', id: id });
        if (res && res.success) {
            showToast("Đã xóa thành công!", "success");
            if (role === 'student') {
                loadStudentData();
            } else {
                await refreshAdminCache();
                loadAdminTab(currentAdminTab);
            }
        } else {
            hideLoader();
            showToast("Lỗi khi xóa!", "error");
        }
    });
}

function deleteAllStudentReports() {
    customConfirm("Xóa TOÀN BỘ lịch sử báo cáo/hỏi đáp của bạn? Điều này sẽ xóa sạch dữ liệu trên máy chủ.", async () => {
        showLoader();
        // Xóa lần lượt các loại (hoặc có thể viết thêm API xóa toàn bộ theo user)
        // Ở đây xóa theo mục tiêu của học sinh đang thấy trên màn hình
        const types = ["Báo cáo ẩn danh", "Hỏi đáp & Tâm sự", "SOS Khẩn cấp"];
        for (let type of types) {
            await apiCall({ action: 'deleteCategoryReports', type: type, username: currentUser });
        }
        showToast("Đã dọn dẹp sạch lịch sử!", "success");
        loadStudentData();
    });
}

async function submitReport(e) {
    if (e) e.preventDefault();
    const content = document.getElementById('report-type').value.trim();
    const details = document.getElementById('report-details').value.trim();

    if (!content) return;

    showLoader();
    const payload = {
        action: 'submitReport',
        username: currentUser,
        type: 'Báo cáo ẩn danh',
        content,
        details
    };

    if (currentFileBase64) {
        payload.fileBase64 = currentFileBase64;
        payload.fileMimeType = currentFileMimeType;
        payload.fileName = currentFileName;
    }

    const res = await apiCall(payload);
    hideLoader();

    if (res && res.success) {
        showToast("Báo cáo của bạn đã được gửi an toàn!", "success");
        document.getElementById('report-form').reset();
        clearFilePreview();
        closeModal('report-modal');
        loadStudentData();
    } else {
        showToast("Lỗi khi gửi báo cáo.", "error");
    }
}

function previewFile() {
    const fileInput = document.getElementById('report-file');
    const previewContainer = document.getElementById('file-preview-container');
    const file = fileInput.files[0];

    if (file) {
        if (file.size > 5 * 1024 * 1024) {
            showToast("File quá lớn! Giới hạn 5MB.", "error");
            fileInput.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = function (e) {
            currentFileBase64 = e.target.result.split(',')[1];
            currentFileMimeType = file.type;
            currentFileName = file.name;

            previewContainer.classList.remove('hidden');
            if (file.type.startsWith('image/')) {
                previewContainer.innerHTML = `<img src="${e.target.result}"><i class="fa-solid fa-xmark remove-file" onclick="clearFilePreview()"></i>`;
            } else if (file.type.startsWith('video/')) {
                previewContainer.innerHTML = `<video src="${e.target.result}"></video><i class="fa-solid fa-xmark remove-file" onclick="clearFilePreview()"></i>`;
            } else {
                previewContainer.innerHTML = `<i class="fa-solid fa-file" style="font-size:24px; color:var(--primary); margin:13px;"></i><i class="fa-solid fa-xmark remove-file" onclick="clearFilePreview()"></i>`;
            }
        };
        reader.readAsDataURL(file);
    } else {
        clearFilePreview();
    }
}

function clearFilePreview() {
    const fileInput = document.getElementById('report-file');
    if (fileInput) fileInput.value = '';
    const container = document.getElementById('file-preview-container');
    if (container) {
        container.classList.add('hidden');
        container.innerHTML = '';
    }
    currentFileBase64 = null;
    currentFileMimeType = null;
    currentFileName = null;
}

// --- SOS Features ---
// --- SOS Features ---
async function openSOSModal() {
    // Mở modal ngay lập tức để người dùng thấy phản hồi
    const adminListContainer = document.getElementById('admin-list-sos');
    adminListContainer.innerHTML = '<div style="text-align:center; padding:15px; font-size:12px; color:var(--text-muted);"><i class="fa-solid fa-spinner fa-spin"></i> Đang tải danh sách Admin...</div>';
    openModal('sos-modal');

    // Tải dữ liệu admin trong nền
    try {
        const res = await apiCall({ action: 'getAdmins' });
        if (res && res.success) {
            let adminHtml = '';
            res.admins.forEach(admin => {
                adminHtml += `
                    <div style="display:flex; justify-content:space-between; align-items:center; padding: 12px; border-bottom: 1px solid #eee;">
                        <div>
                            <div style="font-weight:600; font-size:14px; color:black;">${admin.name}</div>
                            <div style="color:var(--text-muted); font-size:12px;">SĐT: ${admin.phone}</div>
                        </div>
                        <a href="tel:${admin.phone}" class="btn" style="width:auto; padding:5px 15px; font-size:12px; background:var(--c-green); color:white; border-radius:30px; text-decoration:none;">
                            <i class="fa-solid fa-phone"></i> Gọi ngay
                        </a>
                    </div>
                `;
            });
            adminListContainer.innerHTML = adminHtml || '<p style="font-size:12px; color:red; padding:10px;">Chưa có thông tin Admin liên hệ.</p>';
        } else {
            adminListContainer.innerHTML = '<p style="font-size:12px; color:red; padding:10px;">Không thể tải danh sách liên hệ.</p>';
        }
    } catch (err) {
        adminListContainer.innerHTML = '<p style="font-size:12px; color:red; padding:10px;">Lỗi kết nối máy chủ.</p>';
    }
}

async function sendSOSMessage() {
    const msg = document.getElementById('sos-message').value.trim();
    if (!msg) {
        showToast("Vui lòng nhập nội dung cần hỗ trợ!", "error");
        return;
    }
    showLoader();
    const res = await apiCall({
        action: 'submitReport',
        username: currentUser,
        type: 'SOS Khẩn cấp',
        content: msg,
        details: 'Gửi từ tính năng SOS gọi điện',
        fileUrl: ''
    });
    hideLoader();
    if (res && res.success) {
        showToast("Đã gửi tín hiệu SOS thành công!", "success");
        document.getElementById('sos-message').value = '';
        loadStudentData();
    } else {
        showToast("Lỗi khi gửi SOS", "error");
    }
}

function openChatModal() {
    loadChatHistory();
    openModal('chat-modal');
}

function loadChatHistory() {
    const chatBox = document.getElementById('chat-box');
    chatBox.innerHTML = `
        <div class="chat-message admin-msg">
            <div class="msg-bubble">Chào bạn, bạn muốn tâm sự hay hỏi đáp gì không? Thông tin của bạn được bảo mật.</div>
        </div>
    `;

    // Filter and display chat history
    const chats = studentReportsCache.filter(r => r.type === 'Hỏi đáp & Tâm sự');
    // Result is reversed (newest first), we want oldest first for chat flow
    [...chats].reverse().forEach(c => {
        chatBox.innerHTML += `
            <div class="chat-message user-msg">
                <div class="msg-bubble">${c.content}</div>
            </div>
        `;
        if (c.details && c.status === 'Đã xử lý') {
            chatBox.innerHTML += `
                <div class="chat-message admin-msg">
                    <div class="msg-bubble">${c.details}</div>
                </div>
            `;
        }
    });
    chatBox.scrollTop = chatBox.scrollHeight;
}

// --- Chat Features ---
function sendChat() {
    const input = document.getElementById('chat-input');
    const msg = input.value.trim();
    if (!msg) return;

    const chatBox = document.getElementById('chat-box');
    chatBox.innerHTML += `
        <div class="chat-message user-msg">
            <div class="msg-bubble">${msg}</div>
        </div>
    `;
    input.value = '';
    chatBox.scrollTop = chatBox.scrollHeight;

    // Save to DB in background
    apiCall({
        action: 'submitReport',
        username: currentUser,
        type: 'Hỏi đáp & Tâm sự',
        content: msg,
        details: '',
        fileUrl: ''
    }).then(res => {
        if (res && res.success) {
            loadStudentData();
        }
    });

    // Auto reply
    setTimeout(() => {
        chatBox.innerHTML += `
            <div class="chat-message admin-msg">
                <div class="msg-bubble">Quản trị viên đã nhận được tin nhắn. Phản hồi sẽ hiển thị ở bảng "Báo cáo gần đây".</div>
            </div>
        `;
        chatBox.scrollTop = chatBox.scrollHeight;
    }, 1000);
}

// --- Admin Actions ---
let adminReportsCache = null;
let adminNewsCache = null;

function backToAdminMenu() {
    document.getElementById('admin-main-menu').classList.remove('hidden');
    document.getElementById('admin-detail-view').classList.add('hidden');
    document.getElementById('admin-stats-container').style.display = 'none';
}

async function loadAdminTab(tab, btn = null) {
    currentAdminTab = tab; // Lưu tab hiện tại
    const mainMenu = document.getElementById('admin-main-menu');
    const detailView = document.getElementById('admin-detail-view');
    const area = document.getElementById('admin-content-area');
    const statsContainer = document.getElementById('admin-stats-container');

    // Phản hồi ngay lập tức: Chuyển màn hình và hiện trạng thái đang tải
    mainMenu.classList.add('hidden');
    detailView.classList.remove('hidden');
    statsContainer.style.display = 'none';
    area.innerHTML = '<div style="text-align:center; padding:50px; color:var(--text-muted);"><i class="fa-solid fa-circle-notch fa-spin" style="font-size:30px;"></i><p style="margin-top:10px;">Đang tải dữ liệu...</p></div>';

    // Update active nav button (nếu có)
    if (btn) {
        document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    }

    // Xử lý thống kê (Tab stats)
    if (tab === 'stats') {
        if (!adminReportsCache) {
            const res = await apiCall({ action: 'getAllReports' });
            if (res && res.success) adminReportsCache = res;
        }

        if (adminReportsCache && adminReportsCache.stats) {
            const stats = adminReportsCache.stats;
            area.innerHTML = '<h3 class="section-title">Thống kê chi tiết hệ thống</h3>';
            statsContainer.style.display = 'block';
            document.getElementById('adm-stat-total').textContent = `Nhận: ${stats.total.received} | Xử lý: ${stats.total.processed}`;
            document.getElementById('adm-stat-sos').textContent = `Nhận: ${stats.sos.received} | Xử lý: ${stats.sos.processed}`;
            document.getElementById('adm-stat-chat').textContent = `Nhận: ${stats.chat.received} | Xử lý: ${stats.chat.processed}`;
            document.getElementById('adm-stat-anon').textContent = `Nhận: ${stats.anonymous.received} | Xử lý: ${stats.anonymous.processed}`;
        } else {
            area.innerHTML = '<div class="empty-state">Không thể tải dữ liệu thống kê.</div>';
        }
        return;
    }

    // Xử lý các Tab báo cáo (reports, sos, chat)
    if (tab === 'reports' || tab === 'sos' || tab === 'chat') {
        // Nếu chưa có cache hoặc muốn tải mới, gọi API
        if (!adminReportsCache) {
            const res = await apiCall({ action: 'getAllReports' });
            if (res && res.success) adminReportsCache = res;
        }

        if (adminReportsCache && adminReportsCache.success) {
            let filterType = tab === 'reports' ? 'Báo cáo ẩn danh' :
                (tab === 'sos' ? 'SOS Khẩn cấp' : 'Hỏi đáp & Tâm sự');

            const filtered = adminReportsCache.reports.filter(r => r.type === filterType);

            let html = `
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px; border-bottom: 2px solid #eee; padding-bottom:8px;">
                    <h3 class="section-title" style="margin:0;">${filterType}</h3>
                    <button class="btn-refresh" onclick="deleteCategoryAdmin('${filterType}')" style="background: none; border: none; color: var(--c-red); cursor: pointer; font-size: 14px; font-weight: 600;">
                        <i class="fa-solid fa-trash-can"></i> Xóa hết mục này
                    </button>
                </div>
            `;
            if (filtered.length === 0) {
                html += '<div class="empty-state">Không có dữ liệu</div>';
            } else {
                filtered.forEach(r => {
                    const dateStr = new Date(r.time).toLocaleString('vi-VN');
                    const linkHtml = r.fileUrl ? `<a href="${r.fileUrl}" target="_blank" style="margin-bottom:8px; display:inline-block;"><i class="fa-solid fa-link"></i> XEM BẰNG CHỨNG</a><br>` : '';

                    let statusBtnHtml = '';
                    let isNewBadge = (r.status === "Chưa xem" || !r.status) ? `<span style="background:var(--c-yellow); color:black; font-size:9px; padding:2px 5px; border-radius:4px; font-weight:700; margin-left:10px;">MỚI</span>` : '';

                    if (r.status === "Đã xử lý") {
                        statusBtnHtml = `<div style="margin-top:10px; color:var(--c-green); font-weight:600; font-size:12px;"><i class="fa-solid fa-circle-check"></i> Đã xử lý xong</div>`;
                    } else {
                        if (tab === 'chat' || tab === 'sos') {
                            const escapedContent = r.content.replace(/'/g, "\\'").replace(/"/g, '&quot;');
                            statusBtnHtml = `<button class="btn btn-outline" style="padding:8px 12px; font-size:12px; margin-top:8px; width:auto; border-color:var(--primary); color:var(--primary);" onclick="openAdminChatReply(${r.id}, '${escapedContent}')"><i class="fa-solid fa-reply"></i> Đánh dấu & Phản hồi</button>`;
                        } else {
                            statusBtnHtml = `<button class="btn btn-outline" style="padding:8px 12px; font-size:12px; margin-top:8px; width:auto; border-color:var(--primary); color:var(--primary);" onclick="markAsRead(${r.id}, '${tab}')"><i class="fa-solid fa-check"></i> Đánh dấu đã xem & xử lý</button>`;
                        }
                    }

                    html += `
                        <div class="report-item" style="position:relative;">
                            <button class="delete-btn-item" onclick="deleteSingleReport(${r.id}, 'admin')" title="Xóa">
                                <i class="fa-solid fa-trash-can"></i>
                            </button>
                            <span style="font-size:11px; padding:3px 8px; background:var(--primary); color:white; border-radius:10px;">${r.username}</span>
                            ${isNewBadge}
                            <h4 style="margin-top:8px; padding-right:30px;">${r.content}</h4>
                            <p>${r.details}</p>
                            ${linkHtml}
                            <small>${dateStr}</small>
                            ${statusBtnHtml}
                        </div>
                    `;
                });
            }
            area.innerHTML = html;
        } else {
            area.innerHTML = '<div class="empty-state">Lỗi kết nối máy chủ.</div>';
        }
    }
    // Xử lý Tab Tin tức
    else if (tab === 'news') {
        if (!adminNewsCache) {
            const res = await apiCall({ action: 'getNews' });
            if (res && res.success) adminNewsCache = res.news;
        }

        let newsHtml = '';
        if (adminNewsCache) {
            if (adminNewsCache.length === 0) {
                newsHtml = '<div class="empty-state">Chưa có bài viết nào</div>';
            } else {
                adminNewsCache.forEach(n => {
                    const dateStr = new Date(n.time).toLocaleDateString('vi-VN');
                    let contentHtml = n.type === 'Link' || n.type === 'PDF'
                        ? `<a href="${n.content}" target="_blank" style="font-size: 12px; color: var(--c-blue); text-decoration: underline;">Xem liên kết/tài liệu</a>`
                        : `<p style="font-size: 13px; color: var(--text-muted);">${n.content}</p>`;

                    newsHtml += `
                        <div class="report-item" style="position:relative;">
                            <button class="delete-btn-item" onclick="deleteSingleNews(${n.id})" title="Xóa">
                                <i class="fa-solid fa-trash-can"></i>
                            </button>
                            <h4 style="color:var(--primary); padding-right:30px;">${n.title}</h4>
                            <small>${dateStr} | Loại: ${n.type}</small><br>
                            ${contentHtml}
                        </div>
                    `;
                });
            }
        }

        area.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 15px; border-bottom: 2px solid #eee; padding-bottom:10px;">
                <h3 class="section-title" style="margin:0;">Quản lý Tin Tức</h3>
                <div style="display:flex; gap:10px;">
                    <button class="btn btn-outline" style="margin:0; padding: 8px 12px; width:auto; font-size: 12px; border-color:var(--c-red); color:var(--c-red);" onclick="deleteAllNews()">
                        <i class="fa-solid fa-trash-can"></i> Xóa hết
                    </button>
                    <button class="btn btn-primary" style="margin:0; padding: 8px 15px; width:auto; font-size: 13px;" onclick="openModal('admin-news-modal')">
                        <i class="fa-solid fa-plus"></i> Thêm bài viết
                    </button>
                </div>
            </div>
            ${newsHtml}
        `;
    }
}

async function deleteSingleNews(id) {
    customConfirm("Bạn có chắc chắn muốn xóa bài viết này?", async () => {
        showLoader();
        const res = await apiCall({ action: 'deleteNews', id: id });
        if (res && res.success) {
            showToast("Đã xóa bài viết!", "success");
            await refreshAdminCache();
            loadAdminTab('news');
        } else {
            hideLoader();
            showToast("Lỗi khi xóa!", "error");
        }
    });
}

function deleteAllNews() {
    customConfirm("Xác nhận xóa TOÀN BỘ bài viết trên hệ thống?", async () => {
        showLoader();
        const res = await apiCall({ action: 'deleteAllNews' });
        if (res && res.success) {
            showToast("Đã xóa sạch tin tức!", "success");
            await refreshAdminCache();
            loadAdminTab('news');
        } else {
            hideLoader();
            showToast("Lỗi khi xóa!", "error");
        }
    });
}

// Hàm để làm mới dữ liệu cache (gọi sau khi xử lý xong một báo cáo)
async function refreshAdminCache() {
    adminReportsCache = null;
    adminNewsCache = null;
}

function markAsRead(id, currentTab) {
    customConfirm("Xác nhận đánh dấu báo cáo này là đã xem và đã xử lý?", async () => {
        showLoader();
        const res = await apiCall({ action: 'markAsRead', id: id });
        if (res && res.success) {
            showToast("Đã cập nhật trạng thái thành công!", "success");
            await refreshAdminCache(); // Xóa cache để tải lại dữ liệu mới
            loadAdminTab(currentTab);
        } else {
            hideLoader();
            showToast(res && res.message ? res.message : "Lỗi khi cập nhật trạng thái", "error");
        }
    });
}

function openAdminChatReply(id, contentText) {
    document.getElementById('admin-reply-id').value = id;
    document.getElementById('admin-reply-original').textContent = `"${contentText}"`;
    document.getElementById('admin-reply-content').value = '';
    openModal('admin-reply-modal');
}

async function submitAdminReply(e) {
    if (e) e.preventDefault();
    const id = document.getElementById('admin-reply-id').value;
    const replyText = document.getElementById('admin-reply-content').value;

    showLoader();
    const res = await apiCall({ action: 'replyChat', id: id, replyText: replyText });
    hideLoader();

    if (res && res.success) {
        showToast("Đã phản hồi và đánh dấu xử lý!", "success");
        closeModal('admin-reply-modal');
        await refreshAdminCache(); // Xóa cache để tải lại dữ liệu mới nhất
        loadAdminTab(currentAdminTab);
    } else {
        showToast(res && res.message ? res.message : "Lỗi khi gửi phản hồi", "error");
    }
}

async function deleteCategoryAdmin(type) {
    customConfirm(`Bạn có chắc chắn muốn xóa TOÀN BỘ nội dung mục "${type}" trên hệ thống và Google Sheet?`, async () => {
        showLoader();
        const res = await apiCall({ action: 'deleteCategoryReports', type: type });
        if (res && res.success) {
            showToast("Đã dọn dẹp thư mục thành công!", "success");
            await refreshAdminCache();
            loadAdminTab(currentAdminTab);
        } else {
            hideLoader();
            showToast("Lỗi khi xóa dữ liệu!", "error");
        }
    });
}

// --- News Admin & Student Functions ---
function toggleNewsInput() {
    const type = document.getElementById('news-type').value;
    const contentGroup = document.getElementById('news-content-group');
    const fileGroup = document.getElementById('news-file-group');

    if (type === 'PDF') {
        contentGroup.classList.add('hidden');
        fileGroup.classList.remove('hidden');
        document.getElementById('news-content').required = false;
    } else {
        contentGroup.classList.remove('hidden');
        fileGroup.classList.add('hidden');
        document.getElementById('news-content').required = true;
    }
}

function previewNewsFile() {
    const fileInput = document.getElementById('news-file');
    const previewContainer = document.getElementById('news-file-preview-container');
    const fileNameDisplay = document.getElementById('news-file-name');
    const file = fileInput.files[0];

    if (file) {
        if (file.type !== 'application/pdf') {
            showToast("Chỉ chấp nhận file PDF!", "error");
            fileInput.value = '';
            return;
        }
        const reader = new FileReader();
        reader.onload = function (e) {
            currentFileBase64 = e.target.result.split(',')[1];
            currentFileMimeType = file.type;
            currentFileName = file.name;
            previewContainer.classList.remove('hidden');
            fileNameDisplay.textContent = file.name;
        };
        reader.readAsDataURL(file);
    }
}

async function submitNews(e) {
    if (e) e.preventDefault();
    const title = document.getElementById('news-title').value.trim();
    const type = document.getElementById('news-type').value;
    const content = document.getElementById('news-content').value.trim();

    if (!title) return;

    const payload = {
        action: 'addNews',
        title,
        type,
        content
    };

    if (type === 'PDF' && currentFileBase64) {
        payload.fileBase64 = currentFileBase64;
        payload.fileMimeType = currentFileMimeType;
        payload.fileName = currentFileName;
    }

    showLoader();
    const res = await apiCall(payload);
    hideLoader();

    if (res && res.success) {
        showToast("Đăng bài viết thành công!", "success");
        document.getElementById('add-news-form').reset();
        currentFileBase64 = null;
        document.getElementById('news-file-preview-container').classList.add('hidden');
        closeModal('admin-news-modal');
        loadAdminTab('news');
    } else {
        showToast(res ? res.message : "Đã có lỗi xảy ra", "error");
    }
}

let cachedNews = [];

async function loadNewsForStudent() {
    const container = document.getElementById('student-news-container');
    container.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-muted);"><i class="fa-solid fa-spinner fa-spin"></i> Đang tải dữ liệu...</div>';

    const res = await apiCall({ action: 'getNews' });
    if (res && res.success && res.news) {
        cachedNews = res.news;
        renderNews(cachedNews);
    } else {
        container.innerHTML = '<div class="empty-state" style="color:var(--c-red)">Lỗi khi tải dữ liệu</div>';
    }
}

function renderNews(newsList) {
    const container = document.getElementById('student-news-container');
    let html = '';
    if (newsList.length === 0) {
        html = '<div class="empty-state">Chưa có bài viết nào</div>';
    } else {
        newsList.forEach(n => {
            const dateStr = new Date(n.time).toLocaleDateString('vi-VN');
            let contentHtml = '';
            if (n.type === 'Link' || n.type === 'PDF') {
                contentHtml = `<a href="${n.content}" target="_blank" class="btn btn-outline" style="padding: 5px 10px; font-size: 12px; margin-top: 5px; display: inline-block;">Xem chi tiết <i class="fa-solid fa-chevron-right"></i></a>`;
            } else {
                contentHtml = `<p style="font-size: 13px; color: var(--text-muted); margin-top: 5px;">${n.content}</p>`;
            }
            html += `
                <div style="background: rgba(255,255,255,0.05); padding: 15px; border-radius: 12px; margin-bottom: 15px; border: 1px solid rgba(255,255,255,0.1);">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                        <h4 style="color: var(--c-blue); font-size: 15px;">${n.title}</h4>
                        <span style="font-size: 11px; color: var(--text-muted); padding: 2px 5px; background: rgba(0,0,0,0.3); border-radius: 5px;">${n.type}</span>
                    </div>
                    <small style="font-size: 11px; color: var(--text-muted); margin-bottom: 10px; display: block;">${dateStr}</small>
                    ${contentHtml}
                </div>
            `;
        });
    }
    container.innerHTML = html;
}

function searchNews() {
    const term = document.getElementById('search-news').value.toLowerCase();
    if (!term) {
        renderNews(cachedNews);
        return;
    }
    const filtered = cachedNews.filter(n =>
        (n.title && n.title.toLowerCase().includes(term)) ||
        (n.content && n.content.toLowerCase().includes(term)) ||
        (n.type && n.type.toLowerCase().includes(term))
    );
    renderNews(filtered);
}
