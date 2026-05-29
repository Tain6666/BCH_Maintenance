const API_URL = "https://script.google.com/macros/s/AKfycbyMhExH8HCNA-Vb6uPr3jYGCiv1lApnaEFOzSLxtv-tteTdJcOZ4aGg1woIy4Uvpa0/exec";
let html5QrCode;
let allProducts = [];        // เก็บข้อมูลดิบทั้งหมดจากเบส
let filteredProducts = [];   // เก็บข้อมูลที่ผ่านการกรองแล้วเพื่อนำไปทำคิวแบ่งหน้า
let currentPage = 1;         // หน้าปัจจุบันที่กำลังดูอยู่
const itemsPerPage = 50;     // จำกัดให้แสดงหน้าละ 50 รายการ

window.onload = function() {
    const user = JSON.parse(localStorage.getItem('bch_user'));
    if (user) showMenu(user.role); 
    else document.getElementById('loginSection').classList.remove('d-none');
}

function login() {
    const user = document.getElementById('username').value;
    const pass = document.getElementById('password').value;
    if(!user || !pass) return;

    Swal.fire({ title: 'กำลังเข้าสู่ระบบ...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    fetch(`${API_URL}?action=login&username=${user}&password=${pass}`)
        .then(res => res.json())
        .then(data => {
            if (data.status === 'success') {
                localStorage.setItem('bch_user', JSON.stringify({ username: user, role: data.role }));
                Swal.close(); showMenu(data.role);
            } else Swal.fire('ผิดพลาด', 'เข้าสู่ระบบไม่สำเร็จ', 'error');
        });
}

function logout() { localStorage.removeItem('bch_user'); location.reload(); }

function showMenu(role) {
    document.getElementById('loginSection').classList.add('d-none');
    document.getElementById('scanSection').classList.add('d-none');
    document.getElementById('manageSection').classList.add('d-none');
    document.getElementById('dashboardSection').classList.add('d-none'); // เพิ่มบรรทัดนี้
    document.getElementById('navbar').classList.remove('d-none');
    document.getElementById('menuSection').classList.remove('d-none');
    if (role === 'admin') { 
        document.getElementById('btnManage').classList.remove('d-none'); 
        document.getElementById('btnDashboard').classList.remove('d-none'); // เพิ่มบรรทัดนี้
    }
}

function showCheckMenu() {
    document.getElementById('menuSection').classList.add('d-none');
    document.getElementById('scanSection').classList.remove('d-none');
}
function backToMenu() {
    if(html5QrCode) { html5QrCode.stop().catch(()=>{}); html5QrCode = null; }
    showMenu(JSON.parse(localStorage.getItem('bch_user')).role);
}

function startScanner() {
    if(html5QrCode) return;
    html5QrCode = new Html5Qrcode("reader");
    html5QrCode.start({ facingMode: "environment" }, { fps: 10, qrbox: 250 }, 
        (text) => { html5QrCode.stop(); document.getElementById('machineId').value = text; searchMachine(); }, 
        (err) => {}
    );
}

function calculateAge(dateStr) {
    if (!dateStr || dateStr === '-') return '-';
    let parts = dateStr.split('/');
    if (parts.length !== 3) return '-';
    
    let start = new Date(parts[2], parts[1] - 1, parts[0]);
    let now = new Date();
    if(isNaN(start)) return '-';
    
    let years = now.getFullYear() - start.getFullYear();
    let months = now.getMonth() - start.getMonth();
    let days = now.getDate() - start.getDate();

    if (days < 0) {
        months--;
        let prevMonth = new Date(now.getFullYear(), now.getMonth(), 0);
        days += prevMonth.getDate();
    }
    if (months < 0) {
        years--;
        months += 12;
    }

    let age = [];
    if (years > 0) age.push(`${years} ปี`);
    if (months > 0) age.push(`${months} เดือน`);
    if (days > 0) age.push(`${days} วัน`);
    
    return age.length > 0 ? age.join(' ') : 'เริ่มใช้งานวันนี้';
}

function searchMachine() {
    const id = document.getElementById('machineId').value;
    if(!id) return;
    Swal.fire({ title: 'กำลังค้นหา...', didOpen: () => Swal.showLoading() });

    fetch(`${API_URL}?action=getProduct&id=${id}`)
        .then(res => res.json())
        .then(data => {
            Swal.close();
            if (data.status === 'success') {
                const p = data.data;
                document.getElementById('modalMachineId').value = p['รหัส'];
                document.getElementById('modalMachineName').innerText = p['ชื่อเครื่อง'];
                document.getElementById('modalMachineType').innerText = `ประเภท: ${p['ประเภท']}`;
                document.getElementById('modalCheckCount').value = (parseInt(p['ครั้งที่ตรวจ']) || 0) + 1;
                document.getElementById('modalStatus').value = p['สถานะ'];
                
                document.getElementById('modalStartDate').innerText = p['วันที่เริ่มใช้'] || '-';
                document.getElementById('modalAge').innerText = calculateAge(p['วันที่เริ่มใช้']);
                document.getElementById('modalLastCheck').innerText = p['วันที่ตรวจล่าสุด'] || '-';
                
                const img = document.getElementById('modalMachineImg');
                if(p['รูปภาพ(url)']) { img.src = p['รูปภาพ(url)']; img.classList.remove('d-none'); }
                else { img.classList.add('d-none'); }

                const cbContainer = document.getElementById('dynamicCheckboxes');
                cbContainer.innerHTML = '';
                (p['รายการตรวจสอบ'] || '').replace(/[\{\}]/g, '').split(',').forEach((item, i) => {
                    if(item.trim()) cbContainer.innerHTML += `<div class="form-check"><input class="form-check-input chk-item" type="checkbox" value="${item.trim()}" id="cb_${i}"><label class="form-check-label" for="cb_${i}">${item.trim()}</label></div>`;
                });

                currentMachineParts = [];
                let partStr = p['รายการอะไหล่และราคา'] || p['รายการอะไหล่+ราคา'] || '';
                let matches = partStr.match(/\(([^)]+)\)/g);
                if (matches) {
                    matches.forEach(m => {
                        let parts = m.replace(/[\(\)]/g, '').split(',');
                        if(parts.length >= 2) currentMachineParts.push({ name: parts[0].trim(), price: parseFloat(parts[1]) || 0 });
                    });
                }
                renderPartsCheckboxes();
                document.getElementById('chkChangePart').checked = false;
                togglePartsSection();
                new bootstrap.Modal(document.getElementById('checkModal')).show();
            } else Swal.fire('ไม่พบเครื่อง', '', 'error');
        });
}

function renderPartsCheckboxes() {
    const container = document.getElementById('partCheckboxes');
    container.innerHTML = '';
    currentMachineParts.forEach((p, i) => {
        container.innerHTML += `<div class="form-check"><input class="form-check-input part-chk" type="checkbox" value="${i}" id="pchk_${i}" onchange="calculateTotalPrice()"><label class="form-check-label" for="pchk_${i}">${p.name} (${p.price} บาท)</label></div>`;
    });
    calculateTotalPrice();
}

function addNewPartToUI() {
    const name = document.getElementById('newPartName').value.trim();
    const price = parseFloat(document.getElementById('newPartPrice').value) || 0;
    if(!name) return;
    currentMachineParts.push({ name, price });
    document.getElementById('newPartName').value = '';
    document.getElementById('newPartPrice').value = '';
    renderPartsCheckboxes();
    document.getElementById(`pchk_${currentMachineParts.length-1}`).checked = true;
    calculateTotalPrice();
}

function togglePartsSection() {
    const show = document.getElementById('chkChangePart').checked;
    document.getElementById('partsSection').classList.toggle('d-none', !show);
    if(!show) { document.querySelectorAll('.part-chk').forEach(c => c.checked = false); calculateTotalPrice(); }
}

function calculateTotalPrice() {
    let total = 0;
    document.querySelectorAll('.part-chk:checked').forEach(c => { total += currentMachineParts[c.value].price; });
    document.getElementById('totalPartsPrice').innerText = total;
}

function saveCheck() {
    let checkedItems = [...document.querySelectorAll('.chk-item:checked')].map(cb => cb.value);
    let isChangePart = document.getElementById('chkChangePart').checked;
    
    let changedPartsNames = [];
    let totalPrice = 0;
    if(isChangePart) {
        document.querySelectorAll('.part-chk:checked').forEach(c => {
            let p = currentMachineParts[c.value];
            changedPartsNames.push(p.name);
            totalPrice += p.price;
        });
    }

    let updatedPartsStr = isChangePart ? '{' + currentMachineParts.map(p => `(${p.name},${p.price})`).join(',') + '}' : null;

    const payload = {
        action: 'saveCheck',
        id: document.getElementById('modalMachineId').value,
        type: document.getElementById('modalMachineType').innerText.split(' | ')[0].replace('ประเภท: ', ''),
        status: document.getElementById('modalStatus').value,
        checkDetails: checkedItems.join(', '),
        note: document.getElementById('modalNote').value,
        changedParts: changedPartsNames.join(', '),
        price: totalPrice,
        checkCount: document.getElementById('modalCheckCount').value,
        checkDate: new Date().toLocaleDateString('en-GB'),
        updatedPartsStr: updatedPartsStr
    };

    Swal.fire({ title: 'กำลังบันทึก...', didOpen: () => Swal.showLoading() });
    fetch(API_URL, { method: 'POST', body: JSON.stringify(payload) })
    .then(res => res.json())
    .then(data => {
        if(data.status === 'success') {
            Swal.fire('สำเร็จ', '', 'success');
            bootstrap.Modal.getInstance(document.getElementById('checkModal')).hide();
        } else Swal.fire('ผิดพลาด', '', 'error');
    });
}

// ---------------- Admin Section (เพิ่มระบบแบ่งหน้า) ----------------
function showManageMenu() {
    document.getElementById('menuSection').classList.add('d-none');
    document.getElementById('manageSection').classList.remove('d-none');
    loadAllProducts();
}

function loadAllProducts() {
    Swal.fire({ title: 'กำลังโหลด...', didOpen: () => Swal.showLoading() });
    fetch(`${API_URL}?action=getAllProducts`)
        .then(res => res.json())
        .then(data => {
            Swal.close();
            if (data.status === 'success') {
                allProducts = data.data;
                filteredProducts = [...allProducts]; // ค่าเริ่มต้นให้ตัวแปรคัดกรองมีค่าเท่ากับข้อมูลดิบหมด
                currentPage = 1;                     // รีเซ็ตหน้ากลับไปหน้าแรกสุด
                
                const typeFilter = document.getElementById('filterType');
                typeFilter.innerHTML = '<option value="">-- ทุกประเภท --</option>';
                [...new Set(allProducts.map(p => p['ประเภท']).filter(t => t))].forEach(t => typeFilter.innerHTML += `<option value="${t}">${t}</option>`);
                
                renderTable();
                renderPagination();
            }
        });
}

// ปรับปรุงการวาดตารางให้อ่านช่วงข้อมูลแบบแบ่งหน้า (.slice)
function renderTable() {
    const tbody = document.getElementById('machineTableBody');
    tbody.innerHTML = '';
    
    // คำนวณช่วงดัชนีข้อมูลของหน้าปัจจุบัน (เช่น หน้า 1 คัทตั้งแต่ตัวที่ 0 ถึง 50)
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const pageItems = filteredProducts.slice(start, end);
    
    if (pageItems.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-muted py-4">ไม่พบข้อมูลเครื่องตามเงื่อนไขที่เลือก</td></tr>';
        document.getElementById('paginationInfo').innerText = "แสดง 0 ถึง 0 จาก 0 รายการ";
        return;
    }

    pageItems.forEach(item => {
        let badgeColor = item['สถานะ'] === 'ปกติ' ? 'bg-success' : 'bg-danger';
        tbody.innerHTML += `
            <tr class="clickable-row" onclick='openProductModal(${JSON.stringify(item)})'>
                <td class="fw-bold">${item['รหัส']}</td>
                <td>${item['ชื่อเครื่อง']}</td>
                <td>${item['ประเภท']}</td>
                <td><span class="badge ${badgeColor}">${item['สถานะ']}</span></td>
                <td>${item['...ครั้งที่ตรวจ'] || item['วันที่ตรวจล่าสุด'] || '-'}</td>
            </tr>`;
    });

    // อัปเดตกล่องข้อความบอกตำแหน่งของช่วงรายการที่กำลังมองดูอยู่
    const total = filteredProducts.length;
    const displayStart = start + 1;
    const displayEnd = end > total ? total : end;
    document.getElementById('paginationInfo').innerText = `แสดง ${displayStart} ถึง ${displayEnd} จากทั้งหมด ${total} รายการ`;
}

// ฟังก์ชันสำหรับสร้างและคำนวณปุ่มเลขหน้าเปลี่ยนหน้าเว็บแบบ Dynamic
function renderPagination() {
    const controls = document.getElementById('paginationControls');
    controls.innerHTML = '';
    
    const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
    if (totalPages <= 1) return; // ถ้าข้อมูลมีน้อยกว่า 50 รายการ (มีแค่ 1 หน้า) ไม่ต้องแสดงปุ่มเลขหน้าเลย

    // ปุ่ม "ก่อนหน้า"
    controls.innerHTML += `
        <li class="page-item ${currentPage === 1 ? 'disabled' : ''}">
            <button class="page-link" onclick="changePage(${currentPage - 1})">ก่อนหน้า</button>
        </li>`;
    
    // จำกัดการแสดงเลขปุ่มในหน้าจอโทรศัพท์ให้เห็นแค่ช่วงแคบๆ รอบหน้าปัจจุบัน
    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, currentPage + 2);
    
    for (let i = startPage; i <= endPage; i++) {
        controls.innerHTML += `
            <li class="page-item ${currentPage === i ? 'active' : ''}">
                <button class="page-link" onclick="changePage(${i})">${i}</button>
            </li>`;
    }
    
    // ปุ่ม "ถัดไป"
    controls.innerHTML += `
        <li class="page-item ${currentPage === totalPages ? 'disabled' : ''}">
            <button class="page-link" onclick="changePage(${currentPage + 1})">ถัดไป</button>
        </li>`;
}

