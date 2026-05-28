const API_URL = "https://script.google.com/macros/s/AKfycbyMhExH8HCNA-Vb6uPr3jYGCiv1lApnaEFOzSLxtv-tteTdJcOZ4aGg1woIy4Uvpa0/exec";
let html5QrCode;
let allProducts = []; 
let currentMachineParts = []; // เก็บอะไหล่เครื่องที่กำลังตรวจ

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
    document.getElementById('navbar').classList.remove('d-none');
    document.getElementById('menuSection').classList.remove('d-none');
    if (role === 'admin') document.getElementById('btnManage').classList.remove('d-none');
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
                
                const img = document.getElementById('modalMachineImg');
                if(p['รูปภาพ(url)']) { img.src = p['รูปภาพ(url)']; img.classList.remove('d-none'); }
                else { img.classList.add('d-none'); }

                // รายการตรวจ
                const cbContainer = document.getElementById('dynamicCheckboxes');
                cbContainer.innerHTML = '';
                (p['รายการตรวจสอบ'] || '').replace(/[\{\}]/g, '').split(',').forEach((item, i) => {
                    if(item.trim()) cbContainer.innerHTML += `<div class="form-check"><input class="form-check-input chk-item" type="checkbox" value="${item.trim()}" id="cb_${i}"><label class="form-check-label" for="cb_${i}">${item.trim()}</label></div>`;
                });

                // อะไหล่
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
        container.innerHTML += `
            <div class="form-check">
                <input class="form-check-input part-chk" type="checkbox" value="${i}" id="pchk_${i}" onchange="calculateTotalPrice()">
                <label class="form-check-label" for="pchk_${i}">${p.name} (${p.price} บาท)</label>
            </div>`;
    });
    calculateTotalPrice();
}

function addNewPartToUI() {
    const name = document.getElementById('newPartName').value.trim();
    const price = parseFloat(document.getElementById('newPartPrice').value) || 0;
    if(!name) return Swal.fire('แจ้งเตือน', 'กรุณาระบุชื่ออะไหล่', 'warning');
    
    currentMachineParts.push({ name, price });
    document.getElementById('newPartName').value = '';
    document.getElementById('newPartPrice').value = '';
    renderPartsCheckboxes();
    // ติ๊กเลือกให้อัตโนมัติสำหรับอันที่เพิ่งเพิ่ม
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
    document.querySelectorAll('.part-chk:checked').forEach(c => {
        total += currentMachineParts[c.value].price;
    });
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

    // สร้าง String อะไหล่ใหม่สำหรับส่งไปอัปเดต (เผื่อมีการเพิ่มใหม่)
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

// ---------------- Admin Section ----------------
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
                const typeFilter = document.getElementById('filterType');
                typeFilter.innerHTML = '<option value="">-- ทุกประเภท --</option>';
                [...new Set(allProducts.map(p => p['ประเภท']).filter(t => t))].forEach(t => typeFilter.innerHTML += `<option value="${t}">${t}</option>`);
                renderTable(allProducts);
            }
        });
}

function renderTable(products) {
    const tbody = document.getElementById('machineTableBody');
    tbody.innerHTML = '';
    products.forEach(item => {
        let badgeColor = item['สถานะ'] === 'ปกติ' ? 'bg-success' : 'bg-danger';
        tbody.innerHTML += `
            <tr class="clickable-row" onclick='openProductModal(${JSON.stringify(item)})'>
                <td class="fw-bold">${item['รหัส']}</td>
                <td>${item['ชื่อเครื่อง']}</td>
                <td>${item['ประเภท']}</td>
                <td><span class="badge ${badgeColor}">${item['สถานะ']}</span></td>
                <td>${item['วันที่ตรวจล่าสุด'] || '-'}</td>
            </tr>`;
    });
}

