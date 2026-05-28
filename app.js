const API_URL = "https://script.google.com/macros/s/AKfycbyMhExH8HCNA-Vb6uPr3jYGCiv1lApnaEFOzSLxtv-tteTdJcOZ4aGg1woIy4Uvpa0/exec";
let html5QrCode; // ตัวแปรสำหรับกล้อง

window.onload = function() {
    const user = JSON.parse(localStorage.getItem('bch_user'));
    if (user) {
        showMenu(user.role);
    } else {
        document.getElementById('loginSection').classList.remove('d-none');
    }
}

function login() {
    const user = document.getElementById('username').value;
    const pass = document.getElementById('password').value;
    
    if(!user || !pass) return Swal.fire('แจ้งเตือน', 'กรุณากรอกข้อมูลให้ครบถ้วน', 'warning');

    Swal.fire({ title: 'กำลังเข้าสู่ระบบ...', allowOutsideClick: false, didOpen: () => { Swal.showLoading() } });

    fetch(`${API_URL}?action=login&username=${user}&password=${pass}`)
        .then(res => res.json())
        .then(data => {
            if (data.status === 'success') {
                localStorage.setItem('bch_user', JSON.stringify({ username: user, role: data.role }));
                Swal.fire({ icon: 'success', title: 'สำเร็จ', text: 'ยินดีต้อนรับเข้าสู่ระบบ', timer: 1500, showConfirmButton: false });
                showMenu(data.role);
            } else {
                Swal.fire({ icon: 'error', title: 'ผิดพลาด', text: 'ชื่อผู้ใช้ หรือ รหัสผ่าน ไม่ถูกต้อง' });
            }
        });
}

function logout() {
    Swal.fire({
        title: 'ยืนยันการออกจากระบบ?',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'ออกจากระบบ',
        cancelButtonText: 'ยกเลิก'
    }).then((result) => {
        if (result.isConfirmed) {
            localStorage.removeItem('bch_user');
            location.reload();
        }
    });
}

function showMenu(role) {
    document.getElementById('loginSection').classList.add('d-none');
    document.getElementById('scanSection').classList.add('d-none');
    document.getElementById('manageSection').classList.add('d-none');
    
    document.getElementById('navbar').classList.remove('d-none');
    document.getElementById('menuSection').classList.remove('d-none');
    
    if (role === 'admin') {
        document.getElementById('btnManage').classList.remove('d-none');
    }
}

function showCheckMenu() {
    document.getElementById('menuSection').classList.add('d-none');
    document.getElementById('scanSection').classList.remove('d-none');
}

function backToMenu() {
    if(html5QrCode) { html5QrCode.stop().catch(err => console.log(err)); } // ปิดกล้องถ้าเปิดอยู่
    const role = JSON.parse(localStorage.getItem('bch_user')).role;
    showMenu(role);
}

// ---------------- ส่วนของ QR Code ----------------
function startScanner() {
    if(html5QrCode) { return; } // กันกดซ้ำ
    html5QrCode = new Html5Qrcode("reader");
    html5QrCode.start(
        { facingMode: "environment" }, // ใช้กล้องหลัง
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
            // เมื่อสแกนสำเร็จ
            html5QrCode.stop().then(() => { html5QrCode = null; });
            document.getElementById('machineId').value = decodedText;
            Swal.fire('สแกนสำเร็จ', `รหัส: ${decodedText}`, 'success');
            searchMachine();
        },
        (errorMessage) => { /* ignore frame errors */ }
    ).catch(err => {
        Swal.fire('ผิดพลาด', 'ไม่สามารถเข้าถึงกล้องได้ กรุณาตรวจสอบสิทธิ์', 'error');
    });
}

