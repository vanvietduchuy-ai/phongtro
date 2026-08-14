const STORAGE_KEY='huy_rooms_v2';
const LEGACY_KEY='huy_rooms_v1';
const ADMIN_PASSWORD='123456';
const IMG_DB='HuyRoomsMedia';
const IMG_STORE='images';
let currentResidentId=null;
let publicFilters={q:'',area:'all',status:'all',maxPrice:999999999};
let propertyImageState={existing:[],removed:[],newFiles:[]};
let roomImageState={existing:[],removed:[],newFiles:[]};
const imageUrlCache=new Map();

function uid(prefix='id'){return prefix+Date.now().toString(36)+Math.random().toString(36).slice(2,7)}
function money(n){return new Intl.NumberFormat('vi-VN').format(Math.round(Number(n||0)))+'đ'}
function esc(s=''){return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function today(){return new Date().toISOString().slice(0,10)}
function monthNow(){return new Date().toISOString().slice(0,7)}
function prevMonth(m){const [y,mo]=m.split('-').map(Number);const d=new Date(y,mo-2,1);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`}
function nextDayISO(days=7){const d=new Date();d.setDate(d.getDate()+days);return d.toISOString().slice(0,10)}
function daysUntil(date){if(!date)return 9999;const a=new Date(today()+'T00:00:00'),b=new Date(date+'T00:00:00');return Math.round((b-a)/86400000)}
function normalizePhone(v=''){return String(v).replace(/\D/g,'')}
function statusLabel(s){return({available:'Đang trống',reserved:'Đã giữ chỗ',occupied:'Đã thuê',maintenance:'Bảo trì'})[s]||s}
function apptStatusLabel(s){return({new:'Mới',confirmed:'Đã xác nhận',done:'Đã xem',cancelled:'Đã hủy'})[s]||s}
function billStatusLabel(s){return({unpaid:'Chưa thanh toán',partial:'Thanh toán một phần',paid:'Đã thanh toán',overdue:'Quá hạn'})[s]||s}
function showToast(msg){const t=document.getElementById('toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2600)}
function openModal(id){document.getElementById(id)?.classList.remove('hidden')}
function closeModal(id){document.getElementById(id)?.classList.add('hidden')}

const demoData={
  properties:[
    {id:'p1',name:'Nam Đông Hà Residence',area:'Nam Đông Hà',address:'Khu vực trung tâm Nam Đông Hà, Quảng Trị',description:'Khu trọ yên tĩnh, sáng thoáng, gần tiện ích',phone:'0846413314',imageIds:[]},
    {id:'p2',name:'Central House 02',area:'Đông Hà',address:'Gần trung tâm Đông Hà, Quảng Trị',description:'Phù hợp người đi làm và sinh viên',phone:'0846413314',imageIds:[]},
    {id:'p3',name:'Mini Studio 03',area:'Nam Đông Hà',address:'Khu dân cư Nam Đông Hà, Quảng Trị',description:'Căn hộ mini khép kín, riêng tư',phone:'0846413314',imageIds:[]}
  ],
  rooms:[
    {id:'r1',propertyId:'p1',name:'P101',price:2200000,deposit:2200000,area:22,status:'available',type:'Phòng trọ',capacity:2,amenities:['Điều hòa','Nóng lạnh','Wifi'],note:'',electricRate:3500,waterMode:'fixed',waterRate:15000,waterFixed:100000,imageIds:[]},
    {id:'r2',propertyId:'p1',name:'P102',price:2500000,deposit:2500000,area:25,status:'reserved',type:'Phòng trọ',capacity:2,amenities:['Điều hòa','Nóng lạnh','Ban công'],note:'',electricRate:3500,waterMode:'meter',waterRate:15000,waterFixed:0,imageIds:[]},
    {id:'r3',propertyId:'p1',name:'P201',price:2900000,deposit:2900000,area:28,status:'occupied',type:'Phòng gác lửng',capacity:3,amenities:['Điều hòa','Nóng lạnh','Gác lửng'],note:'',electricRate:3500,waterMode:'meter',waterRate:15000,waterFixed:0,imageIds:[]},
    {id:'r4',propertyId:'p2',name:'A01',price:1800000,deposit:1800000,area:18,status:'available',type:'Phòng trọ',capacity:1,amenities:['Wifi','WC riêng'],note:'',electricRate:3500,waterMode:'fixed',waterRate:15000,waterFixed:100000,imageIds:[]},
    {id:'r5',propertyId:'p2',name:'A02',price:2100000,deposit:2100000,area:20,status:'available',type:'Phòng trọ',capacity:2,amenities:['Wifi','WC riêng','Chỗ để xe'],note:'',electricRate:3500,waterMode:'fixed',waterRate:15000,waterFixed:120000,imageIds:[]},
    {id:'r6',propertyId:'p3',name:'ST01',price:3800000,deposit:5000000,area:32,status:'available',type:'Studio',capacity:2,amenities:['Điều hòa','Tủ lạnh','Bếp','Máy giặt'],note:'',electricRate:3500,waterMode:'meter',waterRate:16000,waterFixed:0,imageIds:[]},
    {id:'r7',propertyId:'p3',name:'ST02',price:4200000,deposit:5000000,area:35,status:'maintenance',type:'Studio',capacity:2,amenities:['Điều hòa','Tủ lạnh','Bếp','Ban công'],note:'',electricRate:3500,waterMode:'meter',waterRate:16000,waterFixed:0,imageIds:[]}
  ],
  appointments:[
    {id:'a1',roomId:'r1',customerName:'Nguyễn Văn An',customerPhone:'0905123456',date:nextDayISO(1),time:'09:30',note:'Muốn xem phòng buổi sáng',status:'new',createdAt:new Date().toISOString()}
  ],
  tenants:[
    {id:'t1',name:'Trần Minh Tú',phone:'0935123456',pin:'2580',roomId:'r3',moveInDate:'2026-06-01',active:true,depositRequired:2900000,depositPaid:2900000,note:''}
  ],
  utilityReadings:[],
  invoices:[],
  settings:{managerName:'Quản lý Huy Rooms',managerPhone:'0846413314',defaultDueDay:5,zaloMode:'manual'}
};
(function seedDemoBilling(){
  const m=monthNow();
  demoData.utilityReadings.push({id:'u1',roomId:'r3',month:m,electricStart:1250,electricEnd:1312,electricRate:3500,electricUnits:62,electricAmount:217000,waterMode:'meter',waterStart:80,waterEnd:84,waterRate:15000,waterFixed:0,waterUnits:4,waterAmount:60000,otherFee:0,note:'',createdAt:new Date().toISOString()});
  demoData.invoices.push({id:'i1',tenantId:'t1',roomId:'r3',readingId:'u1',month:m,dueDate:nextDayISO(5),rent:2900000,electric:217000,water:60000,other:0,depositAmount:0,total:3177000,amountPaid:0,status:'unpaid',depositApplied:false,createdAt:new Date().toISOString()});
})();

function migrateData(x){
  const d=x&&typeof x==='object'?x:{};
  d.properties=Array.isArray(d.properties)?d.properties:[];
  d.rooms=Array.isArray(d.rooms)?d.rooms:[];
  d.appointments=Array.isArray(d.appointments)?d.appointments:[];
  d.tenants=Array.isArray(d.tenants)?d.tenants:[];
  d.utilityReadings=Array.isArray(d.utilityReadings)?d.utilityReadings:[];
  d.invoices=Array.isArray(d.invoices)?d.invoices:[];
  d.settings={...demoData.settings,...(d.settings||{})};
  d.properties.forEach(p=>{p.imageIds=Array.isArray(p.imageIds)?p.imageIds:[]});
  d.rooms.forEach(r=>{r.imageIds=Array.isArray(r.imageIds)?r.imageIds:[];r.electricRate=Number(r.electricRate||3500);r.waterMode=r.waterMode||'fixed';r.waterRate=Number(r.waterRate||15000);r.waterFixed=Number(r.waterFixed||0)});
  d.tenants.forEach(t=>{t.active=t.active!==false;t.depositRequired=Number(t.depositRequired||0);t.depositPaid=Number(t.depositPaid||0);t.pin=String(t.pin||'2580')});
  return d;
}
function loadData(){
  try{
    const raw=localStorage.getItem(STORAGE_KEY);
    if(raw)return migrateData(JSON.parse(raw));
    const legacy=localStorage.getItem(LEGACY_KEY);
    if(legacy){const x=migrateData(JSON.parse(legacy));localStorage.setItem(STORAGE_KEY,JSON.stringify(x));return x}
  }catch(e){}
  return migrateData(structuredClone(demoData));
}
let data=loadData();
function saveLocal(){localStorage.setItem(STORAGE_KEY,JSON.stringify(data))}
function saveData(){saveLocal();if(window.Sync&&Sync.api)Sync.onLocalChange()}
function getProperty(id){return data.properties.find(x=>x.id===id)}
function getRoom(id){return data.rooms.find(x=>x.id===id)}
function getTenant(id){return data.tenants.find(x=>x.id===id)}
function activeTenantForRoom(roomId){return data.tenants.find(t=>t.roomId===roomId&&t.active)}
function getReading(id){return data.utilityReadings.find(x=>x.id===id)}
function getInvoice(id){return data.invoices.find(x=>x.id===id)}

// ---------- Image database ----------
function openImageDB(){return new Promise((resolve,reject)=>{const req=indexedDB.open(IMG_DB,1);req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains(IMG_STORE))db.createObjectStore(IMG_STORE,{keyPath:'id'})};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)})}
async function dbPutImage(id,blob){const db=await openImageDB();return new Promise((resolve,reject)=>{const tx=db.transaction(IMG_STORE,'readwrite');tx.objectStore(IMG_STORE).put({id,blob,createdAt:Date.now()});tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error)})}
async function dbGetImage(id){const db=await openImageDB();return new Promise((resolve,reject)=>{const req=db.transaction(IMG_STORE,'readonly').objectStore(IMG_STORE).get(id);req.onsuccess=()=>resolve(req.result?.blob||null);req.onerror=()=>reject(req.error)})}
async function dbDeleteImage(id){imageUrlCache.delete(id);const db=await openImageDB();return new Promise((resolve,reject)=>{const tx=db.transaction(IMG_STORE,'readwrite');tx.objectStore(IMG_STORE).delete(id);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error)})}
async function compressImage(file){
  try{
    const bmp=await createImageBitmap(file);const max=1600;const scale=Math.min(1,max/Math.max(bmp.width,bmp.height));const w=Math.round(bmp.width*scale),h=Math.round(bmp.height*scale);const c=document.createElement('canvas');c.width=w;c.height=h;const ctx=c.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,w,h);ctx.drawImage(bmp,0,0,w,h);bmp.close?.();return await new Promise(res=>c.toBlob(b=>res(b||file),'image/jpeg',.82));
  }catch(e){return file}
}
async function saveImageFile(file){
  const blob=await compressImage(file);
  if(window.Sync&&Sync.isOn()&&Sync.isAdmin()){
    try{return await Sync.uploadImage(blob,file.name||('anh-'+Date.now()+'.jpg'))}
    catch(e){showToast('Chưa tải được ảnh lên Drive, tạm lưu trên máy này')}
  }
  const id=uid('img');await dbPutImage(id,blob);return id}
async function imageUrl(id){if(!id)return'';if(/^https?:\/\//.test(id))return id;if(imageUrlCache.has(id))return imageUrlCache.get(id);try{const blob=await dbGetImage(id);if(!blob)return'';const url=URL.createObjectURL(blob);imageUrlCache.set(id,url);return url}catch(e){return''}}
async function hydrateImages(root=document){const els=[...root.querySelectorAll('[data-image-id]')];await Promise.all(els.map(async el=>{const id=el.dataset.imageId;if(!id)return;const url=await imageUrl(id);if(url){el.onerror=()=>{if(el.dataset.retried)return;const m=String(url).match(/googleusercontent\.com\/d\/([^=]+)/);if(m){el.dataset.retried='1';el.src='https://drive.google.com/thumbnail?id='+m[1]+'&sz=w1600'}};el.src=url;el.classList.remove('image-loading')}else el.style.display='none'}))}
function applyTableLabels(root=document){root.querySelectorAll('table.data-table').forEach(tb=>{const heads=[...tb.querySelectorAll('thead th')].map(th=>th.textContent.trim());tb.querySelectorAll('tbody tr').forEach(tr=>{[...tr.children].forEach((td,i)=>{td.setAttribute('data-label',heads[i]||'');if(td.querySelector('.table-actions'))td.setAttribute('data-label','')})})})}
function primaryPropertyImage(p){if(p?.imageIds?.[0])return p.imageIds[0];const r=data.rooms.find(x=>x.propertyId===p?.id&&x.imageIds?.length);return r?.imageIds?.[0]||''}
function primaryRoomImage(r){return r?.imageIds?.[0]||primaryPropertyImage(getProperty(r?.propertyId))}

async function renderImageEditor(kind){
  const state=kind==='property'?propertyImageState:roomImageState;const el=document.getElementById(kind==='property'?'propertyImagePreview':'roomImagePreview');if(!el)return;
  el.innerHTML='';
  for(const id of state.existing){const item=document.createElement('div');item.className='image-preview';item.innerHTML=`<img alt="Ảnh đã lưu"><button type="button" title="Xóa ảnh">×</button>`;const url=await imageUrl(id);if(url)item.querySelector('img').src=url;item.querySelector('button').onclick=()=>{state.existing=state.existing.filter(x=>x!==id);state.removed.push(id);renderImageEditor(kind)};el.appendChild(item)}
  state.newFiles.forEach((file,index)=>{const item=document.createElement('div');item.className='image-preview';const url=URL.createObjectURL(file);item.innerHTML=`<img src="${url}" alt="Ảnh mới"><button type="button" title="Bỏ ảnh">×</button>`;item.querySelector('button').onclick=()=>{state.newFiles.splice(index,1);renderImageEditor(kind)};el.appendChild(item)});
}
async function commitImageState(state){const ids=[];for(const f of state.newFiles){try{ids.push(await saveImageFile(f))}catch(e){showToast('Có ảnh không lưu được. Hãy thử lại.')}}for(const id of state.removed){try{await dbDeleteImage(id)}catch(e){}}return [...state.existing,...ids]}

// ---------- Public site ----------
function renderAreaOptions(){const areas=[...new Set(data.properties.map(p=>p.area).filter(Boolean))].sort();const html='<option value="all">Tất cả khu vực</option>'+areas.map(a=>`<option value="${esc(a)}">${esc(a)}</option>`).join('');document.getElementById('areaFilter').innerHTML=html;document.getElementById('heroAreaFilter').innerHTML=html;document.getElementById('areaFilter').value=publicFilters.area;document.getElementById('heroAreaFilter').value=publicFilters.area}
function renderHeroStats(){const available=data.rooms.filter(r=>r.status==='available').length;document.getElementById('heroStats').innerHTML=`<div class="stat-mini"><strong>${data.properties.length}</strong><span>Căn trọ</span></div><div class="stat-mini"><strong>${data.rooms.length}</strong><span>Tổng số phòng</span></div><div class="stat-mini"><strong>${available}</strong><span>Phòng đang trống</span></div>`}
function roomPublicRow(r){const canBook=r.status==='available';const img=primaryRoomImage(r);return `<div class="room-row">
  ${img?`<img class="room-thumb image-loading" data-image-id="${img}" alt="${esc(r.name)}" onclick="openGallery('${r.id}')" style="cursor:pointer">`:`<div class="room-thumb room-thumb-placeholder" onclick="openGallery('${r.id}')" style="cursor:pointer">⌂</div>`}
  <div class="room-name"><strong>${esc(r.name)} · ${esc(r.type)}</strong><small>${r.area?`${r.area} m²`:''}${r.capacity?` · Tối đa ${r.capacity} người`:''}</small><div class="amenities">${(r.amenities||[]).slice(0,4).map(a=>`<span class="amenity">${esc(a)}</span>`).join('')}</div></div>
  <div class="room-price"><strong>${money(r.price)}/tháng</strong><small>Cọc ${money(r.deposit)}</small></div>
  <div class="room-actions"><span class="status-dot status-${r.status}">${statusLabel(r.status)}</span>${r.imageIds?.length?`<button class="btn-mini" onclick="openGallery('${r.id}')">Xem ảnh</button>`:''}<button class="btn-mini" ${canBook?'':'disabled'} onclick="openBooking('${r.id}')">${canBook?'Đặt lịch':'Chưa thể đặt'}</button></div>
</div>`}
async function renderPublic(){
  renderAreaOptions();renderHeroStats();const q=publicFilters.q.toLowerCase();
  const matches=data.properties.map(p=>{let rooms=data.rooms.filter(r=>r.propertyId===p.id).filter(r=>publicFilters.status==='all'||r.status===publicFilters.status).filter(r=>Number(r.price)<=publicFilters.maxPrice).filter(r=>!q||[p.name,p.address,p.area,r.name,r.type,(r.amenities||[]).join(' ')].join(' ').toLowerCase().includes(q));if(q&&[p.name,p.address,p.area].join(' ').toLowerCase().includes(q))rooms=data.rooms.filter(r=>r.propertyId===p.id).filter(r=>publicFilters.status==='all'||r.status===publicFilters.status).filter(r=>Number(r.price)<=publicFilters.maxPrice);if(publicFilters.area!=='all'&&p.area!==publicFilters.area)return null;return rooms.length?{p,rooms}:null}).filter(Boolean);
  const total=matches.reduce((s,x)=>s+x.rooms.length,0);document.getElementById('resultCount').textContent=`${total} phòng phù hợp`;
  document.getElementById('propertyGrid').innerHTML=matches.length?matches.map(({p,rooms})=>{const cover=primaryPropertyImage(p);return `<article class="property-card"><div class="property-cover">${cover?`<img class="image-loading" data-image-id="${cover}" alt="${esc(p.name)}">`:`<div class="property-cover-fallback"></div>`}<div class="property-cover-overlay"><div><span class="pill">${rooms.filter(r=>r.status==='available').length} phòng trống</span><h3>${esc(p.name)}</h3><p>${esc(p.address)}</p></div></div></div><div class="property-body"><div class="property-meta"><span>⌖ ${esc(p.area)}</span><span>⌂ ${data.rooms.filter(r=>r.propertyId===p.id).length} phòng</span><span>☎ ${esc(p.phone||'Liên hệ')}</span></div><div class="room-list">${rooms.map(roomPublicRow).join('')}</div></div></article>`}).join(''):'<div class="empty" style="grid-column:1/-1">Không có phòng phù hợp với bộ lọc hiện tại.</div>';
  await hydrateImages(document.getElementById('propertyGrid'));
}
window.openGallery=async function(roomId){const r=getRoom(roomId);if(!r)return;const p=getProperty(r.propertyId);const ids=[...(r.imageIds||[])];if(!ids.length&&p?.imageIds?.length)ids.push(...p.imageIds);document.getElementById('galleryContent').innerHTML=`<div class="gallery-head"><h3>${esc(p?.name||'')} · ${esc(r.name)}</h3><p>${money(r.price)}/tháng · Cọc ${money(r.deposit)} · ${r.area||'-'} m²</p></div><div class="gallery-grid">${ids.length?ids.map(id=>`<img data-image-id="${id}" alt="Ảnh phòng">`).join(''):'<div class="gallery-empty">Phòng này chưa có ảnh. Quản lý có thể tải ảnh lên trong phần Căn trọ & phòng.</div>'}</div><div class="gallery-info">${(r.amenities||[]).map(a=>`<span>${esc(a)}</span>`).join('')}</div>`;openModal('galleryModal');await hydrateImages(document.getElementById('galleryContent'))}
window.openBooking=function(roomId){const r=getRoom(roomId);if(!r)return;const p=getProperty(r.propertyId);document.getElementById('bookingRoomId').value=r.id;document.getElementById('bookingRoomSummary').innerHTML=`<h4>${esc(p?.name||'')} · ${esc(r.name)}</h4><p>${money(r.price)}/tháng · ${r.area||'-'} m² · ${statusLabel(r.status)}</p>`;const date=document.getElementById('appointmentDate');date.min=today();date.value=nextDayISO(1);document.getElementById('appointmentTime').value='09:00';openModal('bookingModal')}

// ---------- Navigation / login ----------
function showPublic(){document.getElementById('publicApp').classList.remove('hidden');document.getElementById('publicTopbar').classList.remove('hidden');document.getElementById('adminApp').classList.add('hidden');document.getElementById('residentApp').classList.add('hidden');renderPublic();updateSyncPill();window.scrollTo(0,0)}
function showAdmin(){document.getElementById('publicApp').classList.add('hidden');document.getElementById('publicTopbar').classList.add('hidden');document.getElementById('residentApp').classList.add('hidden');document.getElementById('adminApp').classList.remove('hidden');renderAdmin();updateSyncPill();window.scrollTo(0,0)}
function showResident(tenantId){currentResidentId=tenantId;document.getElementById('publicApp').classList.add('hidden');document.getElementById('publicTopbar').classList.add('hidden');document.getElementById('adminApp').classList.add('hidden');document.getElementById('residentApp').classList.remove('hidden');renderResident();window.scrollTo(0,0)}

// ---------- Resident portal ----------
function effectiveInvoiceStatus(i){if(i.status==='paid')return'paid';if(i.dueDate&&i.dueDate<today())return'overdue';return i.status||'unpaid'}
function remainingInvoice(i){return Math.max(0,Number(i.total||0)-Number(i.amountPaid||0))}
function invoiceBadge(i){const s=effectiveInvoiceStatus(i);return `<span class="badge badge-${s}">${billStatusLabel(s)}</span>`}
async function renderResident(){
  const t=getTenant(currentResidentId);if(!t){showPublic();return}const r=getRoom(t.roomId),p=getProperty(r?.propertyId);const inv=[...data.invoices].filter(i=>i.tenantId===t.id).sort((a,b)=>b.month.localeCompare(a.month));const readings=[...data.utilityReadings].filter(u=>u.roomId===t.roomId).sort((a,b)=>b.month.localeCompare(a.month));const latest=inv[0];const depLeft=Math.max(0,t.depositRequired-t.depositPaid);const totalDebt=inv.reduce((s,i)=>s+remainingInvoice(i),0);
  document.getElementById('residentContent').innerHTML=`
    <div class="resident-welcome"><div class="eyebrow dark">CỔNG THÔNG TIN CƯ DÂN</div><h1>Xin chào, ${esc(t.name)}</h1><p>${esc(p?.name||'')} · Phòng ${esc(r?.name||'-')} · ${esc(p?.address||'')}</p></div>
    <div class="resident-grid">
      <div class="resident-card"><h3>Phòng đang ở</h3><div class="big-number">${esc(r?.name||'-')}</div><div class="kv"><span>Tiền phòng</span><strong>${money(r?.price)}</strong></div><div class="kv"><span>Ngày vào ở</span><strong>${esc(t.moveInDate||'-')}</strong></div></div>
      <div class="resident-card"><h3>Tiền cọc</h3><div class="big-number">${money(t.depositPaid)}</div><div class="kv"><span>Phải đóng</span><strong>${money(t.depositRequired)}</strong></div><div class="kv"><span>Còn thiếu</span><strong>${money(depLeft)}</strong></div><div class="progress-line"><i style="width:${Math.min(100,t.depositRequired?100*t.depositPaid/t.depositRequired:100)}%"></i></div></div>
      <div class="resident-card"><h3>Công nợ hiện tại</h3><div class="big-number">${money(totalDebt)}</div><div class="kv"><span>Hóa đơn chưa xong</span><strong>${inv.filter(i=>effectiveInvoiceStatus(i)!=='paid').length}</strong></div>${latest?`<div class="kv"><span>Hóa đơn gần nhất</span>${invoiceBadge(latest)}</div>`:''}</div>
      ${latest?`<div class="resident-card resident-history"><div class="panel-head"><div><h3>Hóa đơn tháng ${esc(latest.month)}</h3><p>Hạn thanh toán ${esc(latest.dueDate||'-')}</p></div>${invoiceBadge(latest)}</div><div class="bill-breakdown"><div class="bill-row"><span>Tiền phòng</span><strong>${money(latest.rent)}</strong></div><div class="bill-row"><span>Tiền điện</span><strong>${money(latest.electric)}</strong></div><div class="bill-row"><span>Tiền nước</span><strong>${money(latest.water)}</strong></div><div class="bill-row"><span>Phí khác</span><strong>${money(latest.other)}</strong></div>${latest.depositAmount?`<div class="bill-row"><span>Tiền cọc</span><strong>${money(latest.depositAmount)}</strong></div>`:''}<div class="bill-row total"><span>Tổng hóa đơn</span><strong>${money(latest.total)}</strong></div><div class="bill-row"><span>Đã thanh toán</span><strong>${money(latest.amountPaid)}</strong></div><div class="bill-row total"><span>Còn lại</span><strong>${money(remainingInvoice(latest))}</strong></div></div><div style="margin-top:12px"><button class="btn btn-light" onclick="copyInvoiceText('${latest.id}')">Sao chép chi tiết hóa đơn</button></div></div>`:''}
      <div class="resident-card resident-history"><div class="panel-head"><div><h3>Lịch sử điện & nước</h3><p>Tự đối chiếu chỉ số theo từng tháng</p></div></div><div class="table-wrap"><table class="data-table"><thead><tr><th>Tháng</th><th>Điện đầu → cuối</th><th>Số điện</th><th>Tiền điện</th><th>Nước</th><th>Tiền nước</th></tr></thead><tbody>${readings.length?readings.map(u=>`<tr><td>${esc(u.month)}</td><td>${u.electricStart} → ${u.electricEnd}</td><td>${u.electricUnits} kWh</td><td>${money(u.electricAmount)}</td><td>${u.waterMode==='fixed'?'Cố định':`${u.waterStart} → ${u.waterEnd} (${u.waterUnits} m³)`}</td><td>${money(u.waterAmount)}</td></tr>`).join(''):'<tr><td colspan="6">Chưa có dữ liệu.</td></tr>'}</tbody></table></div></div>
      <div class="resident-card resident-history"><div class="panel-head"><div><h3>Lịch sử hóa đơn</h3><p>${inv.length} hóa đơn</p></div></div><div class="table-wrap"><table class="data-table"><thead><tr><th>Tháng</th><th>Tổng</th><th>Đã thanh toán</th><th>Còn lại</th><th>Hạn</th><th>Trạng thái</th></tr></thead><tbody>${inv.length?inv.map(i=>`<tr><td>${esc(i.month)}</td><td>${money(i.total)}</td><td>${money(i.amountPaid)}</td><td>${money(remainingInvoice(i))}</td><td>${esc(i.dueDate||'-')}</td><td>${invoiceBadge(i)}</td></tr>`).join(''):'<tr><td colspan="6">Chưa có hóa đơn.</td></tr>'}</tbody></table></div></div>
    </div>`;
  await hydrateImages(document.getElementById('residentContent'));
applyTableLabels(document.getElementById('residentApp'));
}

window.copyInvoiceText=function(id){const i=getInvoice(id);if(!i)return;const t=getTenant(i.tenantId),r=getRoom(i.roomId);const text=`HÓA ĐƠN ${i.month} - Phòng ${r?.name||''}\nTiền phòng: ${money(i.rent)}\nTiền điện: ${money(i.electric)}\nTiền nước: ${money(i.water)}\nPhí khác: ${money(i.other)}${i.depositAmount?`\nTiền cọc: ${money(i.depositAmount)}`:''}\nTổng: ${money(i.total)}\nĐã thanh toán: ${money(i.amountPaid)}\nCòn lại: ${money(remainingInvoice(i))}\nHạn thanh toán: ${i.dueDate||'-'}`;copyText(text,'Đã sao chép chi tiết hóa đơn')}

// ---------- Admin common ----------
function switchAdminView(view){document.querySelectorAll('.mobile-tabbar button').forEach(b=>b.classList.toggle('active',b.dataset.view===view));document.getElementById('fabSheet')?.classList.remove('show');document.querySelectorAll('.side-link').forEach(b=>b.classList.toggle('active',b.dataset.view===view));document.querySelectorAll('.admin-view').forEach(v=>v.classList.remove('active'));document.getElementById('view-'+view)?.classList.add('active');document.getElementById('adminTitle').textContent=({dashboard:'Tổng quan',properties:'Căn trọ & phòng',tenants:'Người thuê',utilities:'Điện & nước',invoices:'Hóa đơn',appointments:'Lịch hẹn',settings:'Cài đặt'})[view]||view}
document.querySelectorAll('.side-link').forEach(b=>b.addEventListener('click',()=>switchAdminView(b.dataset.view)));
function renderAdmin(){renderDashboard();renderPropertyAdmin();renderTenants();renderUtilities();renderInvoices();renderAppointments();renderSettings();applyTableLabels(document.getElementById('adminApp'));syncTabbar();hydrateImages(document.getElementById('adminApp'))}

function renderDashboard(){
  const available=data.rooms.filter(r=>r.status==='available').length, occupied=data.rooms.filter(r=>r.status==='occupied').length, due=data.invoices.filter(i=>effectiveInvoiceStatus(i)!=='paid').reduce((s,i)=>s+remainingInvoice(i),0),reminders=data.invoices.filter(i=>effectiveInvoiceStatus(i)!=='paid'&&daysUntil(i.dueDate)<=3).sort((a,b)=>(a.dueDate||'').localeCompare(b.dueDate||''));const newAppts=data.appointments.filter(a=>a.status==='new');
  document.getElementById('view-dashboard').innerHTML=`<div class="dashboard-grid">
    <div class="metric"><small>TỔNG PHÒNG</small><strong>${data.rooms.length}</strong><div class="trend">${data.properties.length} căn trọ</div></div>
    <div class="metric"><small>PHÒNG TRỐNG</small><strong>${available}</strong><div class="trend">Sẵn sàng cho thuê</div></div>
    <div class="metric"><small>ĐANG THUÊ</small><strong>${occupied}</strong><div class="trend">${data.tenants.filter(t=>t.active).length} người thuê</div></div>
    <div class="metric"><small>CÔNG NỢ</small><strong>${money(due)}</strong><div class="trend">${data.invoices.filter(i=>effectiveInvoiceStatus(i)!=='paid').length} hóa đơn</div></div>
    <div class="metric"><small>LỊCH HẸN MỚI</small><strong>${newAppts.length}</strong><div class="trend">Cần xác nhận</div></div>
  </div><div class="admin-grid-2">
    <div class="panel"><div class="panel-head"><div><h3>Việc cần xử lý</h3><p>Ưu tiên công nợ quá hạn và lịch hẹn mới</p></div></div>${reminders.length?reminders.slice(0,6).map(i=>{const t=getTenant(i.tenantId),r=getRoom(i.roomId),d=daysUntil(i.dueDate);return `<div class="reminder-box"><strong>${esc(t?.name||'')} · ${esc(r?.name||'')} · còn ${money(remainingInvoice(i))}</strong><span>${d<0?`Quá hạn ${Math.abs(d)} ngày`:d===0?'Đến hạn hôm nay':`Còn ${d} ngày đến hạn`} · hóa đơn ${esc(i.month)}</span><div class="table-actions" style="margin-top:8px"><button class="icon-btn" onclick="copyZaloReminder('${i.id}')">Sao chép nhắc Zalo</button><button class="icon-btn" onclick="recordPayment('${i.id}')">Ghi nhận thanh toán</button></div></div>`}).join(''):'<div class="empty">Không có hóa đơn đến hạn trong 3 ngày tới.</div>'}</div>
    <div class="panel"><div class="panel-head"><div><h3>Lịch hẹn mới</h3><p>${newAppts.length} yêu cầu</p></div></div>${newAppts.length?newAppts.slice(0,5).map(appointmentCard).join(''):'<div class="empty">Chưa có lịch hẹn mới.</div>'}</div>
  </div>`;
}

// ---------- Properties / rooms ----------
function renderPropertyAdmin(){
  const root=document.getElementById('view-properties');root.innerHTML=`<div class="panel-head"><div><h3>Danh sách căn trọ</h3><p>Sửa giá trực tiếp hoặc mở “Sửa & ảnh” để cập nhật chi tiết</p></div><button class="btn btn-primary" onclick="openPropertyForm()">+ Thêm căn</button></div>`+(data.properties.length?data.properties.map(p=>{const rooms=data.rooms.filter(r=>r.propertyId===p.id),img=primaryPropertyImage(p);return `<div class="property-admin-card"><div class="property-admin-head"><div class="property-admin-title">${img?`<img class="admin-property-thumb" data-image-id="${img}">`:`<div class="admin-property-thumb room-thumb-placeholder">⌂</div>`}<div><h3>${esc(p.name)}</h3><p>${esc(p.address)} · ${rooms.length} phòng</p></div></div><div class="property-admin-actions"><button class="icon-btn" onclick="openRoomForm(null,'${p.id}')">+ Phòng</button><button class="icon-btn" onclick="openPropertyForm('${p.id}')">Sửa & ảnh</button><button class="icon-btn danger" onclick="deleteProperty('${p.id}')">Xóa</button></div></div><div class="property-admin-body"><div class="table-wrap"><table class="data-table"><thead><tr><th>Ảnh</th><th>Phòng</th><th>Diện tích</th><th>Giá/tháng</th><th>Cọc</th><th>Trạng thái</th><th></th></tr></thead><tbody>${rooms.length?rooms.map(r=>{const ri=primaryRoomImage(r);return `<tr>${ri?`<td><img class="thumb-mini" data-image-id="${ri}"></td>`:`<td><div class="thumb-mini room-thumb-placeholder">⌂</div></td>`}<td><strong>${esc(r.name)}</strong><br><span style="color:var(--muted)">${esc(r.type)}</span></td><td>${r.area||'-'} m²</td><td><input class="inline-input" type="number" value="${Number(r.price||0)}" onchange="quickRoomMoney('${r.id}','price',this.value)"></td><td><input class="inline-input" type="number" value="${Number(r.deposit||0)}" onchange="quickRoomMoney('${r.id}','deposit',this.value)"></td><td><select class="select-small" onchange="quickRoomStatus('${r.id}',this.value)"><option value="available" ${r.status==='available'?'selected':''}>Đang trống</option><option value="reserved" ${r.status==='reserved'?'selected':''}>Giữ chỗ</option><option value="occupied" ${r.status==='occupied'?'selected':''}>Đã thuê</option><option value="maintenance" ${r.status==='maintenance'?'selected':''}>Bảo trì</option></select></td><td><div class="table-actions"><button class="icon-btn" onclick="openRoomForm('${r.id}')">Sửa & ảnh</button><button class="icon-btn danger" onclick="deleteRoom('${r.id}')">Xóa</button></div></td></tr>`}).join(''):'<tr><td colspan="7"><div class="empty">Chưa có phòng trong căn này.</div></td></tr>'}</tbody></table></div></div></div>`}).join(''):'<div class="empty">Chưa có căn trọ nào.</div>');hydrateImages(root)}
window.quickRoomMoney=function(id,key,value){const r=getRoom(id);if(!r)return;r[key]=Math.max(0,Number(value||0));saveData();renderPublic();showToast(key==='price'?'Đã cập nhật giá phòng':'Đã cập nhật tiền cọc')}
window.quickRoomStatus=function(id,status){const r=getRoom(id);if(!r)return;r.status=status;saveData();renderAdmin();renderPublic();showToast('Đã đổi trạng thái phòng')}
window.deleteRoom=async function(id){const r=getRoom(id);if(!r)return;if(!confirm('Xóa phòng này? Dữ liệu hóa đơn/lịch sử cũ vẫn được giữ để đối chiếu.'))return;for(const img of r.imageIds||[])await dbDeleteImage(img);data.rooms=data.rooms.filter(x=>x.id!==id);data.tenants.filter(t=>t.roomId===id&&t.active).forEach(t=>t.active=false);saveData();renderAdmin();renderPublic();showToast('Đã xóa phòng')}
window.deleteProperty=async function(id){const p=getProperty(id);const rooms=data.rooms.filter(r=>r.propertyId===id);if(!confirm(`Xóa căn trọ này và ${rooms.length} phòng thuộc căn?`))return;for(const img of p?.imageIds||[])await dbDeleteImage(img);for(const r of rooms)for(const img of r.imageIds||[])await dbDeleteImage(img);const roomIds=new Set(rooms.map(r=>r.id));data.properties=data.properties.filter(x=>x.id!==id);data.rooms=data.rooms.filter(r=>!roomIds.has(r.id));data.tenants.filter(t=>roomIds.has(t.roomId)&&t.active).forEach(t=>t.active=false);saveData();renderAdmin();renderPublic();showToast('Đã xóa căn trọ')}
window.openPropertyForm=function(id=null){const p=id?getProperty(id):null;document.getElementById('propertyModalTitle').textContent=p?'Sửa căn trọ & ảnh':'Thêm căn trọ';document.getElementById('propertyId').value=p?.id||'';document.getElementById('propertyName').value=p?.name||'';document.getElementById('propertyArea').value=p?.area||'';document.getElementById('propertyAddress').value=p?.address||'';document.getElementById('propertyDescription').value=p?.description||'';document.getElementById('propertyPhone').value=p?.phone||data.settings.managerPhone||'';document.getElementById('propertyImages').value='';propertyImageState={existing:[...(p?.imageIds||[])],removed:[],newFiles:[]};renderImageEditor('property');openModal('propertyModal')}
function fillRoomPropertySelect(selected){document.getElementById('roomProperty').innerHTML=data.properties.map(p=>`<option value="${p.id}" ${p.id===selected?'selected':''}>${esc(p.name)}</option>`).join('')}
window.openRoomForm=function(id=null,propertyId=null){if(!data.properties.length){showToast('Hãy tạo ít nhất 1 căn trọ trước.');return}const r=id?getRoom(id):null;document.getElementById('roomModalTitle').textContent=r?'Sửa phòng & ảnh':'Thêm phòng';document.getElementById('roomId').value=r?.id||'';fillRoomPropertySelect(r?.propertyId||propertyId||data.properties[0].id);document.getElementById('roomName').value=r?.name||'';document.getElementById('roomPrice').value=r?.price||'';document.getElementById('roomDeposit').value=r?.deposit||'';document.getElementById('roomArea').value=r?.area||'';document.getElementById('roomCapacity').value=r?.capacity||2;document.getElementById('roomType').value=r?.type||'Phòng trọ';document.getElementById('roomStatus').value=r?.status||'available';document.getElementById('roomElectricRate').value=r?.electricRate||3500;document.getElementById('roomWaterMode').value=r?.waterMode||'fixed';document.getElementById('roomWaterRate').value=r?.waterRate||15000;document.getElementById('roomWaterFixed').value=r?.waterFixed||0;document.getElementById('roomAmenities').value=(r?.amenities||[]).join(', ');document.getElementById('roomNote').value=r?.note||'';document.getElementById('roomImages').value='';roomImageState={existing:[...(r?.imageIds||[])],removed:[],newFiles:[]};renderImageEditor('room');openModal('roomModal')}

// ---------- Tenants ----------
function fillTenantRoomSelect(selected){document.getElementById('tenantRoom').innerHTML=data.rooms.map(r=>{const p=getProperty(r.propertyId);return `<option value="${r.id}" ${r.id===selected?'selected':''}>${esc(p?.name||'')} · ${esc(r.name)}</option>`}).join('')}
window.openTenantForm=function(id=null,roomId=null){if(!data.rooms.length){showToast('Hãy tạo phòng trước.');return}const t=id?getTenant(id):null;document.getElementById('tenantModalTitle').textContent=t?'Sửa người thuê':'Thêm người thuê';document.getElementById('tenantId').value=t?.id||'';document.getElementById('tenantName').value=t?.name||'';document.getElementById('tenantPhone').value=t?.phone||'';document.getElementById('tenantPin').value=t?.pin||'2580';fillTenantRoomSelect(t?.roomId||roomId||data.rooms[0].id);document.getElementById('tenantMoveIn').value=t?.moveInDate||today();document.getElementById('tenantActive').value=String(t?.active!==false);const rr=getRoom(t?.roomId||roomId||data.rooms[0].id);document.getElementById('tenantDepositRequired').value=t?.depositRequired??rr?.deposit??0;document.getElementById('tenantDepositPaid').value=t?.depositPaid??0;document.getElementById('tenantNote').value=t?.note||'';openModal('tenantModal')}
function renderTenants(){const root=document.getElementById('view-tenants');root.innerHTML=`<div class="panel"><div class="panel-head"><div><h3>Người thuê & tài khoản cư dân</h3><p>Tạo tài khoản bằng số điện thoại + PIN và gán đúng phòng</p></div><button class="btn btn-primary" onclick="openTenantForm()">+ Thêm người thuê</button></div><div class="table-wrap"><table class="data-table"><thead><tr><th>Người thuê</th><th>Điện thoại</th><th>Phòng</th><th>Cọc phải đóng</th><th>Đã nhận</th><th>Còn thiếu</th><th>Tài khoản</th><th></th></tr></thead><tbody>${data.tenants.length?data.tenants.map(t=>{const r=getRoom(t.roomId),p=getProperty(r?.propertyId);return `<tr><td><strong>${esc(t.name)}</strong><br><span style="color:var(--muted)">${t.active?'Đang thuê':'Đã trả phòng'}</span></td><td>${esc(t.phone)}</td><td>${esc(p?.name||'')} · ${esc(r?.name||'-')}</td><td>${money(t.depositRequired)}</td><td>${money(t.depositPaid)}</td><td>${money(Math.max(0,t.depositRequired-t.depositPaid))}</td><td>PIN: <strong>${esc(t.pin)}</strong></td><td><div class="table-actions"><button class="icon-btn" onclick="openTenantForm('${t.id}')">Sửa</button><button class="icon-btn" onclick="copyTenantLogin('${t.id}')">Gửi thông tin đăng nhập</button><button class="icon-btn danger" onclick="deleteTenant('${t.id}')">Xóa</button></div></td></tr>`}).join(''):'<tr><td colspan="8"><div class="empty">Chưa có người thuê.</div></td></tr>'}</tbody></table></div></div>`}
window.copyTenantLogin=function(id){const t=getTenant(id),r=getRoom(t?.roomId);if(!t)return;copyText(`Huy Rooms - thông tin đăng nhập cư dân\nSố điện thoại: ${t.phone}\nMã PIN: ${t.pin}\nPhòng: ${r?.name||''}\nBạn có thể dùng tài khoản này để xem tiền phòng, điện, nước, tiền cọc và lịch sử hóa đơn.`, 'Đã sao chép thông tin tài khoản')}
window.deleteTenant=function(id){if(!confirm('Xóa người thuê này? Hóa đơn cũ vẫn được giữ để đối chiếu.'))return;data.tenants=data.tenants.filter(t=>t.id!==id);saveData();renderAdmin();showToast('Đã xóa người thuê')}

// ---------- Utilities ----------
function roomOptionHtml(selected){return data.rooms.map(r=>{const p=getProperty(r.propertyId);return `<option value="${r.id}" ${r.id===selected?'selected':''}>${esc(p?.name||'')} · ${esc(r.name)}</option>`}).join('')}
function calcUtilityFromForm(){const es=Number(document.getElementById('electricStart').value||0),ee=Number(document.getElementById('electricEnd').value||0),er=Number(document.getElementById('electricRate').value||0);const eu=Math.max(0,ee-es),ea=eu*er;document.getElementById('electricUnitsPreview').textContent=`${eu.toLocaleString('vi-VN')} kWh`;document.getElementById('electricPreview').textContent=money(ea);const wm=document.getElementById('waterMode').value;document.querySelectorAll('.water-meter-field').forEach(e=>e.classList.toggle('hidden',wm==='fixed'));document.querySelectorAll('.water-fixed-field').forEach(e=>e.classList.toggle('hidden',wm!=='fixed'));let wu=0,wa=0;if(wm==='fixed'){wa=Number(document.getElementById('waterFixed').value||0);document.getElementById('waterUnitsPreview').textContent='Cố định'}else{const ws=Number(document.getElementById('waterStart').value||0),we=Number(document.getElementById('waterEnd').value||0),wr=Number(document.getElementById('waterRate').value||0);wu=Math.max(0,we-ws);wa=wu*wr;document.getElementById('waterUnitsPreview').textContent=`${wu.toLocaleString('vi-VN')} m³`}document.getElementById('waterPreview').textContent=money(wa);return{electricUnits:eu,electricAmount:ea,waterUnits:wu,waterAmount:wa}}
function smartPrefillUtility(force=false){const roomId=document.getElementById('utilityRoom').value,month=document.getElementById('utilityMonth').value;if(!roomId||!month)return;const r=getRoom(roomId);document.getElementById('electricRate').value=r?.electricRate||3500;document.getElementById('waterMode').value=r?.waterMode||'fixed';document.getElementById('waterRate').value=r?.waterRate||15000;document.getElementById('waterFixed').value=r?.waterFixed||0;const previous=[...data.utilityReadings].filter(u=>u.roomId===roomId&&u.month<month).sort((a,b)=>b.month.localeCompare(a.month))[0];if(force||!document.getElementById('utilityId').value){document.getElementById('electricStart').value=previous?.electricEnd??'';document.getElementById('electricEnd').value='';document.getElementById('waterStart').value=previous?.waterEnd??'';document.getElementById('waterEnd').value='';}calcUtilityFromForm()}
window.openUtilityForm=function(id=null,roomId=null){if(!data.rooms.length){showToast('Chưa có phòng để ghi điện nước.');return}const u=id?getReading(id):null;document.getElementById('utilityId').value=u?.id||'';document.getElementById('utilityRoom').innerHTML=roomOptionHtml(u?.roomId||roomId||data.rooms[0].id);document.getElementById('utilityMonth').value=u?.month||monthNow();if(u){['electricStart','electricEnd','electricRate','waterStart','waterEnd','waterRate','waterFixed','utilityOtherFee','utilityNote'].forEach(k=>{});document.getElementById('electricStart').value=u.electricStart??'';document.getElementById('electricEnd').value=u.electricEnd??'';document.getElementById('electricRate').value=u.electricRate??3500;document.getElementById('waterMode').value=u.waterMode||'fixed';document.getElementById('waterStart').value=u.waterStart??'';document.getElementById('waterEnd').value=u.waterEnd??'';document.getElementById('waterRate').value=u.waterRate??15000;document.getElementById('waterFixed').value=u.waterFixed??0;document.getElementById('utilityOtherFee').value=u.otherFee??0;document.getElementById('utilityNote').value=u.note||'';calcUtilityFromForm()}else{document.getElementById('utilityOtherFee').value=0;document.getElementById('utilityNote').value='';smartPrefillUtility(true)}openModal('utilityModal')}
function renderUtilities(){const sorted=[...data.utilityReadings].sort((a,b)=>(b.month+b.roomId).localeCompare(a.month+a.roomId));document.getElementById('view-utilities').innerHTML=`<div class="panel"><div class="panel-head"><div><h3>Chốt điện & nước theo tháng</h3><p>Đầu kỳ tự lấy từ chỉ số cuối kỳ gần nhất; chỉ nhập cuối kỳ để hệ thống tự trừ</p></div><button class="btn btn-primary" onclick="openUtilityForm()">+ Ghi chỉ số</button></div><div class="table-wrap"><table class="data-table"><thead><tr><th>Tháng</th><th>Phòng</th><th>Điện đầu → cuối</th><th>kWh</th><th>Tiền điện</th><th>Nước</th><th>Tiền nước</th><th>Phí khác</th><th></th></tr></thead><tbody>${sorted.length?sorted.map(u=>{const r=getRoom(u.roomId),p=getProperty(r?.propertyId);const hasInvoice=data.invoices.some(i=>i.readingId===u.id);return `<tr><td><strong>${esc(u.month)}</strong></td><td>${esc(p?.name||'')} · ${esc(r?.name||'-')}</td><td>${u.electricStart} → ${u.electricEnd}</td><td>${u.electricUnits} kWh</td><td>${money(u.electricAmount)}</td><td>${u.waterMode==='fixed'?'Cố định':`${u.waterStart} → ${u.waterEnd} (${u.waterUnits} m³)`}</td><td>${money(u.waterAmount)}</td><td>${money(u.otherFee)}</td><td><div class="table-actions"><button class="icon-btn" onclick="openUtilityForm('${u.id}')">Sửa</button><button class="icon-btn" onclick="openInvoiceForm('${u.id}')">${hasInvoice?'Xem/Lập lại HĐ':'Lập hóa đơn'}</button><button class="icon-btn danger" onclick="deleteReading('${u.id}')">Xóa</button></div></td></tr>`}).join(''):'<tr><td colspan="9"><div class="empty">Chưa có chỉ số điện nước. Chọn “Ghi chỉ số” để bắt đầu.</div></td></tr>'}</tbody></table></div></div>`}
window.deleteReading=function(id){if(!confirm('Xóa bản ghi điện nước này?'))return;data.utilityReadings=data.utilityReadings.filter(x=>x.id!==id);saveData();renderAdmin();showToast('Đã xóa chỉ số')}

// ---------- Invoices ----------
function calcInvoicePreview(){const roomId=document.getElementById('invoiceRoom').value,t=activeTenantForRoom(roomId);const dep=t?Math.max(0,t.depositRequired-t.depositPaid):0;const include=document.getElementById('invoiceIncludeDeposit').value==='true';const total=['invoiceRent','invoiceElectric','invoiceWater','invoiceOther'].reduce((s,id)=>s+Number(document.getElementById(id).value||0),0)+(include?dep:0);document.getElementById('invoiceTotalPreview').textContent=money(total);return{total,depositAmount:include?dep:0}}
window.openInvoiceForm=function(readingId=null){if(!data.rooms.length){showToast('Chưa có phòng.');return}const u=readingId?getReading(readingId):null;const roomId=u?.roomId||data.rooms.find(r=>activeTenantForRoom(r.id))?.id||data.rooms[0].id;const r=getRoom(roomId),t=activeTenantForRoom(roomId);if(!t){showToast('Phòng này chưa có người thuê đang hoạt động. Hãy tạo người thuê trước.');return}const existing=data.invoices.find(i=>i.roomId===roomId&&i.month===(u?.month||monthNow()));document.getElementById('invoiceReadingId').value=u?.id||existing?.readingId||'';document.getElementById('invoiceRoom').innerHTML=roomOptionHtml(roomId);document.getElementById('invoiceMonth').value=u?.month||existing?.month||monthNow();document.getElementById('invoiceDueDate').value=existing?.dueDate||nextDayISO(Number(data.settings.defaultDueDay||5));document.getElementById('invoiceRent').value=existing?.rent??r.price??0;document.getElementById('invoiceElectric').value=existing?.electric??u?.electricAmount??0;document.getElementById('invoiceWater').value=existing?.water??u?.waterAmount??0;document.getElementById('invoiceOther').value=existing?.other??u?.otherFee??0;document.getElementById('invoiceIncludeDeposit').value=String((existing?.depositAmount||0)>0);calcInvoicePreview();openModal('invoiceModal')}
function renderInvoices(){const sorted=[...data.invoices].sort((a,b)=>(b.month+b.createdAt).localeCompare(a.month+a.createdAt));const debt=sorted.reduce((s,i)=>s+remainingInvoice(i),0);document.getElementById('view-invoices').innerHTML=`<div class="panel"><div class="panel-head"><div><h3>Hóa đơn & công nợ</h3><p>Tổng còn phải thu: ${money(debt)}</p></div><button class="btn btn-primary" onclick="openInvoiceForm()">+ Lập hóa đơn</button></div><div class="table-wrap"><table class="data-table"><thead><tr><th>Tháng</th><th>Người thuê</th><th>Căn / Phòng</th><th>Tiền phòng</th><th>Điện</th><th>Nước</th><th>Cọc</th><th>Tổng</th><th>Đã thu</th><th>Còn lại</th><th>Hạn</th><th>Trạng thái</th><th></th></tr></thead><tbody>${sorted.length?sorted.map(i=>{const t=getTenant(i.tenantId),r=getRoom(i.roomId),p=getProperty(r?.propertyId);return `<tr><td><strong>${esc(i.month)}</strong></td><td>${esc(t?.name||'')}<br><span style="color:var(--muted)">${esc(t?.phone||'')}</span></td><td>${esc(p?.name||'')} · ${esc(r?.name||'-')}</td><td>${money(i.rent)}</td><td>${money(i.electric)}</td><td>${money(i.water)}</td><td>${money(i.depositAmount)}</td><td><strong>${money(i.total)}</strong></td><td>${money(i.amountPaid)}</td><td><strong>${money(remainingInvoice(i))}</strong></td><td>${esc(i.dueDate||'-')}</td><td>${invoiceBadge(i)}</td><td><div class="table-actions"><button class="icon-btn" onclick="recordPayment('${i.id}')">Thanh toán</button><button class="icon-btn" onclick="copyZaloReminder('${i.id}')">Nhắc Zalo</button><button class="icon-btn danger" onclick="deleteInvoice('${i.id}')">Xóa</button></div></td></tr>`}).join(''):'<tr><td colspan="13"><div class="empty">Chưa có hóa đơn.</div></td></tr>'}</tbody></table></div></div>`}
window.recordPayment=function(id){const i=getInvoice(id);if(!i)return;const value=prompt(`Nhập TỔNG số tiền khách đã thanh toán cho hóa đơn này.\nTổng hóa đơn: ${money(i.total)}`,String(i.amountPaid||0));if(value===null)return;const oldApplied=!!i.depositApplied;i.amountPaid=Math.max(0,Math.min(Number(value||0),Number(i.total||0)));i.status=i.amountPaid>=i.total?'paid':i.amountPaid>0?'partial':'unpaid';const t=getTenant(i.tenantId);if(i.status==='paid'&&i.depositAmount>0&&!oldApplied&&t){t.depositPaid=Math.min(t.depositRequired,t.depositPaid+i.depositAmount);i.depositApplied=true}else if(i.status!=='paid'&&oldApplied&&t){t.depositPaid=Math.max(0,t.depositPaid-i.depositAmount);i.depositApplied=false}saveData();renderAdmin();if(currentResidentId===i.tenantId)renderResident();showToast('Đã cập nhật thanh toán')}
window.deleteInvoice=function(id){if(!confirm('Xóa hóa đơn này?'))return;const i=getInvoice(id),t=getTenant(i?.tenantId);if(i?.depositApplied&&t)t.depositPaid=Math.max(0,t.depositPaid-i.depositAmount);data.invoices=data.invoices.filter(x=>x.id!==id);saveData();renderAdmin();showToast('Đã xóa hóa đơn')}
window.copyZaloReminder=function(id){const i=getInvoice(id);if(!i)return;const t=getTenant(i.tenantId),r=getRoom(i.roomId),p=getProperty(r?.propertyId);const text=`Xin chào ${t?.name||'anh/chị'}, ${data.settings.managerName||'quản lý'} nhắc hóa đơn tháng ${i.month} của phòng ${r?.name||''} - ${p?.name||''}.\nTiền phòng: ${money(i.rent)}\nTiền điện: ${money(i.electric)}\nTiền nước: ${money(i.water)}\nPhí khác: ${money(i.other)}${i.depositAmount?`\nTiền cọc: ${money(i.depositAmount)}`:''}\nTổng: ${money(i.total)}\nĐã thanh toán: ${money(i.amountPaid)}\nCòn lại: ${money(remainingInvoice(i))}\nHạn thanh toán: ${i.dueDate||'-'}.\nCảm ơn anh/chị.`;copyText(text,'Đã sao chép tin nhắn. Có thể dán vào Zalo của khách.')}
function copyText(text,msg){if(navigator.clipboard?.writeText){navigator.clipboard.writeText(text).then(()=>showToast(msg)).catch(()=>fallbackCopy(text,msg))}else fallbackCopy(text,msg)}
function fallbackCopy(text,msg){const ta=document.createElement('textarea');ta.value=text;document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove();showToast(msg)}

// ---------- Appointments ----------
function appointmentCard(a){const r=getRoom(a.roomId),p=getProperty(r?.propertyId);const d=new Date(`${a.date}T00:00:00`);return `<div class="appointment-card"><div class="appt-date"><strong>${String(d.getDate()).padStart(2,'0')}</strong><small>TH${d.getMonth()+1}</small></div><div class="appt-info"><strong>${esc(a.customerName)} · ${esc(a.customerPhone)}</strong><span>${esc(p?.name||'')} · ${esc(r?.name||'-')} · ${esc(a.time)}</span><small>${esc(a.note||'Không ghi chú')}</small></div><div class="appt-actions"><select class="select-small" onchange="updateAppointmentStatus('${a.id}',this.value)"><option value="new" ${a.status==='new'?'selected':''}>Mới</option><option value="confirmed" ${a.status==='confirmed'?'selected':''}>Đã xác nhận</option><option value="done" ${a.status==='done'?'selected':''}>Đã xem</option><option value="cancelled" ${a.status==='cancelled'?'selected':''}>Đã hủy</option></select><button class="icon-btn danger" onclick="deleteAppointment('${a.id}')">Xóa</button></div></div>`}
function renderAppointments(){const sorted=[...data.appointments].sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time));document.getElementById('view-appointments').innerHTML=`<div class="panel"><div class="panel-head"><div><h3>Toàn bộ lịch hẹn</h3><p>${sorted.length} lịch · ${sorted.filter(a=>a.status==='new').length} lịch mới</p></div></div>${sorted.length?sorted.map(appointmentCard).join(''):'<div class="empty">Chưa có khách đặt lịch.</div>'}</div>`}
window.updateAppointmentStatus=function(id,status){const a=data.appointments.find(x=>x.id===id);if(!a)return;a.status=status;saveData();renderAdmin();showToast('Đã cập nhật lịch hẹn')}
window.deleteAppointment=function(id){if(!confirm('Xóa lịch hẹn này?'))return;data.appointments=data.appointments.filter(a=>a.id!==id);saveData();renderAdmin();showToast('Đã xóa lịch hẹn')}

// ---------- Settings / export ----------
function renderSettings(){
  const cfg=Sync.cfg||{},connected=Sync.isOn();
  const roleText=Sync.isAdmin()?'Quản lý (đọc & ghi)':connected?'Chỉ xem':'Chưa kết nối';
  const last=Sync.state?.lastOk?new Date(Sync.state.lastOk).toLocaleString('vi-VN'):'chưa lần nào';
  document.getElementById('view-settings').innerHTML=`<div class="settings-grid">
  <div class="conn-card" style="grid-column:1/-1">
    ${Sync.embedded()?`
    <h3>Đồng bộ Google Sheets</h3>
    <p class="muted-text">Website này chạy thẳng trên Google của anh nên đã nối sẵn với bảng dữ liệu — không cần cài thêm gì. Gửi đúng đường dẫn này cho khách xem phòng và cho cư dân đăng nhập.</p>
    <label>Đổi mật khẩu quản lý</label>
    <input id="cfgNewPass" type="password" placeholder="Mật khẩu mới, ít nhất 4 ký tự">
    <div class="conn-actions">
      <button class="btn btn-primary" onclick="changeAdminPassword()">Lưu mật khẩu mới</button>
      <button class="btn btn-light" onclick="Sync.cycle(true)">Đồng bộ ngay</button>
      <button class="btn btn-danger" onclick="forgetAdminKey()">Thoát quyền quản lý</button>
    </div>`:`
    <h3>Kết nối Google Sheets</h3>
    <p class="muted-text">Để nguyên <b>/api/sheets</b> nếu chạy trên Vercel (đường dẫn Apps Script khai ở biến môi trường APPS_SCRIPT_URL). Hosting khác thì dán đường dẫn /exec đầy đủ.</p>
    <label>Đường dẫn máy chủ</label>
    <input id="cfgApiUrl" placeholder="/api/sheets" value="${esc(cfg.apiUrl||'')}">
    <label>Mật khẩu quản lý (để trống nếu chỉ xem)</label>
    <input id="cfgWriteKey" type="password" placeholder="Mật khẩu quản lý">
    <div class="conn-actions">
      <button class="btn btn-primary" onclick="connectSheets('pull')">Kết nối & lấy dữ liệu từ Sheets</button>
      <button class="btn btn-light" onclick="connectSheets('push')">Kết nối & đẩy dữ liệu máy này lên</button>
      <button class="btn btn-light" onclick="Sync.cycle(true)">Đồng bộ ngay</button>
      <button class="btn btn-danger" onclick="forgetAdminKey()">Thoát quyền quản lý</button>
    </div>`}
    <div class="conn-state">Trạng thái: <b>${roleText}</b> · Đồng bộ gần nhất: <b>${last}</b>${Sync.lastError?` · Lỗi: <b>${esc(Sync.lastError)}</b>`:''}</div>
  </div>
  <div class="settings-card"><h3>Thông tin quản lý</h3>
    <label style="display:block;font-size:12px;color:var(--muted);margin:10px 0 4px">Tên hiển thị khi nhắc thu tiền</label>
    <input id="setManagerName" value="${esc(data.settings.managerName||'')}" style="width:100%;padding:11px;border:1px solid var(--line);border-radius:11px;font:inherit">
    <label style="display:block;font-size:12px;color:var(--muted);margin:10px 0 4px">Số điện thoại</label>
    <input id="setManagerPhone" value="${esc(data.settings.managerPhone||'')}" style="width:100%;padding:11px;border:1px solid var(--line);border-radius:11px;font:inherit">
    <label style="display:block;font-size:12px;color:var(--muted);margin:10px 0 4px">Số ngày tới hạn mặc định</label>
    <input id="setDueDay" type="number" min="1" max="28" value="${Number(data.settings.defaultDueDay||5)}" style="width:100%;padding:11px;border:1px solid var(--line);border-radius:11px;font:inherit">
    <button class="btn btn-primary" style="margin-top:12px" onclick="saveManagerSettings()">Lưu thông tin</button>
  </div>
  <div class="settings-card"><h3>Nhắc thanh toán qua Zalo</h3><p>Mỗi hóa đơn có nút “Nhắc Zalo”: hệ thống soạn sẵn tiền phòng, điện, nước, cọc, số còn lại và hạn thanh toán để anh sao chép gửi khách.</p><div class="code-note">Gửi Zalo tự động cần Zalo Official Account + backend riêng. Không đặt access token Zalo trong file web công khai.</div></div>
  <div class="settings-card"><h3>Sao lưu dữ liệu</h3><p>Tải căn trọ, phòng, người thuê, điện nước, hóa đơn và lịch hẹn về máy dạng JSON.</p><button class="btn btn-light" onclick="exportData()">Tải file sao lưu</button></div>
  <div class="settings-card"><h3>Khôi phục dữ liệu</h3><p>Nhập lại file JSON đã sao lưu. Nếu đang kết nối Sheets, dữ liệu này sẽ được đẩy lên Sheets ở lần đồng bộ kế tiếp.</p><input type="file" id="importFile" accept="application/json" style="margin:8px 0 12px"><button class="btn btn-light" onclick="importData()">Nhập dữ liệu</button></div>
  <div class="settings-card"><h3>Xuất danh sách phòng CSV</h3><p>Mở bằng Excel để kiểm tra giá, tình trạng phòng và đơn giá điện nước.</p><button class="btn btn-light" onclick="exportRoomsCSV()">Xuất CSV</button></div>
  <div class="settings-card"><h3>Khôi phục dữ liệu mẫu</h3><p>Xóa dữ liệu trên máy này và nạp lại bản demo. Nếu đang kết nối Sheets, thao tác này cũng ghi đè dữ liệu chung — cân nhắc trước khi dùng.</p><button class="btn btn-danger" onclick="resetDemo()">Khôi phục bản demo</button></div>
</div>`}
window.saveManagerSettings=function(){
  data.settings.managerName=document.getElementById('setManagerName').value.trim();
  data.settings.managerPhone=document.getElementById('setManagerPhone').value.trim();
  data.settings.defaultDueDay=Number(document.getElementById('setDueDay').value||5);
  saveData();renderAdmin();showToast('Đã lưu thông tin quản lý');
}
window.connectSheets=async function(mode){
  const apiUrl=document.getElementById('cfgApiUrl').value.trim();
  const pass=document.getElementById('cfgWriteKey').value.trim();
  if(!apiUrl){showToast('Chưa nhập đường dẫn Apps Script');return}
  if(mode==='push'&&!confirm('Đẩy toàn bộ dữ liệu trên máy này lên Google Sheets? Dữ liệu trùng mã trên Sheets sẽ bị ghi đè.'))return;
  if(mode==='pull'&&!confirm('Lấy dữ liệu từ Google Sheets? Dữ liệu đang lưu trên máy này sẽ được thay bằng dữ liệu trên Sheets.'))return;
  showToast('Đang kết nối…');
  try{
    Sync.saveCfg({apiUrl});
    if(pass)await Sync.adminLogin(pass);
    const res=await Sync.connect({apiUrl,mode});
    renderAdmin();renderPublic();
    showToast(res.mode==='pull'?'Đã lấy dữ liệu từ Google Sheets':'Đã đẩy dữ liệu lên Google Sheets');
  }catch(err){showToast('Kết nối lỗi: '+(err.message||err))}
}
window.changeAdminPassword=async function(){
  const np=document.getElementById('cfgNewPass').value.trim();
  if(np.length<4){showToast('Mật khẩu cần ít nhất 4 ký tự');return}
  try{await Sync.changePassword(np);document.getElementById('cfgNewPass').value='';showToast('Đã đổi mật khẩu quản lý')}
  catch(err){showToast('Không đổi được: '+(err.message||err))}
}
window.forgetAdminKey=function(){
  if(!confirm('Thoát quyền quản lý trên máy này? Máy sẽ chỉ còn quyền xem phòng.'))return;
  Sync.disconnect();showPublic();showToast('Đã thoát quyền quản lý trên máy này');
}
window.exportData=function(){const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});downloadBlob(blob,'huy-rooms-backup-v2.json')}
window.importData=function(){const f=document.getElementById('importFile')?.files?.[0];if(!f){showToast('Chọn file JSON trước.');return}const reader=new FileReader();reader.onload=()=>{try{data=migrateData(JSON.parse(reader.result));saveData();renderAdmin();renderPublic();showToast('Đã khôi phục dữ liệu')}catch(e){showToast('File dữ liệu không hợp lệ')}};reader.readAsText(f)}
window.exportRoomsCSV=function(){const header=['Can tro','Dia chi','Phong','Loai','Dien tich','Gia thang','Tien coc','Trang thai','Gia dien','Cach tinh nuoc','Gia nuoc','Nuoc co dinh'];const rows=data.rooms.map(r=>{const p=getProperty(r.propertyId);return[p?.name||'',p?.address||'',r.name,r.type,r.area,r.price,r.deposit,statusLabel(r.status),r.electricRate,r.waterMode,r.waterRate,r.waterFixed]});const csv='\ufeff'+[header,...rows].map(row=>row.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(',')).join('\n');downloadBlob(new Blob([csv],{type:'text/csv;charset=utf-8'}),'danh-sach-phong.csv')}
function downloadBlob(blob,name){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
window.resetDemo=function(){if(!confirm('Khôi phục dữ liệu mẫu và xóa các thay đổi nghiệp vụ hiện tại?'))return;data=migrateData(structuredClone(demoData));saveData();renderAdmin();renderPublic();showToast('Đã khôi phục dữ liệu mẫu')}

// ---------- Form handlers ----------
document.querySelectorAll('[data-close-modal]').forEach(el=>el.addEventListener('click',()=>closeModal(el.dataset.closeModal)));
document.getElementById('bookingForm').addEventListener('submit',e=>{e.preventDefault();data.appointments.unshift({id:uid('a'),roomId:document.getElementById('bookingRoomId').value,customerName:document.getElementById('customerName').value.trim(),customerPhone:document.getElementById('customerPhone').value.trim(),date:document.getElementById('appointmentDate').value,time:document.getElementById('appointmentTime').value,note:document.getElementById('customerNote').value.trim(),status:'new',createdAt:new Date().toISOString()});saveData();e.target.reset();closeModal('bookingModal');renderAdmin();showToast('Đã gửi yêu cầu. Quản lý sẽ liên hệ xác nhận.')});

document.getElementById('propertyImages').addEventListener('change',e=>{propertyImageState.newFiles.push(...[...e.target.files]);renderImageEditor('property')});
document.getElementById('roomImages').addEventListener('change',e=>{roomImageState.newFiles.push(...[...e.target.files]);renderImageEditor('room')});
document.getElementById('propertyForm').addEventListener('submit',async e=>{e.preventDefault();const id=document.getElementById('propertyId').value;const imageIds=await commitImageState(propertyImageState);const item={id:id||uid('p'),name:document.getElementById('propertyName').value.trim(),area:document.getElementById('propertyArea').value.trim(),address:document.getElementById('propertyAddress').value.trim(),description:document.getElementById('propertyDescription').value.trim(),phone:document.getElementById('propertyPhone').value.trim(),imageIds};if(id)Object.assign(getProperty(id),item);else data.properties.push(item);saveData();closeModal('propertyModal');renderAdmin();renderPublic();showToast(id?'Đã cập nhật căn trọ và ảnh':'Đã thêm căn trọ')});
document.getElementById('roomForm').addEventListener('submit',async e=>{e.preventDefault();const id=document.getElementById('roomId').value;const imageIds=await commitImageState(roomImageState);const item={id:id||uid('r'),propertyId:document.getElementById('roomProperty').value,name:document.getElementById('roomName').value.trim(),price:Number(document.getElementById('roomPrice').value||0),deposit:Number(document.getElementById('roomDeposit').value||0),area:Number(document.getElementById('roomArea').value||0),capacity:Number(document.getElementById('roomCapacity').value||1),type:document.getElementById('roomType').value,status:document.getElementById('roomStatus').value,electricRate:Number(document.getElementById('roomElectricRate').value||0),waterMode:document.getElementById('roomWaterMode').value,waterRate:Number(document.getElementById('roomWaterRate').value||0),waterFixed:Number(document.getElementById('roomWaterFixed').value||0),amenities:document.getElementById('roomAmenities').value.split(',').map(x=>x.trim()).filter(Boolean),note:document.getElementById('roomNote').value.trim(),imageIds};if(id)Object.assign(getRoom(id),item);else data.rooms.push(item);saveData();closeModal('roomModal');renderAdmin();renderPublic();showToast(id?'Đã cập nhật phòng và ảnh':'Đã thêm phòng')});
document.getElementById('tenantRoom').addEventListener('change',()=>{const r=getRoom(document.getElementById('tenantRoom').value);if(!document.getElementById('tenantId').value)document.getElementById('tenantDepositRequired').value=r?.deposit||0});
document.getElementById('tenantForm').addEventListener('submit',e=>{e.preventDefault();const id=document.getElementById('tenantId').value,roomId=document.getElementById('tenantRoom').value;const existingActive=activeTenantForRoom(roomId);if(existingActive&&existingActive.id!==id&&document.getElementById('tenantActive').value==='true'){showToast('Phòng này đang có người thuê hoạt động. Hãy kết thúc người thuê cũ trước.');return}const item={id:id||uid('t'),name:document.getElementById('tenantName').value.trim(),phone:document.getElementById('tenantPhone').value.trim(),pin:document.getElementById('tenantPin').value.trim(),roomId,moveInDate:document.getElementById('tenantMoveIn').value,active:document.getElementById('tenantActive').value==='true',depositRequired:Number(document.getElementById('tenantDepositRequired').value||0),depositPaid:Number(document.getElementById('tenantDepositPaid').value||0),note:document.getElementById('tenantNote').value.trim()};if(id)Object.assign(getTenant(id),item);else data.tenants.push(item);const r=getRoom(roomId);if(r&&item.active)r.status='occupied';saveData();closeModal('tenantModal');renderAdmin();renderPublic();showToast(id?'Đã cập nhật người thuê':'Đã tạo người thuê & tài khoản cư dân')});
['utilityRoom','utilityMonth'].forEach(id=>document.getElementById(id).addEventListener('change',()=>smartPrefillUtility(true)));
['electricStart','electricEnd','electricRate','waterMode','waterStart','waterEnd','waterRate','waterFixed'].forEach(id=>document.getElementById(id).addEventListener('input',calcUtilityFromForm));
document.getElementById('waterMode').addEventListener('change',calcUtilityFromForm);
document.getElementById('utilityForm').addEventListener('submit',e=>{e.preventDefault();const id=document.getElementById('utilityId').value,roomId=document.getElementById('utilityRoom').value,month=document.getElementById('utilityMonth').value;const es=Number(document.getElementById('electricStart').value||0),ee=Number(document.getElementById('electricEnd').value||0),ws=Number(document.getElementById('waterStart').value||0),we=Number(document.getElementById('waterEnd').value||0),wm=document.getElementById('waterMode').value;if(ee<es){showToast('Chỉ số điện cuối kỳ phải lớn hơn hoặc bằng đầu kỳ.');return}if(wm==='meter'&&we<ws){showToast('Chỉ số nước cuối kỳ phải lớn hơn hoặc bằng đầu kỳ.');return}const calc=calcUtilityFromForm();const existingSame=data.utilityReadings.find(u=>u.roomId===roomId&&u.month===month&&u.id!==id);if(existingSame&&!confirm('Phòng này đã có chỉ số trong tháng. Vẫn lưu thêm bản ghi?'))return;const item={id:id||uid('u'),roomId,month,electricStart:es,electricEnd:ee,electricRate:Number(document.getElementById('electricRate').value||0),electricUnits:calc.electricUnits,electricAmount:calc.electricAmount,waterMode:wm,waterStart:ws,waterEnd:we,waterRate:Number(document.getElementById('waterRate').value||0),waterFixed:Number(document.getElementById('waterFixed').value||0),waterUnits:calc.waterUnits,waterAmount:calc.waterAmount,otherFee:Number(document.getElementById('utilityOtherFee').value||0),note:document.getElementById('utilityNote').value.trim(),createdAt:new Date().toISOString()};if(id)Object.assign(getReading(id),item);else data.utilityReadings.push(item);saveData();closeModal('utilityModal');renderAdmin();showToast(`Đã lưu: điện ${money(item.electricAmount)}, nước ${money(item.waterAmount)}`)});
['invoiceRent','invoiceElectric','invoiceWater','invoiceOther','invoiceIncludeDeposit'].forEach(id=>document.getElementById(id).addEventListener('input',calcInvoicePreview));document.getElementById('invoiceIncludeDeposit').addEventListener('change',calcInvoicePreview);
document.getElementById('invoiceRoom').addEventListener('change',()=>{const roomId=document.getElementById('invoiceRoom').value,r=getRoom(roomId);document.getElementById('invoiceRent').value=r?.price||0;calcInvoicePreview()});
document.getElementById('invoiceForm').addEventListener('submit',e=>{e.preventDefault();const roomId=document.getElementById('invoiceRoom').value,month=document.getElementById('invoiceMonth').value,t=activeTenantForRoom(roomId);if(!t){showToast('Phòng chưa có người thuê đang hoạt động.');return}const calc=calcInvoicePreview();let item=data.invoices.find(i=>i.roomId===roomId&&i.month===month);if(item&&item.status==='paid'&&!confirm('Hóa đơn này đã thanh toán. Bạn vẫn muốn cập nhật lại?'))return;const values={tenantId:t.id,roomId,readingId:document.getElementById('invoiceReadingId').value||'',month,dueDate:document.getElementById('invoiceDueDate').value,rent:Number(document.getElementById('invoiceRent').value||0),electric:Number(document.getElementById('invoiceElectric').value||0),water:Number(document.getElementById('invoiceWater').value||0),other:Number(document.getElementById('invoiceOther').value||0),depositAmount:calc.depositAmount,total:calc.total,createdAt:item?.createdAt||new Date().toISOString()};if(item){Object.assign(item,values);item.amountPaid=Math.min(item.amountPaid||0,item.total);item.status=item.amountPaid>=item.total?'paid':item.amountPaid>0?'partial':'unpaid'}else{item={id:uid('i'),...values,amountPaid:0,status:'unpaid',depositApplied:false};data.invoices.push(item)}saveData();closeModal('invoiceModal');renderAdmin();if(currentResidentId===t.id)renderResident();showToast('Đã tạo/cập nhật hóa đơn')});

// Drag & drop ảnh
document.querySelectorAll('.upload-zone').forEach(zone=>{const input=zone.querySelector('input[type=file]');['dragenter','dragover'].forEach(evt=>zone.addEventListener(evt,e=>{e.preventDefault();zone.style.borderColor='#9f8974'}));['dragleave','drop'].forEach(evt=>zone.addEventListener(evt,e=>{e.preventDefault();zone.style.borderColor=''}));zone.addEventListener('drop',e=>{const files=[...e.dataTransfer.files].filter(f=>f.type.startsWith('image/'));if(!files.length)return;if(input.id==='propertyImages')propertyImageState.newFiles.push(...files);else roomImageState.newFiles.push(...files);renderImageEditor(input.id==='propertyImages'?'property':'room')})});

// ---------- Login events ----------
['adminBtn'].forEach(id=>document.getElementById(id).addEventListener('click',()=>openModal('loginModal')));
['residentBtn','heroResidentBtn'].forEach(id=>document.getElementById(id).addEventListener('click',()=>openModal('residentLoginModal')));
document.getElementById('loginForm').addEventListener('submit',async e=>{
  e.preventDefault();
  const field=document.getElementById('adminPassword'),value=field.value.trim();
  if(Sync.isOn()){
    showToast('Đang kiểm tra mật khẩu…');
    try{
      const res=await Sync.adminLogin(value);
      field.value='';closeModal('loginModal');showAdmin();
      await Sync.fullPull();renderAdmin();renderPublic();
      showToast(res.mustChangePassword?'Đã vào quản lý — nên đổi mật khẩu trong Cài đặt':'Đã mở quyền quản lý trên máy này');
    }catch(err){showToast(err.message||'Mật khẩu chưa đúng')}
    return;
  }
  if(value===ADMIN_PASSWORD){field.value='';closeModal('loginModal');showAdmin()}
  else showToast('Mật khẩu chưa đúng. Bản chưa kết nối dùng: 123456')});
document.getElementById('residentLoginForm').addEventListener('submit',async e=>{
  e.preventDefault();
  const phone=normalizePhone(document.getElementById('residentPhone').value),pin=document.getElementById('residentPin').value.trim();
  const local=data.tenants.find(x=>normalizePhone(x.phone)===phone&&String(x.pin)===pin&&x.active);
  if(local){closeModal('residentLoginModal');e.target.reset();showResident(local.id);return}
  if(Sync.isOn()){
    showToast('Đang kiểm tra tài khoản…');
    try{
      const res=await Sync.residentLogin(phone,pin);
      mergeResidentBundle(res);
      closeModal('residentLoginModal');e.target.reset();showResident(res.tenant.id);return;
    }catch(err){showToast(err.message||'Số điện thoại hoặc mã PIN không đúng.');return}
  }
  showToast('Số điện thoại hoặc mã PIN không đúng.')});
function mergeResidentBundle(res){
  const put=(arr,item)=>{if(!item)return;const i=arr.findIndex(x=>x.id===item.id);if(i>=0)arr[i]=item;else arr.push(item)};
  put(data.tenants,Object.assign({pin:'',_temp:true},res.tenant));
  put(data.rooms,res.room);put(data.properties,res.property);
  (res.invoices||[]).forEach(i=>put(data.invoices,i));
  (res.readings||[]).forEach(u=>put(data.utilityReadings,u));
  if(res.settings)Object.assign(data.settings,res.settings);
}
document.getElementById('residentLogout').addEventListener('click',()=>{currentResidentId=null;data.tenants=data.tenants.filter(t=>!t._temp);showPublic()});document.getElementById('backPublic').addEventListener('click',showPublic);
document.getElementById('quickAddProperty').addEventListener('click',()=>openPropertyForm());document.getElementById('quickAddRoom').addEventListener('click',()=>openRoomForm());document.getElementById('quickAddTenant').addEventListener('click',()=>openTenantForm());

// ---------- Public filters ----------
['searchInput','areaFilter','statusFilter','priceFilter'].forEach(id=>document.getElementById(id).addEventListener(id==='searchInput'?'input':'change',()=>{publicFilters.q=document.getElementById('searchInput').value;publicFilters.area=document.getElementById('areaFilter').value;publicFilters.status=document.getElementById('statusFilter').value;publicFilters.maxPrice=Number(document.getElementById('priceFilter').value);renderPublic()}));
document.getElementById('resetFilters').addEventListener('click',()=>{publicFilters={q:'',area:'all',status:'all',maxPrice:999999999};document.getElementById('searchInput').value='';document.getElementById('statusFilter').value='all';document.getElementById('priceFilter').value='999999999';renderPublic()});
document.getElementById('heroSearchBtn').addEventListener('click',()=>{publicFilters.area=document.getElementById('heroAreaFilter').value;publicFilters.maxPrice=Number(document.getElementById('heroPriceFilter').value);publicFilters.status='available';document.getElementById('statusFilter').value='available';document.getElementById('priceFilter').value=String(publicFilters.maxPrice);renderPublic();document.getElementById('properties').scrollIntoView({behavior:'smooth'})});

// ---------- Giao diện điện thoại ----------
function syncTabbar(){
  const active=document.querySelector('.side-link.active')?.dataset.view||'dashboard';
  document.querySelectorAll('.mobile-tabbar button').forEach(b=>b.classList.toggle('active',b.dataset.view===active));
  const newAppts=data.appointments.filter(a=>a.status==='new').length;
  const tab=document.querySelector('.mobile-tabbar button[data-view="appointments"]');
  if(tab){tab.querySelector('.tab-badge')?.remove();if(newAppts)tab.insertAdjacentHTML('afterbegin',`<span class="tab-badge">${newAppts}</span>`)}
}
document.querySelectorAll('.mobile-tabbar button').forEach(b=>b.addEventListener('click',()=>switchAdminView(b.dataset.view)));
document.getElementById('mobileBackPublic')?.addEventListener('click',showPublic);
document.getElementById('mobileFab')?.addEventListener('click',()=>document.getElementById('fabSheet').classList.add('show'));
document.getElementById('fabSheet')?.addEventListener('click',e=>{
  const act=e.target.dataset?.fab;
  if(!act){if(e.target.id==='fabSheet')e.currentTarget.classList.remove('show');return}
  e.currentTarget.classList.remove('show');
  if(act==='property')openPropertyForm();
  else if(act==='room')openRoomForm();
  else if(act==='tenant')openTenantForm();
  else if(act==='utility')openUtilityForm();
  else if(act==='invoice')openInvoiceForm();
});

// ---------- Đồng bộ ----------
function timeAgo(ts){
  if(!ts)return'chưa lần nào';
  const m=Math.round((Date.now()-ts)/60000);
  if(m<1)return'vừa xong';if(m<60)return m+' phút trước';
  const h=Math.round(m/60);if(h<24)return h+' giờ trước';
  return new Date(ts).toLocaleDateString('vi-VN');
}
function updateSyncPill(st){
  const pill=document.getElementById('syncPill'),txt=document.getElementById('syncText');
  if(!pill)return;const s=st||{on:Sync.isOn(),busy:Sync.busy,error:Sync.lastError,lastOk:Sync.state?.lastOk};
  const adminOpen=!document.getElementById('adminApp').classList.contains('hidden');
  pill.style.display=(adminOpen||(s.on&&Sync.isAdmin()))?'inline-flex':'none';
  pill.className='sync-pill '+(!s.on?'off':s.busy?'busy':s.error?'err':'ok');
  txt.textContent=!s.on?'Chưa kết nối':s.busy?'Đang đồng bộ…':s.error?'Lỗi đồng bộ · bấm để thử lại':(Sync.isAdmin()?'Đã đồng bộ ':'Đang xem bản chung · ')+timeAgo(s.lastOk);
}
function looksLikeDemo(){
  const ids=x=>x.map(i=>i.id).join(',');
  return ids(data.properties)===ids(demoData.properties)&&ids(data.rooms)===ids(demoData.rooms);
}
function updateLoginHint(){
  const hint=document.getElementById('adminLoginHint'),field=document.getElementById('adminPassword'),label=document.getElementById('adminPasswordLabel');
  if(!hint)return;
  if(Sync.isOn()){
    hint.innerHTML='Nhập <strong>mật khẩu quản lý</strong>. Lần đầu là <strong>123456</strong> — vào Cài đặt đổi ngay sau khi đăng nhập.';
    field.placeholder='Nhập mật khẩu quản lý';
    label.childNodes[0].nodeValue='Mật khẩu quản lý';
  }else{
    hint.innerHTML='Chưa kết nối Google Sheets — dùng mật khẩu <strong>123456</strong> để mở bản trên máy này.';
  }
}
Sync.attach({
  getData:()=>data,
  saveLocal:saveLocal,
  rerender:()=>{renderAdmin();renderPublic();if(currentResidentId)renderResident()},
  toast:showToast
});
Sync.onStatus(updateSyncPill);
document.getElementById('syncPill').addEventListener('click',()=>{
  if(!Sync.isOn()){showToast('Vào Quản lý → Cài đặt để kết nối Google Sheets');return}
  Sync.cycle(true);
});
setInterval(()=>updateSyncPill(),30000);

if(Sync.isOn()&&!Sync.isAdmin()&&!(Sync.state.since>0)&&looksLikeDemo()){
  ['properties','rooms','tenants','utilityReadings','invoices','appointments'].forEach(c=>{data[c]=[]});
  Sync.baseline={};
}
saveLocal();
updateLoginHint();
updateSyncPill();
renderPublic();renderAdmin();
Sync.start();

if('serviceWorker' in navigator&&location.protocol==='https:'&&!Sync.embedded()){
  navigator.serviceWorker.register('sw.js').catch(()=>{});
}