function filterMachines() {
    const s = document.getElementById('filterSearch').value.toLowerCase();
    const t = document.getElementById('filterType').value;
    const st = document.getElementById('filterStatus').value;
    const m = document.getElementById('filterMonth').value;

    const filtered = allProducts.filter(p => {
        const mSearch = p['รหัส'].toLowerCase().includes(s) || p['ชื่อเครื่อง'].toLowerCase().includes(s);
        const mType = !t || p['ประเภท'] === t;
        const mStatus = !st || p['สถานะ'] === st;
        // การดึงเดือนจากรูปแบบ DD/MM/YYYY
        let mMonth = true;
        if(m && p['วันที่ตรวจล่าสุด']) {
            const parts = p['วันที่ตรวจล่าสุด'].split('/');
            if(parts.length >= 2) mMonth = (parts[1] === m);
            else mMonth = false;
        } else if (m) mMonth = false;
        
        return mSearch && mType && mStatus && mMonth;
    });
    renderTable(filtered);
}

let isEditMode = false;
function openProductModal(prod) {
    isEditMode = !!prod;
    document.getElementById('productModalTitle').innerText = isEditMode ? "⚙️ แก้ไขข้อมูลเครื่อง" : "＋ เพิ่มเครื่องใหม่";
    document.getElementById('pId').value = prod ? prod['รหัส'] : '';
    document.getElementById('pId').readOnly = isEditMode;
    
    // แปลงวันที่ YYYY-MM-DD สำหรับ input type="date"
    let sDate = '';
    if(prod && prod['วันที่เริ่มใช้']) {
        let dParts = prod['วันที่เริ่มใช้'].split('/');
        if(dParts.length === 3) sDate = `${dParts[2]}-${dParts[1]}-${dParts[0]}`; 
    }
    document.getElementById('pStartDate').value = sDate;
    
    document.getElementById('pAssetNo').value = prod ? prod['เลขที่ทรัพย์สิน'] : '';
    document.getElementById('pType').value = prod ? prod['ประเภท'] : '';
    document.getElementById('pName').value = prod ? prod['ชื่อเครื่อง'] : '';
    document.getElementById('pCycle').value = prod ? prod['รอบเวลาตรวจ'] : 'm6';
    document.getElementById('pStatus').value = prod ? prod['สถานะ'] : 'ปกติ';
    document.getElementById('pCheckList').value = prod ? (prod['รายการตรวจสอบ']||'').replace(/[\{\}]/g, '') : '';
    document.getElementById('pPartsList').value = prod ? (prod['รายการอะไหล่และราคา']||prod['รายการอะไหล่+ราคา']||'') : '';
    
    document.getElementById('pImageFile').value = '';
    document.getElementById('pOldImgUrl').value = prod ? prod['รูปภาพ(url)'] : '';
    
    const preview = document.getElementById('pImgPreview');
    if(prod && prod['รูปภาพ(url)']) { preview.src = prod['รูปภาพ(url)']; preview.classList.remove('d-none'); }
    else { preview.classList.add('d-none'); }

    new bootstrap.Modal(document.getElementById('productModal')).show();
}

// ฟังก์ชันแปลงรูปภาพลดขนาดเพื่อไม่ให้หนักเกินไป
function getBase64Image(file, callback) {
    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 800; // ย่อขนาดความกว้างไม่เกิน 800px
            const scaleSize = MAX_WIDTH / img.width;
            canvas.width = MAX_WIDTH;
            canvas.height = img.height * scaleSize;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            callback(canvas.toDataURL('image/jpeg', 0.7)); // บีบอัด 70%
        }
        img.src = e.target.result;
    }
    reader.readAsDataURL(file);
}

function saveProduct() {
    const id = document.getElementById('pId').value.trim();
    if(!id) return Swal.fire('คำเตือน', 'กรุณาระบุรหัสเครื่อง', 'warning');

    const d = document.getElementById('pStartDate').value;
    const formattedDate = d ? d.split('-').reverse().join('/') : ''; // แปลงกลับเป็น DD/MM/YYYY

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
            checkList: `{${document.getElementById('pCheckList').value}}`,
            partsList: document.getElementById('pPartsList').value,
            status: document.getElementById('pStatus').value,
            cycle: document.getElementById('pCycle').value
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

    if (fileInput.files.length > 0) {
        Swal.fire({ title: 'กำลังประมวลผลรูปภาพ...', didOpen: () => Swal.showLoading() });
        getBase64Image(fileInput.files[0], finalizeSave);
    } else {
        finalizeSave(null);
    }
}
