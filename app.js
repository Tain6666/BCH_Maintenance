const API_URL = "https://script.google.com/macros/s/AKfycbyMhExH8HCNA-Vb6uPr3jYGCiv1lApnaEFOzSLxtv-tteTdJcOZ4aGg1woIy4Uvpa0/exec";

let html5QrCode;
let allProducts = []; 
let currentPartOptions = [];

window.onload = function() {
    const user = JSON.parse(localStorage.getItem('bch_user'));
    if (user) { showMenu(user.role); } 
    else { document.getElementById('loginSection').classList.remove('d-none'); }
}

function login() {
    const user = document.getElementById('username').value;
    const pass = document.getElementById('password').value;
    if(!user || !pass) return Swal.fire('แจ้งเตือน', 'กรุณากรอกข้อมูลให้ครบถ้วน', 'warning');

    Swal.fire({ title: 'กำลังเข้าสู่ระบบ...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    fetch(`${API_URL}?action=login&username=${user}&password=${pass}`)
        .then(res => res.json())
        .then(data => {
            if (data.status === 'success') {
                localStorage.setItem('bch_user', JSON.stringify({ username: user, role: data.role }));
                Swal.fire({ icon: 'success', title: 'สำเร็จ', text: 'ยินดีต้อนรับเข้าสู่ระบบ', timer: 1500, showConfirmButton: false });
                showMenu(data.role);
            } else {
                Swal.fire('ผิดพลาด', 'ชื่อผู้ใช้ หรือ รหัสผ่าน ไม่ถูกต้อง', 'error');
            }
        });
}

function logout() {
    Swal.fire({ title: 'ยืนยันการออกจากระบบ?', icon: 'question', showCancelButton: true, confirmButtonText: 'ตกลง', cancelButtonText: 'ยกเลิก' })
    .then((result) => {
        if (result.isConfirmed) { localStorage.removeItem('bch_user'); location.reload(); }
    });
}

function showMenu(role) {
    document.getElementById('loginSection').classList.add('d-none');
    document.getElementById('scanSection').classList.add('d-none');
    document.getElementById('manageSection').classList.add('d-none');
    document.getElementById('navbar').classList.remove('d-none');
    document.getElementById('menuSection').classList.remove('d-none');
    if (role === 'admin') { document.getElementById('btnManage').classList.remove('d-none'); }
}

function showCheckMenu() {
    document.getElementById('menuSection').classList.add('d-none');
    document.getElementById('scanSection').classList.remove('d-none');
}

function backToMenu() {
    if(html5QrCode) { html5QrCode.stop().catch(() => {}); html5QrCode = null; }
    const role = JSON.parse(localStorage.getItem('bch_user')).role;
    showMenu(role);
}

// ---------------- สแกนคิวอาร์โค้ดผ่านมือถือ ----------------
function startScanner() {
    if(html5QrCode) return;
    html5QrCode = new Html5Qrcode("reader");
    html5QrCode.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
            html5QrCode.stop().then(() => { html5QrCode = null; });
            document.getElementById('machineId').value = decodedText;
            Swal.fire('สำเร็จ', `สแกนพบรหัสเครื่อง: ${decodedText}`, 'success');
            searchMachine();
        },
        () => {}
    ).catch(() => Swal.fire('ผิดพลาด', 'ไม่สามารถเข้าถึงกล้องได้', 'error'));
}