// ---------------- ส่วนของการค้นหาและเปิด Modal ----------------
function searchMachine() {
    const id = document.getElementById('machineId').value;
    if(!id) return Swal.fire('แจ้งเตือน', 'กรุณากรอกรหัสเครื่อง', 'warning');

    Swal.fire({ title: 'กำลังค้นหา...', allowOutsideClick: false, didOpen: () => { Swal.showLoading() } });

    fetch(`${API_URL}?action=getProduct&id=${id}`)
        .then(res => res.json())
        .then(data => {
            if (data.status === 'success') {
                Swal.close();
                // ยัดข้อมูลลง Modal
                document.getElementById('modalMachineId').value = data.data['รหัส'];
                document.getElementById('modalMachineName').innerText = data.data['ชื่อเครื่อง'];
                document.getElementById('modalMachineType').innerText = `ประเภท: ${data.data['ประเภท']} | รหัสทรัพย์สิน: ${data.data['เลขที่ทรัพย์สิน']}`;
                document.getElementById('modalCheckCount').value = (parseInt(data.data['ครั้งที่ตรวจ']) || 0) + 1;
                
                // เปิด Modal
                var myModal = new bootstrap.Modal(document.getElementById('checkModal'));
                myModal.show();
            } else {
                Swal.fire('ไม่พบข้อมูล', 'ไม่มีรหัสเครื่องนี้ในระบบ', 'error');
            }
        });
}

// ---------------- ส่วนของการบันทึกข้อมูล Check ----------------
function saveCheck() {
    const payload = {
        action: 'saveCheck',
        id: document.getElementById('modalMachineId').value,
        type: document.getElementById('modalMachineType').innerText.split(' | ')[0].replace('ประเภท: ', ''),
        status: document.getElementById('modalStatus').value,
        checkDetails: document.getElementById('modalCheckDetails').value,
        note: document.getElementById('modalNote').value,
        changedParts: document.getElementById('modalParts').value,
        price: document.getElementById('modalPrice').value,
        checkCount: document.getElementById('modalCheckCount').value,
        checkDate: new Date().toLocaleDateString('en-GB') // รูปแบบ DD/MM/YYYY
    };

    Swal.fire({ title: 'กำลังบันทึก...', allowOutsideClick: false, didOpen: () => { Swal.showLoading() } });

    fetch(API_URL, {
        method: 'POST',
        body: JSON.stringify(payload)
    }).then(res => res.json())
    .then(data => {
        if(data.status === 'success') {
            Swal.fire('สำเร็จ!', 'บันทึกการตรวจสอบเรียบร้อยแล้ว', 'success');
            bootstrap.Modal.getInstance(document.getElementById('checkModal')).hide();
            // เคลียร์ค่า
            document.getElementById('modalCheckDetails').value = '';
            document.getElementById('modalParts').value = '';
            document.getElementById('modalPrice').value = '0';
            document.getElementById('modalNote').value = '';
            document.getElementById('machineId').value = '';
        } else {
            Swal.fire('ผิดพลาด', 'ไม่สามารถบันทึกข้อมูลได้', 'error');
        }
    });
}

// ---------------- ส่วนของการจัดการเครื่อง (Admin) ----------------
function showManageMenu() {
    document.getElementById('menuSection').classList.add('d-none');
    document.getElementById('manageSection').classList.remove('d-none');
    
    Swal.fire({ title: 'กำลังโหลดข้อมูล...', allowOutsideClick: false, didOpen: () => { Swal.showLoading() } });

    fetch(`${API_URL}?action=getAllProducts`)
        .then(res => res.json())
        .then(data => {
            Swal.close();
            if (data.status === 'success') {
                const tbody = document.getElementById('machineTableBody');
                tbody.innerHTML = '';
                data.data.forEach(item => {
                    let statusColor = item['สถานะ'] === 'ปกติ' ? 'text-success' : 'text-danger';
                    tbody.innerHTML += `
                        <tr>
                            <td>${item['รหัส']}</td>
                            <td>${item['ชื่อเครื่อง']}</td>
                            <td class="${statusColor} fw-bold">${item['สถานะ']}</td>
                            <td>${item['วันที่ตรวจล่าสุด'] ? new Date(item['วันที่ตรวจล่าสุด']).toLocaleDateString('en-GB') : '-'}</td>
                        </tr>
                    `;
                });
            }
        });
}