function changePage(page) {
    const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
    if (page < 1 || page > totalPages) return;
    currentPage = page;
    renderTable();
    renderPagination();
}

function filterMachines() {
    const s = document.getElementById('filterSearch').value.toLowerCase();
    const t = document.getElementById('filterType').value;
    const st = document.getElementById('filterStatus').value;
    const m = document.getElementById('filterMonth').value;

    filteredProducts = allProducts.filter(p => {
        const mSearch = p['รหัส'].toLowerCase().includes(s) || p['ชื่อเครื่อง'].toLowerCase().includes(s);
        const mType = !t || p['ประเภท'] === t;
        const mStatus = !st || p['สถานะ'] === st;
        
        let mMonth = true;
        // ถ้ามีการเลือกเดือนใน Dropdown (ตัวแปร m ไม่ใช่ค่าว่าง)
        if (m) {
            if (p['วันที่ตรวจล่าสุด'] && p['วันที่ตรวจล่าสุด'] !== '-') {
                let dateStr = String(p['วันที่ตรวจล่าสุด']).trim();
                let extractMonth = "";
                
                // ตรวจสอบว่าวันที่ใช้เครื่องหมายอะไรคั่น
                if (dateStr.includes('/')) {
                    // กรณีรูปแบบ DD/MM/YYYY (เช่น 28/5/2026 หรือ 28/05/2026)
                    let parts = dateStr.split('/');
                    if (parts.length >= 2) extractMonth = parts[1].padStart(2, '0'); 
                } else if (dateStr.includes('-')) {
                    // กรณีรูปแบบ YYYY-MM-DD (เช่น 2026-05-28)
                    let parts = dateStr.split('-');
                    if (parts.length >= 2) extractMonth = parts[1].padStart(2, '0');
                }
                
                // นำเดือนที่สกัดได้ มาเทียบกับค่าใน Dropdown
                mMonth = (extractMonth === m);
            } else {
                // ถ้าเลือกเดือน แต่เครื่องนี้ยังไม่มีประวัติการตรวจ ให้ซ่อนไว้
                mMonth = false;
            }
        }
        
        return mSearch && mType && mStatus && mMonth;
    });
    
    currentPage = 1; // รีเซ็ตกลับไปหน้า 1 เสมอเมื่อมีการ Filter
    renderTable();
    renderPagination();
}