// ---------------- ค้นหาเครื่อง & แกะข้อมูลออกมาทำ Checkbox และ อะไหล่ ----------------
function searchMachine() {
    const id = document.getElementById('machineId').value;
    if(!id) return Swal.fire('แจ้งเตือน', 'กรุณากรอกรหัสเครื่อง', 'warning');

    Swal.fire({ title: 'กำลังค้นหา...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    fetch(`${API_URL}?action=getProduct&id=${id}`)
        .then(res => res.json())
        .then(data => {
            Swal.close();
            if (data.status === 'success') {
                const prod = data.data;
                document.getElementById('modalMachineId').value = prod['รหัส'];
                document.getElementById('modalMachineName').innerText = prod['ชื่อเครื่อง'];
                document.getElementById('modalMachineType').innerText = `ประเภท: ${prod['ประเภท']} | ทรัพย์สิน: ${prod['เลขที่ทรัพย์สิน']}`;
                document.getElementById('modalCheckCount').value = (parseInt(prod['ครั้งที่ตรวจ']) || 0) + 1;
                document.getElementById('modalStatus').value = prod['สถานะ'];
                
                if(prod['รูปภาพ(url)']) {
                    const img = document.getElementById('modalMachineImg');
                    img.src = prod['รูปภาพ(url)'];
                    img.classList.remove('d-none');
                }

                // 1. จัดการ รายการตรวจสอบ (แกะจาก {ทำความสะอาด,หยอดน้ำมัน})
                const cbContainer = document.getElementById('dynamicCheckboxes');
                cbContainer.innerHTML = '';
                let checkStr = prod['รายการตรวจสอบ'] || '';
                let checks = checkStr.replace(/[\{\}]/g, '').split(',').map(s => s.trim()).filter(s => s);
                
                checks.forEach((item, idx) => {
                    cbContainer.innerHTML += `
                        <div class="form-check">
                            <input class="form-check-input chk-item" type="checkbox" value="${item}" id="cb_${idx}">
                            <label class="form-check-label" for="cb_${idx}">${item}</label>
                        </div>`;
                });

                // 2. จัดการ รายการอะไหล่ (แกะจาก {(อะไหล่1,300),(อะไหล่2,450)})
                const partSelect = document.getElementById('modalPartsSelect');
                partSelect.innerHTML = '<option value="">-- เลือกอะไหล่ --</option>';
                currentPartOptions = [];
                let partStr = prod['รายการอะไหล่+ราคา'] || '';
                let matches = partStr.match(/\(([^)]+)\)/g);
                if (matches) {
                    matches.forEach(m => {
                        let clean = m.replace(/[\(\)]/g, '');
                        let parts = clean.split(',');
                        if(parts.length >= 2) {
                            let pName = parts[0].trim();
                            let pPrice = parseFloat(parts[1]) || 0;
                            currentPartOptions.push({ name: pName, price: pPrice });
                            partSelect.innerHTML += `<option value="${pName}">${pName} (${pPrice} บาท)</option>`;
                        }
                    });
                }

                // เคลียร์ค่าเก่าวารสารบำรุงรักษา
                document.getElementById('chkChangePart').checked = false;
                document.getElementById('partsSection').classList.add('d-none');
                document.getElementById('modalPrice').value = 0;

                new bootstrap.Modal(document.getElementById('checkModal')).show();
            } else {
                Swal.fire('ไม่พบเครื่อง', 'ไม่พบรหัสเครื่องนี้ในฐานข้อมูล', 'error');
            }
        });
}

function togglePartsSection() {
    const show = document.getElementById('chkChangePart').checked;
    document.getElementById('partsSection').classList.toggle('d-none', !show);
    if(!show) {
        document.getElementById('modalPartsSelect').value = '';
        document.getElementById('modalPrice').value = 0;
    }
}

function updatePartPrice() {
    const selectedPart = document.getElementById('modalPartsSelect').value;
    const partObj = currentPartOptions.find(o => o.name === selectedPart);
    document.getElementById('modalPrice').value = partObj ? partObj.price : 0;
}

function saveCheck() {
    let checkedItems = [];
    document.querySelectorAll('.chk-item:checked').forEach(cb => checkedItems.push(cb.value));
    
    let isChangePart = document.getElementById('chkChangePart').checked;
    let partName = isChangePart ? document.getElementById('modalPartsSelect').value : '';
    let partPrice = isChangePart ? document.getElementById('modalPrice').value : 0;

    if(isChangePart && !partName) return Swal.fire('แจ้งเตือน', 'กรุณาเลือกชิ้นส่วนอะไหล่ที่เปลี่ยน', 'warning');

    const payload = {
        action: 'saveCheck',
        id: document.getElementById('modalMachineId').value,
        type: document.getElementById('modalMachineType').innerText.split(' | ')[0].replace('ประเภท: ', ''),
        status: document.getElementById('modalStatus').value,
        checkDetails: checkedItems.join(', '),
        note: document.getElementById('modalNote').value,
        changedParts: partName,
        price: partPrice,
        checkCount: document.getElementById('modalCheckCount').value,
        checkDate: new Date().toLocaleDateString('en-GB')
    };

    Swal.fire({ title: 'กำลังบันทึกข้อมูล...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    fetch(API_URL, { method: 'POST', body: JSON.stringify(payload) })
    .then(res => res.json())
    .then(data => {
        if(data.status === 'success') {
            Swal.fire({ icon: 'success', title: 'สำเร็จ', text: 'บันทึกการตรวจสอบเรียบร้อยแล้ว', timer: 1500 });
            bootstrap.Modal.getInstance(document.getElementById('checkModal')).hide();
            document.getElementById('machineId').value = '';
        } else {
            Swal.fire('ผิดพลาด', 'บันทึกล้มเหลว', 'error');
        }
    });
}

// ---------------- จัดการเครื่องหลังบ้าน (Admin Panel) ----------------
function showManageMenu() {
    document.getElementById('menuSection').classList.add('d-none');
    document.getElementById('manageSection').classList.remove('d-none');
    loadAllProducts();
}

function loadAllProducts() {
    Swal.fire({ title: 'กำลังโหลดรายการทั้งหมด...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    fetch(`${API_URL}?action=getAllProducts`)
        .then(res => res.json())
        .then(data => {
            Swal.close();
            if (data.status === 'success') {
                allProducts = data.data;
                
                // สร้างตัวเลือกใน Filter ประเภทแบบไดนามิก
                const typeFilter = document.getElementById('filterType');
                const uniqueTypes = [...new Set(allProducts.map(p => p['ประเภท']).filter(t => t))];
                typeFilter.innerHTML = '<option value="">-- ทุกประเภท --</option>';
                uniqueTypes.forEach(t => typeFilter.innerHTML += `<option value="${t}">${t}</option>`);

                renderTable(allProducts);
            }
        });
}

function renderTable(products) {
    const tbody = document.getElementById('machineTableBody');
    tbody.innerHTML = '';
    products.forEach(item => {
        let badgeColor = item['สถานะ'] === 'ปกติ' ? 'bg-success' : (item['สถานะ'] === 'รอเปลี่ยนอะไหล่' ? 'bg-warning text-dark' : 'bg-danger');
        tbody.innerHTML += `
            <tr>
                <td class="fw-bold">${item['รหัส']}</td>
                <td>${item['ชื่อเครื่อง']}</td>
                <td>${item['ประเภท']}</td>
                <td><span class="badge ${badgeColor}">${item['สถานะ']}</span></td>
                <td>${item['...ครั้งที่ตรวจ'] || item['วันที่ตรวจล่าสุด'] || '-'}</td>
                <td class="text-center">
                    <button class="btn btn-sm btn-outline-primary" onclick='openProductModal(${JSON.stringify(item)})'>แก้ไข</button>
                </td>
            </tr>`;
    });
}

// ---------------- ค้นหาและคัดกรอง (Filters) ----------------
function filterMachines() {
    const searchVal = document.getElementById('filterSearch').value.toLowerCase();
    const typeVal = document.getElementById('filterType').value;
    const statusVal = document.getElementById('filterStatus').value;
    const monthVal = document.getElementById('filterMonth').value;

    const filtered = allProducts.filter(p => {
        const matchesSearch = p['รหัส'].toLowerCase().includes(searchVal) || p['ชื่อเครื่อง'].toLowerCase().includes(searchVal);
        const matchesType = !typeVal || p['ประเภท'] === typeVal;
        const matchesStatus = !statusVal || p['สถานะ'] === statusVal;
        
        let matchesMonth = true;
        if(monthVal && p['วันที่ตรวจล่าสุด']) {
            // วันที่จัดเก็บในรูปแบบ DD/MM/YYYY ดึงเลขเดือนหลักที่ 4-5
            const parts = p['วันที่ตรวจล่าสุด'].split('/');
            if(parts.length === 3) { matchesMonth = parts[1] === monthVal; } 
            else { matchesMonth = false; }
        } else if (monthVal) { matchesMonth = false; }

        return matchesSearch && matchesType && matchesStatus && matchesMonth;
    });

    renderTable(filtered);
}

// ---------------- เปิดหน้าต่างเพิ่ม/แก้ไขเครื่อง ----------------
let isEditMode = false;
function openProductModal(prod) {
    if(prod) {
        isEditMode = true;
        document.getElementById('productModalTitle').innerText = "⚙️ แก้ไขข้อมูลเครื่อง";
        document.getElementById('pId').value = prod['รหัส'];
        document.getElementById('pId').readOnly = true;
        document.getElementById('pImg').value = prod['รูปภาพ(url)'];
        document.getElementById('pAssetNo').value = prod['เลขที่ทรัพย์สิน'];
        document.getElementById('pType').value = prod['ประเภท'];
        document.getElementById('pName').value = prod['ชื่อเครื่อง'];
        document.getElementById('pCheckList').value = (prod['รายการตรวจสอบ'] || '').replace(/[\{\}]/g, '');
        document.getElementById('pPartsList').value = prod['รายการอะไหล่+ราคา'];
        document.getElementById('pStatus').value = prod['สถานะ'];
        document.getElementById('pCycle').value = prod['รอบเวลาตรวจ'];
    } else {
        isEditMode = false;
        document.getElementById('productModalTitle').innerText = "＋ เพิ่มเครื่องใหม่";
        document.getElementById('pId').value = '';
        document.getElementById('pId').readOnly = false;
        document.getElementById('pImg').value = '';
        document.getElementById('pAssetNo').value = '';
        document.getElementById('pType').value = '';
        document.getElementById('pName').value = '';
        document.getElementById('pCheckList').value = 'ทำความสะอาด,เปลี่ยนอะไหล่,หยอดน้ำมัน,ล้าง filter';
        document.getElementById('pPartsList').value = '{(อะไหล่1,300),(อะไหล่2,450)}';
        document.getElementById('pStatus').value = 'ปกติ';
        document.getElementById('pCycle').value = 'm6';
    }
    new bootstrap.Modal(document.getElementById('productModal')).show();
}

function saveProduct() {
    const id = document.getElementById('pId').value.trim();
    if(!id) return Swal.fire('คำเตือน', 'กรุณาระบุรหัสเครื่อง', 'warning');

    const payload = {
        action: isEditMode ? 'editProduct' : 'addProduct',
        id: id,
        img: document.getElementById('pImg').value,
        assetNo: document.getElementById('pAssetNo').value,
        type: document.getElementById('pType').value,
        name: document.getElementById('pName').value,
        checkList: `{${document.getElementById('pCheckList').value}}`,
        partsList: document.getElementById('pPartsList').value,
        status: document.getElementById('pStatus').value,
        cycle: document.getElementById('pCycle').value
    };

    Swal.fire({ title: 'กำลังบันทึกข้อมูลเครื่อง...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    fetch(API_URL, { method: 'POST', body: JSON.stringify(payload) })
    .then(res => res.json())
    .then(data => {
        if(data.status === 'success') {
            Swal.fire({ icon: 'success', title: 'สำเร็จ', text: 'บันทึกข้อมูลเครื่องเรียบร้อยแล้ว', timer: 1500 });
            bootstrap.Modal.getInstance(document.getElementById('productModal')).hide();
            loadAllProducts(); // โหลดตารางใหม่
        } else {
            Swal.fire('ข้อผิดพลาด', data.message || 'ไม่สามารถทำการบันทึกได้', 'error');
        }
    });
}
