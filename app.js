const API_URL = "https://script.google.com/macros/s/AKfycbyMhExH8HCNA-Vb6uPr3jYGCiv1lApnaEFOzSLxtv-tteTdJcOZ4aGg1woIy4Uvpa0/exec";

// ตรวจสอบสถานะตอนโหลดหน้าเว็บ
window.onload = function() {
    const user = JSON.parse(localStorage.getItem('bch_user'));
    if (user) {
        showMenu(user.role);
    } else {
        document.getElementById('loginSection').classList.remove('d-none');
    }
}

// ระบบ Login
function login() {
    const user = document.getElementById('username').value;
    const pass = document.getElementById('password').value;
    
    // ยิง API ไปเช็คที่ GAS
    fetch(`${API_URL}?action=login&username=${user}&password=${pass}`)
        .then(res => res.json())
        .then(data => {
            if (data.status === 'success') {
                localStorage.setItem('bch_user', JSON.stringify({ username: user, role: data.role }));
                showMenu(data.role);
            } else {
                alert('รหัสผ่านไม่ถูกต้อง');
            }
        });
}

function logout() {
    localStorage.removeItem('bch_user');
    location.reload();
}

function showMenu(role) {
    document.getElementById('loginSection').classList.add('d-none');
    document.getElementById('navbar').classList.remove('d-none');
    document.getElementById('menuSection').classList.remove('d-none');
    
    if (role === 'admin') {
        document.getElementById('btnManage').classList.remove('d-none');
    }
}

function showCheckMenu() {
    document.getElementById('menuSection').classList.add('d-none');
    document.getElementById('scanSection').classList.remove('d-none');
    // โค้ดเรียกใช้ html5-qrcode จะเขียนตรงนี้สำหรับการเปิดกล้อง
}

function searchMachine() {
    const id = document.getElementById('machineId').value;
    fetch(`${API_URL}?action=getProduct&id=${id}`)
        .then(res => res.json())
        .then(data => {
            if (data.status === 'success') {
                alert(`พบเครื่อง: ${data.data['ชื่อเครื่อง']} \nเตรียมเปิด Modal เพื่อบันทึก Check...`);
                // TODO: เขียนโค้ดเปิด Bootstrap Modal เลี้ยงข้อมูลลง Form
            } else {
                alert('ไม่พบรหัสเครื่องนี้ในระบบ');
            }
        });
}

function backToMenu() {
    document.getElementById('scanSection').classList.add('d-none');
    document.getElementById('menuSection').classList.remove('d-none');
}