function addEditCheckItem(val = '') {
    const div = document.createElement('div');
    div.className = 'input-group mb-2';
    div.innerHTML = `
        <input type="text" class="form-control edit-chk-input" value="${val}" placeholder="เช่น ทำความสะอาด">
        <button class="btn btn-outline-danger" tabindex="-1" onclick="this.parentElement.remove()">ลบ</button>
    `;
    document.getElementById('editCheckListContainer').appendChild(div);
}

function addEditPartItem(name = '', price = '') {
    const div = document.createElement('div');
    div.className = 'input-group mb-2';
    div.innerHTML = `
        <input type="text" class="form-control edit-pt-name" value="${name}" placeholder="ชื่ออะไหล่">
        <input type="number" class="form-control edit-pt-price" value="${price}" placeholder="ราคา">
        <button class="btn btn-outline-danger" tabindex="-1" onclick="this.parentElement.remove()">ลบ</button>
    `;
    document.getElementById('editPartsContainer').appendChild(div);
}

let isEditMode = false;
function openProductModal(prod) {
    isEditMode = !!prod;
    document.getElementById('productModalTitle').innerText = isEditMode ? "⚙️ แก้ไขข้อมูลเครื่อง" : "＋ เพิ่มเครื่องใหม่";
    document.getElementById('pId').value = prod ? prod['รหัส'] : '';
    document.getElementById('pId').readOnly = isEditMode;
    
    let sDate = '';
    if(prod && prod['วันที่เริ่มใช้']) {
        let dParts = prod['วันที่เริ่มใช้'].split('/');
        if(dParts.length === 3) sDate = `${dParts[2]}-${dParts[1]}-${dParts[0]}`; 
    }
    document.getElementById('pStartDate').value = sDate;
    
    document.getElementById('pAssetNo').value = prod ? prod['เลขที่ทรัพย์สิน'] : '';
    document.getElementById('pType').value = prod ? prod['ประเภท'] : '';
    document.getElementById('pName').value = prod ? prod['ชื่อเครื่อง'] : '';
    document.getElementById('pStatus').value = prod ? prod['สถานะ'] : 'ปกติ';
    
    let cycleStr = prod ? prod['รอบเวลาตรวจ'] : 'm6';
    let cMatch = cycleStr.match(/([a-zA-Z]+)(\d+)/);
    if(cMatch) {
        document.getElementById('pCycleUnit').value = cMatch[1];
        document.getElementById('pCycleNum').value = cMatch[2];
    } else {
        document.getElementById('pCycleUnit').value = 'm';
        document.getElementById('pCycleNum').value = '6';
    }

    document.getElementById('editCheckListContainer').innerHTML = '';
    let chkStr = prod ? (prod['รายการตรวจสอบ']||'').replace(/[\{\}]/g, '') : 'ทำความสะอาด,หยอดน้ำมัน,ล้าง filter';
    let chkArr = chkStr.split(',').map(x => x.trim()).filter(x => x);
    if(chkArr.length === 0) chkArr.push('');
    chkArr.forEach(item => addEditCheckItem(item));

    document.getElementById('editPartsContainer').innerHTML = '';
    let ptStr = prod ? (prod['รายการอะไหล่และราคา']||prod['รายการอะไหล่+ราคา']||'') : '{(อะไหล่1,300),(อะไหล่2,450)}';
    let ptMatches = ptStr.match(/\(([^)]+)\)/g);
    if(ptMatches) {
        ptMatches.forEach(m => {
            let parts = m.replace(/[\(\)]/g, '').split(',');
            if(parts.length >= 2) addEditPartItem(parts[0].trim(), parts[1].trim());
        });
    } else {
        addEditPartItem('', '');
    }

    document.getElementById('pImageFile').value = '';
    document.getElementById('pOldImgUrl').value = prod ? prod['รูปภาพ(url)'] : '';
    const preview = document.getElementById('pImgPreview');
    if(prod && prod['รูปภาพ(url)']) { preview.src = prod['รูปภาพ(url)']; preview.src = prod['รูปภาพ(url)'].startsWith('http://googleusercontent.com') ? prod['รูปภาพ(url)'] : prod['รูปภาพ(url)']; preview.classList.remove('d-none'); }
    else { preview.classList.add('d-none'); }

    new bootstrap.Modal(document.getElementById('productModal')).show();
}

function getBase64Image(file, callback) {
    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 800;
            const scaleSize = MAX_WIDTH / img.width;
            canvas.width = MAX_WIDTH;
            canvas.height = img.height * scaleSize;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            callback(canvas.toDataURL('image/jpeg', 0.7)); 
        }
        img.src = e.target.result;
    }
    reader.readAsDataURL(file);
}

function saveProduct() {
    const id = document.getElementById('pId').value.trim();
    if(!id) return Swal.fire('คำเตือน', 'กรุณาระบุรหัสเครื่อง', 'warning');

    const d = document.getElementById('pStartDate').value;
    const formattedDate = d ? d.split('-').reverse().join('/') : ''; 

    let checks = [];
    document.querySelectorAll('.edit-chk-input').forEach(el => {
        if(el.value.trim()) checks.push(el.value.trim());
    });
    let buildCheckList = `{${checks.join(',')}}`;

    let parts = [];
    const ptNames = document.querySelectorAll('.edit-pt-name');
    const ptPrices = document.querySelectorAll('.edit-pt-price');
    for(let i=0; i<ptNames.length; i++){
        if(ptNames[i].value.trim()){
            parts.push(`(${ptNames[i].value.trim()},${ptPrices[i].value.trim() || 0})`);
        }
    }
    let buildPartsList = `{${parts.join(',')}}`;

    let buildCycle = document.getElementById('pCycleUnit').value + document.getElementById('pCycleNum').value;

    const fileInput = document.getElementById('pImageFile');
    const finalizeSave = (base64) => {
        const payload = {
            action: isEditMode ? 'editProduct' : 'addProduct',
            id: id,
            startDate: formattedDate,
            oldImgUrl: document.getElementById('pOldImgUrl').value,
            imgBase64: base64,
            assetNo: document.getElementById('pAssetNo').value,
            type: document.getElementById('pType').value,
            name: document.getElementById('pName').value,
            checkList: buildCheckList,
            partsList: buildPartsList,
            status: document.getElementById('pStatus').value,
            cycle: buildCycle
        };

        Swal.fire({ title: 'กำลังบันทึกข้อมูล...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        fetch(API_URL, { method: 'POST', body: JSON.stringify(payload) })
        .then(res => res.json())
        .then(data => {
            if(data.status === 'success') {
                Swal.fire('สำเร็จ', '', 'success');
                bootstrap.Modal.getInstance(document.getElementById('productModal')).hide();
                loadAllProducts(); 
            } else Swal.fire('ข้อผิดพลาด', data.message || 'บันทึกไม่ได้', 'error');
        });
    };

    if (fileInput.files.length > 0) getBase64Image(fileInput.files[0], finalizeSave);
    else finalizeSave(null);
}

// ==========================================
// ส่วนของ Dashboard สถิติ (เพิ่มใหม่)
// ==========================================
let dashProducts = [];
let dashChecks = [];
let chart1, chart2, chart3; // ตัวแปรเก็บกราฟเพื่อทำลายก่อนวาดใหม่

function showDashboardMenu() {
    document.getElementById('menuSection').classList.add('d-none');
    document.getElementById('dashboardSection').classList.remove('d-none');
    loadDashboardData();
}

function loadDashboardData() {
    Swal.fire({ title: 'กำลังโหลดข้อมูลสถิติ...', didOpen: () => Swal.showLoading() });
    fetch(`${API_URL}?action=getDashboardData`)
        .then(res => res.json())
        .then(data => {
            Swal.close();
            if (data.status === 'success') {
                dashProducts = data.products;
                dashChecks = data.checks;

                // 1. สร้าง Dropdown ประเภท
                const typeFilter = document.getElementById('dashType');
                typeFilter.innerHTML = '<option value="">-- รวมทุกประเภท --</option>';
                [...new Set(dashProducts.map(p => p['ประเภท']).filter(t => t))].forEach(t => typeFilter.innerHTML += `<option value="${t}">${t}</option>`);

                // 2. สร้าง Dropdown ปีงบประมาณ (ดึงจากประวัติการตรวจ)
                const yearFilter = document.getElementById('dashYear');
                let years = new Set();
                dashChecks.forEach(c => {
                    if (c['วันที่ตรวจสอบ']) {
                        let fy = getFiscalYear(c['วันที่ตรวจสอบ']);
                        if (fy) years.add(fy);
                    }
                });
                let currentFY = getFiscalYear(new Date().toLocaleDateString('en-GB'));
                years.add(currentFY);
                let sortedYears = Array.from(years).sort((a,b) => b-a);
                yearFilter.innerHTML = '';
                sortedYears.forEach(y => yearFilter.innerHTML += `<option value="${y}" ${y === currentFY ? 'selected' : ''}>ปีงบประมาณ ${y}</option>`);

                updateDashboard();
            }
        });
}

// ฟังก์ชันแปลงวันที่ DD/MM/YYYY เป็นปีงบประมาณ (พ.ค. - เม.ย.)
function getFiscalYear(dateStr) {
    if(!dateStr || dateStr === '-') return null;
    let parts = dateStr.split('/');
    if(parts.length !== 3) return null;
    let m = parseInt(parts[1]);
    let y = parseInt(parts[2]);
    // ถ้าเดือน 5 ถึง 12 ถือเป็นปีนั้น, ถ้าเดือน 1 ถึง 4 ถือเป็นปีก่อนหน้า
    return m >= 5 ? y : y - 1;
}

function isOverdue(lastCheckStr, cycleStr) {
    if (!lastCheckStr || String(lastCheckStr).trim() === '' || lastCheckStr === '-') return true;

    let dateStr = String(lastCheckStr).trim().split(' ')[0]; 
    let parts = [];
    
    if (dateStr.includes('/')) {
        parts = dateStr.split('/');
    } else if (dateStr.includes('-')) {
        parts = dateStr.split('-').reverse(); 
    }
    
    if (parts.length !== 3) return false;

    // เพิ่ม parseInt เพื่อป้องกันไม่ให้เบราว์เซอร์บนมือถือมองเป็น Invalid Date
    let lastDate = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
    if (isNaN(lastDate.getTime())) return false; 

    if (!cycleStr) return false;
    let cycleMatch = String(cycleStr).match(/([a-zA-Z]+)(\d+)/);
    if (!cycleMatch) return false;

    let unit = cycleMatch[1].toLowerCase();
    let val = parseInt(cycleMatch[2]);

    let nextDate = new Date(lastDate);
    if (unit === 'd') nextDate.setDate(nextDate.getDate() + val);
    else if (unit === 'm') nextDate.setMonth(nextDate.getMonth() + val);
    else if (unit === 'y') nextDate.setFullYear(nextDate.getFullYear() + val);

    let today = new Date(); 
    today.setHours(0, 0, 0, 0); 
    nextDate.setHours(0, 0, 0, 0);
    
    return nextDate < today;
}

function updateDashboard() {
    const selYear = parseInt(document.getElementById('dashYear').value);
    const selMonth = document.getElementById('dashMonth').value; // '05', '12', '', etc.
    const selType = document.getElementById('dashType').value;

    // --- กรองข้อมูล Products ---
    let fProducts = dashProducts.filter(p => !selType || p['ประเภท'] === selType);

    // คำนวณสรุป Card เครื่อง
    let overdueCount = 0;
    let statusCounts = { 'ปกติ':0, 'ผิดปกติ':0, 'รอเปลี่ยนอะไหล่':0, 'จำหน่ายแล้ว':0, 'ยกเลิก':0 };
    let typeCounts = {};

    fProducts.forEach(p => {
        if(isOverdue(p['วันที่ตรวจล่าสุด'], p['รอบเวลาตรวจ']) && p['สถานะ'] !== 'จำหน่ายแล้ว' && p['สถานะ'] !== 'ยกเลิก') overdueCount++;
        let st = p['สถานะ'] || 'ปกติ';
        if(statusCounts[st] !== undefined) statusCounts[st]++; else statusCounts[st] = 1;
        let t = p['ประเภท'] || 'ไม่ระบุ';
        typeCounts[t] = (typeCounts[t] || 0) + 1;
    });

    document.getElementById('dashTotalMachine').innerText = fProducts.length.toLocaleString();
    document.getElementById('dashOverdue').innerText = overdueCount.toLocaleString();

    // --- กรองข้อมูล Checks ---
    let fChecks = dashChecks.filter(c => {
        if(!c['วันที่ตรวจสอบ']) return false;
        let fy = getFiscalYear(c['วันที่ตรวจสอบ']);
        let month = c['วันที่ตรวจสอบ'].split('/')[1];
        let typeMatch = !selType || c['ประเภท'] === selType;
        let yearMatch = (fy === selYear);
        let monthMatch = !selMonth || (month === selMonth);
        return typeMatch && yearMatch && monthMatch;
    });

    // คำนวณสรุป Card สถิติการตรวจ/ราคา
    let totalCost = 0;
    let costByType = {};
    let checkItemsStats = {};

    fChecks.forEach(c => {
        let cost = parseFloat(c['ราคา']) || 0;
        totalCost += cost;
        let t = c['ประเภท'] || 'ไม่ระบุ';
        costByType[t] = (costByType[t] || 0) + cost;

        // แกะรายละเอียดสิ่งที่ตรวจ (คั่นด้วยคอมมา)
        let details = c['รายละเอียดตรวจสอบ'] ? c['รายละเอียดตรวจสอบ'].split(',') : [];
        details.forEach(item => {
            let cleanItem = item.trim();
            if(cleanItem) checkItemsStats[cleanItem] = (checkItemsStats[cleanItem] || 0) + 1;
        });
    });

    document.getElementById('dashTotalChecks').innerText = fChecks.length.toLocaleString();
    document.getElementById('dashTotalCost').innerText = totalCost.toLocaleString();

    // วาดสถิติรายการที่ตรวจ
    const listHtml = document.getElementById('checkStatsList');
    listHtml.innerHTML = '';
    let sortedCheckStats = Object.entries(checkItemsStats).sort((a,b) => b[1] - a[1]);
    if(sortedCheckStats.length === 0) listHtml.innerHTML = '<li class="list-group-item text-muted text-center">ไม่มีข้อมูล</li>';
    sortedCheckStats.forEach(item => {
        listHtml.innerHTML += `<li class="list-group-item d-flex justify-content-between align-items-center">${item[0]} <span class="badge bg-primary rounded-pill">${item[1]} ครั้ง</span></li>`;
    });

    // --- วาดกราฟ Chart.js ---
    if(chart1) chart1.destroy();
    if(chart2) chart2.destroy();
    if(chart3) chart3.destroy();

    // กราฟสัดส่วนสถานะ (Pie)
    chart1 = new Chart(document.getElementById('chartStatus'), {
        type: 'doughnut',
        data: {
            labels: Object.keys(statusCounts),
            datasets: [{
                data: Object.values(statusCounts),
                backgroundColor: ['#198754', '#dc3545', '#ffc107', '#6c757d', '#212529']
            }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });

    // กราฟจำนวนเครื่องแยกประเภท (Bar)
    chart2 = new Chart(document.getElementById('chartCategory'), {
        type: 'bar',
        data: {
            labels: Object.keys(typeCounts),
            datasets: [{
                label: 'จำนวนเครื่อง',
                data: Object.values(typeCounts),
                backgroundColor: '#0d6efd'
            }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });

    // กราฟค่าใช้จ่ายแยกประเภท (Bar)
    chart3 = new Chart(document.getElementById('chartCost'), {
        type: 'bar',
        data: {
            labels: Object.keys(costByType),
            datasets: [{
                label: 'ค่าอะไหล่ (บาท)',
                data: Object.values(costByType),
                backgroundColor: '#198754'
            }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
}
