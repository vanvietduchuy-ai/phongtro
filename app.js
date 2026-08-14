const STORAGE_KEY='huy_rooms_v2';
const LEGACY_KEY='huy_rooms_v1';
const ADMIN_PASSWORD='123456'; // chỉ dùng cho bản chạy hoàn toàn trên máy, không có máy chủ
const IMG_DB='HuyRoomsMedia';
const IMG_STORE='images';
const RESIDENT_KEY='huy_rooms_resident_session';
const RESIDENT_TTL=12*60*60*1000; // phiên cư dân sống tối đa 12 giờ trên thiết bị
const DEMO_MODE=localStorage.getItem('huy_rooms_demo')==='1';
let currentResidentId=null; // chỉ dùng ở chế độ chạy hoàn toàn trên máy (không máy chủ)
let residentSession=null;   // phiên cư dân khi có máy chủ: tách hẳn khỏi kho dữ liệu quản trị
let publicFilters={q:'',area:'all',status:'all',maxPrice:999999999,minArea:0,type:'all',capacity:0,amenities:[],moveIn:''};
let propertyImageState={existing:[],removed:[],newFiles:[]};
let roomImageState={existing:[],removed:[],newFiles:[]};
const imageUrlCache=new Map();

function uid(prefix='id'){return prefix+Date.now().toString(36)+Math.random().toString(36).slice(2,7)}
function money(n){return new Intl.NumberFormat('vi-VN').format(Math.round(Number(n||0)))+'đ'}
function esc(s=''){return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
/** Ngày hiện tại theo giờ VIỆT NAM (Asia/Ho_Chi_Minh) — không dùng UTC (v4.1). */
function today(){
  try{return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())}
  catch(e){const d=new Date(Date.now()+7*3600000);return d.toISOString().slice(0,10)}
}
function monthNow(){return today().slice(0,7)}
function prevMonth(m){const [y,mo]=m.split('-').map(Number);const d=new Date(y,mo-2,1);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`}
function nextDayISO(days=7){const [y,m,dd]=today().split('-').map(Number);const d=new Date(Date.UTC(y,m-1,dd+days));return d.toISOString().slice(0,10)}
function daysUntil(date){if(!date)return 9999;const a=new Date(today()+'T00:00:00'),b=new Date(date+'T00:00:00');return Math.round((b-a)/86400000)}
function normalizePhone(v=''){return String(v).replace(/\D/g,'')}
function statusLabel(s){return({available:'Đang trống',reserved:'Đã giữ chỗ',occupied:'Đã thuê',maintenance:'Bảo trì'})[s]||'Không xác định'}
function apptStatusLabel(s){return({new:'Mới',confirmed:'Đã xác nhận',done:'Đã xem',cancelled:'Đã hủy'})[s]||s}
function billStatusLabel(s){return({unpaid:'Chưa thanh toán',partial:'Thanh toán một phần',paid:'Đã thanh toán',overdue:'Quá hạn'})[s]||s}
function showToast(msg){const t=document.getElementById('toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2600)}
function openModal(id){document.getElementById(id)?.classList.remove('hidden')}
function closeModal(id){document.getElementById(id)?.classList.add('hidden')}
function setBtnBusy(btn,busy,label){if(!btn)return;if(busy){if(!btn.dataset.orig)btn.dataset.orig=btn.textContent;btn.disabled=true;btn.classList.add('is-busy');if(label)btn.textContent=label}else{btn.disabled=false;btn.classList.remove('is-busy');if(btn.dataset.orig){btn.textContent=btn.dataset.orig;delete btn.dataset.orig}}}
function loadResidentSession(){try{const s=JSON.parse(sessionStorage.getItem(RESIDENT_KEY));if(s&&s.tenant&&Date.now()-(s.ts||0)<RESIDENT_TTL)return s}catch(e){}try{sessionStorage.removeItem(RESIDENT_KEY)}catch(e){}return null}
function saveResidentSession(sess){residentSession=sess;try{if(sess)sessionStorage.setItem(RESIDENT_KEY,JSON.stringify(sess));else sessionStorage.removeItem(RESIDENT_KEY)}catch(e){}}

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
  d.properties.forEach(p=>{p.archived=p.archived===true});
  d.rooms.forEach(r=>{r.archived=r.archived===true});
  d.tenants.forEach(t=>{t.active=t.active!==false;t.depositRequired=Number(t.depositRequired||0);t.depositPaid=Number(t.depositPaid||0);t.pin=String(t.pin||'');t.moveOutDate=t.moveOutDate||''});
  d.invoices.forEach(i=>{i.payments=Array.isArray(i.payments)?i.payments:[];i.leaseId=i.leaseId||''});
  // ---- v4 giai đoạn 2: hợp đồng, người ở, tài khoản, tài sản, bàn giao ----
  d.leases=Array.isArray(d.leases)?d.leases:[];
  d.leaseOccupants=Array.isArray(d.leaseOccupants)?d.leaseOccupants:[];
  d.accounts=Array.isArray(d.accounts)?d.accounts:[];
  d.assets=Array.isArray(d.assets)?d.assets:[];
  d.handoverItems=Array.isArray(d.handoverItems)?d.handoverItems:[];
  d.leases.forEach(l=>{l.status=l.status||'draft';l.rentAmount=Number(l.rentAmount||0);
    l.depositRequired=Number(l.depositRequired||0);l.depositPaid=Number(l.depositPaid||0);
    l.depositDeduct=Number(l.depositDeduct||0);l.depositRefund=Number(l.depositRefund||0);
    l.billingDay=Number(l.billingDay||5);
    l.roomHistory=Array.isArray(l.roomHistory)?l.roomHistory:[];
    l.renewals=Array.isArray(l.renewals)?l.renewals:[]});
  d.assets.forEach(a=>{a.quantity=Number(a.quantity||1);a.imageIds=Array.isArray(a.imageIds)?a.imageIds:[];a.archived=a.archived===true});
  d.handoverItems.forEach(h=>{h.quantity=Number(h.quantity||1);h.imageIds=Array.isArray(h.imageIds)?h.imageIds:[]});
  // ---- v4 giai đoạn 3: dịch vụ, sổ thanh toán, sổ cọc, nhắc nợ ----
  d.serviceDefinitions=Array.isArray(d.serviceDefinitions)?d.serviceDefinitions:[];
  d.leaseServices=Array.isArray(d.leaseServices)?d.leaseServices:[];
  d.payments=Array.isArray(d.payments)?d.payments:[];
  d.depositLedger=Array.isArray(d.depositLedger)?d.depositLedger:[];
  d.reminders=Array.isArray(d.reminders)?d.reminders:[];
  d.maintenanceTickets=Array.isArray(d.maintenanceTickets)?d.maintenanceTickets:[];
  d.notifications=Array.isArray(d.notifications)?d.notifications:[];
  d.staffUsers=Array.isArray(d.staffUsers)?d.staffUsers:[];
  d.auditLog=Array.isArray(d.auditLog)?d.auditLog:[];
  // Hàng rào ID: loại bản ghi có id lạ (phòng khi Sheet bị sửa tay chèn mã độc)
  const SAFE_ID=/^[A-Za-z0-9_-]{1,80}$/;
  ['properties','rooms','tenants','utilityReadings','invoices','appointments','leases','leaseOccupants','accounts','assets','handoverItems','serviceDefinitions','leaseServices','payments','depositLedger','reminders','maintenanceTickets','notifications','staffUsers'].forEach(k=>{
    if(Array.isArray(d[k]))d[k]=d[k].filter(x=>x&&SAFE_ID.test(String(x.id||'')));
  });
  d.maintenanceTickets.forEach(k=>{k.imageIds=Array.isArray(k.imageIds)?k.imageIds:[];k.statusHistory=Array.isArray(k.statusHistory)?k.statusHistory:[];k.priority=k.priority||'normal';k.status=k.status||'new'});
  d.serviceDefinitions.forEach(sv=>{sv.price=Number(sv.price||0);sv.taxPercent=Number(sv.taxPercent||0);sv.priceHistory=Array.isArray(sv.priceHistory)?sv.priceHistory:[];sv.archived=sv.archived===true});
  d.leaseServices.forEach(ls=>{ls.quantity=Number(ls.quantity||1);ls.priceOverride=Number(ls.priceOverride||0);ls.discountPercent=Number(ls.discountPercent||0);ls.discountAmount=Number(ls.discountAmount||0)});
  d.payments.forEach(p=>{p.amount=Number(p.amount||0);p.kind=p.kind||'payment'});
  d.depositLedger.forEach(x=>{x.amount=Number(x.amount||0)});
  d.utilityReadings.forEach(u=>{u.status=u.status||'final';u.imageIds=Array.isArray(u.imageIds)?u.imageIds:[];u.lockedAt=u.lockedAt||'';u.unlockNote=u.unlockNote||''});
  d.invoices.forEach(i=>{i.serviceLines=Array.isArray(i.serviceLines)?i.serviceLines:[];i.adjustAmount=Number(i.adjustAmount||0);i.adjustNote=i.adjustNote||'';i.code=i.code||'';i.issuedAt=i.issuedAt||''});
  // ---- v4 giai đoạn 5: slug, bán phòng & CRM ----
  const slugTaken=new Set();
  const mkSlug=(txt,fallback)=>{
    let base=slugifyVN(txt)||fallback;
    let out=base,n=1;
    while(slugTaken.has(out))out=base+'-'+(++n);
    slugTaken.add(out);return out;
  };
  d.properties.forEach(p=>{if(p.slug)slugTaken.add(p.slug)});
  d.rooms.forEach(r=>{if(r.slug)slugTaken.add(r.slug)});
  d.properties.forEach(p=>{if(!p.slug)p.slug=mkSlug(p.name,'can-'+p.id)});
  d.rooms.forEach(r=>{
    if(!r.slug){const p=d.properties.find(x=>x.id===r.propertyId);r.slug=mkSlug((p?p.name+' ':'')+r.name,'phong-'+r.id)}
    r.availableFrom=r.availableFrom||'';
    r.policies=r.policies||'';
  });
  const leadMap={confirmed:'appointment_confirmed',done:'viewed',cancelled:'lost'};
  d.appointments.forEach(a=>{
    if(leadMap[a.status])a.status=leadMap[a.status];
    a.source=a.source||'website';
    a.careLog=Array.isArray(a.careLog)?a.careLog:[];
    a.reserveAmount=Number(a.reserveAmount||0);
    a.reserveUntil=a.reserveUntil||'';
    a.convertedLeaseId=a.convertedLeaseId||'';
  });
  d.settings.workStart=/^\d{2}:\d{2}$/.test(d.settings.workStart||'')?d.settings.workStart:'08:00';
  d.settings.workEnd=/^\d{2}:\d{2}$/.test(d.settings.workEnd||'')?d.settings.workEnd:'20:00';
  d.settings.slotMinutes=[30,60].includes(Number(d.settings.slotMinutes))?Number(d.settings.slotMinutes):60;
  d.settings.zaloPhone=d.settings.zaloPhone||'';
  migrateLeasesLocal(d);
  migrateBillingLocal(d);
  return d;
}
/** Slug tiếng Việt: bỏ dấu, chữ thường, gạch nối. */
function slugifyVN(txt){
  return String(txt||'').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/đ/g,'d')
    .replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,60);
}
/** Giai đoạn 3 (bản cục bộ): chuyển payments json trên hóa đơn → sổ ThanhToan, cọc hợp đồng → SoCoc. Idempotent. */
function migrateBillingLocal(d){
  const payIds=new Set(d.payments.map(p=>p.id));
  d.invoices.forEach(inv=>{
    (Array.isArray(inv.payments)?inv.payments:[]).forEach((p,idx)=>{
      if(p.txId&&payIds.has(p.txId))return;               // mirror đã dựng lại từ sổ — bỏ qua
      const id='pay_mig_'+inv.id+'_'+idx;
      if(payIds.has(id))return;
      payIds.add(id);
      d.payments.push({id,invoiceId:inv.id,kind:'payment',amount:Number(p.amount||0),
        paidAt:String(p.date||p.at||inv.createdAt||'').slice(0,10),method:String(p.method||'cash'),
        reference:'',note:String(p.note||''),createdBy:'migration',reversedAt:'',reversalReason:'',reversalOf:'',
        createdAt:new Date().toISOString()});
    });
  });
  const depIds=new Set(d.depositLedger.map(x=>x.id));
  d.leases.forEach(l=>{
    if(Number(l.depositPaid)>0&&!depIds.has('dep_mig_'+l.id)&&!d.depositLedger.some(x=>x.leaseId===l.id&&x.type==='collect')){
      depIds.add('dep_mig_'+l.id);
      d.depositLedger.push({id:'dep_mig_'+l.id,leaseId:l.id,type:'collect',amount:Number(l.depositPaid),
        at:String(l.signedAt||l.startDate||'').slice(0,10),method:'cash',note:'Chuyển từ dữ liệu cọc trên hợp đồng',
        createdBy:'migration',createdAt:new Date().toISOString()});
    }
    if(l.status==='ended'){
      if(Number(l.depositDeduct)>0&&!depIds.has('depd_mig_'+l.id)&&!d.depositLedger.some(x=>x.leaseId===l.id&&x.type==='deduct')){
        depIds.add('depd_mig_'+l.id);
        d.depositLedger.push({id:'depd_mig_'+l.id,leaseId:l.id,type:'deduct',amount:Number(l.depositDeduct),
          at:String(l.moveOutAt||'').slice(0,10),method:'',note:l.settlementNote||'Trừ cọc khi thanh lý',createdBy:'migration',createdAt:new Date().toISOString()});
      }
      if(Number(l.depositRefund)>0&&!depIds.has('depr_mig_'+l.id)&&!d.depositLedger.some(x=>x.leaseId===l.id&&x.type==='refund')){
        depIds.add('depr_mig_'+l.id);
        d.depositLedger.push({id:'depr_mig_'+l.id,leaseId:l.id,type:'refund',amount:Number(l.depositRefund),
          at:String(l.moveOutAt||'').slice(0,10),method:'cash',note:'Hoàn cọc khi thanh lý',createdBy:'migration',createdAt:new Date().toISOString()});
      }
    }
  });
  d.invoices.forEach(i=>recomputeInvoiceIn(d,i));
}
/* ---------- Sổ thanh toán (ledger): amountPaid & trạng thái tính từ giao dịch ---------- */
function ledgerOf(invoiceId,d=data){return d.payments.filter(p=>p.invoiceId===invoiceId)}
function paidOfInvoice(invoiceId,d=data){return ledgerOf(invoiceId,d).reduce((s,p)=>s+Number(p.amount||0),0)}
function recomputeInvoiceIn(d,inv){
  const paid=Math.max(0,paidOfInvoice(inv.id,d));
  inv.amountPaid=Math.min(paid,Number(inv.total||0));
  inv.status=Number(inv.total)>0&&paid>=Number(inv.total)?'paid':paid>0?'partial':'unpaid';
  // mirror chỉ để hiển thị (cổng cư dân) — sổ ThanhToan mới là nguồn sự thật
  inv.payments=ledgerOf(inv.id,d).filter(p=>p.kind==='payment').map(p=>({txId:p.id,amount:p.amount,date:p.paidAt,method:p.method,note:p.note,reversed:!!p.reversedAt}));
}
function recomputeInvoice(inv){recomputeInvoiceIn(data,inv)}
function addPayment(invoiceId,{amount,paidAt,method,reference,note}){
  const inv=getInvoice(invoiceId);if(!inv)return null;
  const tx={id:uid('pay'),invoiceId,kind:'payment',amount:Number(amount||0),paidAt:paidAt||today(),
    method:method||'cash',reference:String(reference||''),note:String(note||''),
    createdBy:Sync.isAdmin&&Sync.isAdmin()?'admin':'local',reversedAt:'',reversalReason:'',reversalOf:'',
    createdAt:new Date().toISOString()};
  data.payments.push(tx);
  auditLocal('create','payments',tx.id,null,{amount:tx.amount,kind:tx.kind});
  recomputeInvoice(inv);
  return tx;
}
/** Giao dịch đã ghi thì không sửa/xóa — sai thì tạo GIAO DỊCH ĐẢO. */
function reversePayment(txId,reason){
  const tx=data.payments.find(p=>p.id===txId);
  if(!tx||tx.kind!=='payment')return null;
  if(tx.reversedAt){showToast('Giao dịch này đã được đảo trước đó.');return null}
  const rev={id:uid('rev'),invoiceId:tx.invoiceId,kind:'reversal',amount:-Number(tx.amount||0),
    paidAt:today(),method:tx.method,reference:tx.reference,note:'Đảo giao dịch '+tx.id+(reason?': '+reason:''),
    createdBy:Sync.isAdmin&&Sync.isAdmin()?'admin':'local',reversedAt:'',reversalReason:'',reversalOf:tx.id,
    createdAt:new Date().toISOString()};
  tx.reversedAt=new Date().toISOString();tx.reversalReason=String(reason||'');
  data.payments.push(rev);
  auditLocal('create','payments',rev.id,{amount:tx.amount},{amount:rev.amount,kind:'reversal',reversalOf:tx.id});
  const inv=getInvoice(tx.invoiceId);if(inv)recomputeInvoice(inv);
  return rev;
}
/* ---------- Sổ cọc: tách hẳn khỏi doanh thu tiền phòng ---------- */
function depositEntries(leaseId){return data.depositLedger.filter(x=>x.leaseId===leaseId).sort((a,b)=>String(a.at).localeCompare(b.at))}
function depositTotals(leaseId){
  const t={collect:0,refund:0,deduct:0};
  depositEntries(leaseId).forEach(x=>{t[x.type]=(t[x.type]||0)+Number(x.amount||0)});
  t.held=t.collect-t.refund-t.deduct;
  return t;
}
function addDepositEntry(leaseId,type,amount,method,note,at){
  const e={id:uid('dep'),leaseId,type,amount:Number(amount||0),at:at||today(),method:method||'cash',
    note:String(note||''),createdBy:'admin',createdAt:new Date().toISOString()};
  data.depositLedger.push(e);
  const l=getLease(leaseId);
  if(l){const t=depositTotals(leaseId);l.depositPaid=t.collect-t.refund}
  return e;
}
/* ---------- Dịch vụ: giá theo tháng (đổi giá tháng sau không đụng hóa đơn tháng trước) ---------- */
function getService(id){return data.serviceDefinitions.find(x=>x.id===id)}
function servicePriceForMonth(svc,month){
  if(!svc)return 0;
  const hist=(svc.priceHistory||[]).filter(h=>h.from&&h.from<=month).sort((a,b)=>a.from.localeCompare(b.from));
  if(hist.length)return Number(hist[hist.length-1].price||0);
  return Number(svc.price||0);
}
function calcTypeLabel(t){return({meter:'Theo đồng hồ',fixed:'Cố định / phòng',perPerson:'Theo người',perUnit:'Theo số lượng',manual:'Nhập tay'})[t]||t}
function leaseServicesOf(leaseId,month){
  return data.leaseServices.filter(ls=>ls.leaseId===leaseId&&
    (!ls.effectiveFrom||ls.effectiveFrom.slice(0,7)<=month)&&
    (!ls.endedAt||ls.endedAt.slice(0,7)>=month));
}
/** Tính các dòng dịch vụ của một hợp đồng cho một tháng (giá chốt theo tháng). */
function serviceLinesFor(lease,month,manualAmounts={}){
  return leaseServicesOf(lease.id,month).map(ls=>{
    const svc=getService(ls.serviceId);if(!svc||svc.archived)return null;
    const price=Number(ls.priceOverride)>0?Number(ls.priceOverride):servicePriceForMonth(svc,month);
    let qty=1;
    if(svc.calcType==='perPerson')qty=leaseOccupantsOf(lease.id).length||1;
    else if(svc.calcType==='perUnit')qty=Number(ls.quantity||1);
    else if(svc.calcType==='manual')qty=1;
    let amount=svc.calcType==='manual'?Number(manualAmounts[ls.id]??price):qty*price;
    amount=Math.max(0,amount-Number(ls.discountAmount||0));
    amount=Math.round(amount*(1-Number(ls.discountPercent||0)/100));
    const tax=Math.round(amount*Number(svc.taxPercent||0)/100);
    return {leaseServiceId:ls.id,serviceId:svc.id,name:svc.name,calcType:svc.calcType,unit:svc.unit||'',
      quantity:qty,unitPrice:price,discountPercent:Number(ls.discountPercent||0),discountAmount:Number(ls.discountAmount||0),
      taxPercent:Number(svc.taxPercent||0),tax,amount:amount+tax};
  }).filter(Boolean);
}
/**
 * Migration phía máy (giống migrateLeases trên máy chủ, dùng cho bản chạy cục bộ / dữ liệu import):
 * mỗi người thuê đang hoạt động có phòng → 1 hợp đồng active + người ở đại diện + tài khoản.
 * Chạy lại nhiều lần KHÔNG tạo trùng.
 */
function migrateLeasesLocal(d){
  d.tenants.forEach(t=>{
    if(!t.active||!t.roomId)return;
    let lease=d.leases.find(l=>l.primaryTenantId===t.id&&l.status!=='cancelled');
    if(!lease){
      const room=d.rooms.find(r=>r.id===t.roomId)||{};
      lease={id:'l_mig_'+t.id,propertyId:room.propertyId||'',roomId:t.roomId,primaryTenantId:t.id,
        startDate:t.moveInDate||'',endDate:'',billingDay:Number(d.settings?.defaultDueDay||5),
        rentAmount:Number(room.price||0),depositRequired:Number(t.depositRequired||0),depositPaid:Number(t.depositPaid||0),
        status:'active',signedAt:t.moveInDate||'',moveInAt:t.moveInDate||'',moveOutAt:'',terminationReason:'',
        note:'Chuyển tự động từ dữ liệu người thuê cũ',createdAt:new Date().toISOString(),
        depositDeduct:0,depositRefund:0,settlementNote:'',roomHistory:[],renewals:[]};
      d.leases.push(lease);
    }
    if(!d.leaseOccupants.some(x=>x.leaseId===lease.id&&x.occupantId===t.id)){
      d.leaseOccupants.push({id:'lo_mig_'+t.id,leaseId:lease.id,occupantId:t.id,role:'primary',
        joinedAt:lease.startDate||'',leftAt:'',note:'',createdAt:new Date().toISOString()});
    }
    const phone=String(t.phone||'').replace(/\D/g,'');
    if(phone&&!d.accounts.some(a=>a.occupantId===t.id||String(a.phone||'').replace(/\D/g,'')===phone)){
      d.accounts.push({id:'acc_mig_'+t.id,phone,occupantId:t.id,active:true,pin:String(t.pin||''),
        createdAt:new Date().toISOString(),note:'Chuyển từ người thuê'});
    }
  });
  const leaseByTenant={};
  d.leases.forEach(l=>{if(l.status!=='cancelled'&&!leaseByTenant[l.primaryTenantId])leaseByTenant[l.primaryTenantId]=l.id});
  d.invoices.forEach(i=>{if(!i.leaseId&&leaseByTenant[i.tenantId])i.leaseId=leaseByTenant[i.tenantId]});
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
function getLease(id){return data.leases.find(x=>x.id===id)}
function getAccount(id){return data.accounts.find(x=>x.id===id)}
function accountForOccupant(occupantId){return data.accounts.find(a=>a.occupantId===occupantId)}
function liveLease(l){return l&&(l.status==='active'||l.status==='ending')}
function activeLeaseForRoom(roomId){return data.leases.find(l=>l.roomId===roomId&&liveLease(l))}
function draftLeaseForRoom(roomId){return data.leases.find(l=>l.roomId===roomId&&l.status==='draft')}
function leaseOccupantsOf(leaseId,onlyCurrent=true){return data.leaseOccupants.filter(x=>x.leaseId===leaseId&&(!onlyCurrent||!x.leftAt))}
function leaseForOccupant(occupantId){
  const direct=data.leases.find(l=>liveLease(l)&&l.primaryTenantId===occupantId);
  if(direct)return direct;
  const lo=data.leaseOccupants.find(x=>x.occupantId===occupantId&&!x.leftAt);
  return lo?data.leases.find(l=>liveLease(l)&&l.id===lo.leaseId):null;
}
function leaseHasInvoices(leaseId){const l=getLease(leaseId);if(!l)return false;return data.invoices.some(i=>i.leaseId===leaseId||i.tenantId===l.primaryTenantId)}
function leaseStatusLabel(st){return({draft:'Nháp',active:'Đang hiệu lực',ending:'Sắp kết thúc',ended:'Đã thanh lý',cancelled:'Đã hủy'})[st]||'Không xác định'}
function activeTenantForRoom(roomId){
  const l=activeLeaseForRoom(roomId);
  if(l){const t=getTenant(l.primaryTenantId);if(t)return t}
  return data.tenants.find(t=>t.roomId===roomId&&t.active&&!leaseForOccupant(t.id))
}
function visibleProperties(){return data.properties.filter(p=>!p.archived)}
function visibleRooms(){const hidden=new Set(data.properties.filter(p=>p.archived).map(p=>p.id));return data.rooms.filter(r=>!r.archived&&!hidden.has(r.propertyId))}
function roomHasHistory(roomId){return data.tenants.some(t=>t.roomId===roomId)||data.utilityReadings.some(u=>u.roomId===roomId)||data.invoices.some(i=>i.roomId===roomId)}
/** Hàm trung tâm tính lại trạng thái phòng theo người thuê đang hoạt động. */
function reconcileRoomStatus(roomId){
  const r=getRoom(roomId);if(!r)return;
  if(r.status==='maintenance')return; // phòng bảo trì: chỉ đổi khi quản lý tự xác nhận
  if(activeLeaseForRoom(roomId)||data.tenants.some(t=>t.roomId===roomId&&t.active&&!leaseForOccupant(t.id))){r.status='occupied';return}
  const draft=draftLeaseForRoom(roomId);
  if(draft&&Number(draft.depositPaid||0)>0){r.status='reserved';return} // khách đã đặt cọc giữ chỗ
  if(r.status==='occupied'||r.status==='reserved')r.status='available';
}
function driveFileIdFrom(id){const s2=String(id||'');let m=s2.match(/googleusercontent\.com\/d\/([^=\/?]+)/);if(!m)m=s2.match(/drive\.google\.com\/thumbnail\?id=([^&]+)/);return m?m[1]:null}
/** Xóa 1 ảnh (Drive hoặc IndexedDB) nếu không còn căn/phòng nào khác dùng ảnh đó. */
async function removeImageIfUnused(imgId,exceptKind,exceptId){
  const refs=[
    ...data.properties.filter(p=>(p.imageIds||[]).includes(imgId)).map(p=>'property:'+p.id),
    ...data.rooms.filter(r=>(r.imageIds||[]).includes(imgId)).map(r=>'room:'+r.id)
  ].filter(ref=>ref!==exceptKind+':'+exceptId);
  if(refs.length)return; // ảnh đang được nơi khác tham chiếu, giữ lại
  const fid=driveFileIdFrom(imgId);
  if(fid){
    if(window.Sync&&Sync.isOn()&&Sync.isAdmin()){try{await Sync.deleteImage(fid)}catch(e){}}
    return;
  }
  try{await dbDeleteImage(imgId)}catch(e){}
}
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
async function saveImageFile(file,scope){
  const blob=await compressImage(file);
  if(window.Sync&&Sync.isOn()&&Sync.isAdmin()){
    try{return await Sync.uploadImage(blob,file.name||('anh-'+Date.now()+'.jpg'),scope||'public')}
    catch(e){showToast('Chưa tải được ảnh lên Drive, tạm lưu trên máy này')}
  }
  const id=uid('img');await dbPutImage(id,blob);return id}
async function imageUrl(id){
  if(!id)return'';
  if(/^https?:\/\//.test(id))return id;
  if(imageUrlCache.has(id))return imageUrlCache.get(id);
  if(String(id).startsWith('priv:')){
    // v4.1: ảnh riêng tư — chỉ lấy được qua máy chủ khi ĐÃ đăng nhập quản trị
    try{
      let res;
      if(window.Sync&&Sync.isOn()&&Sync.isAdmin()){
        res=await Sync.fetchPrivateImage(id.slice(5));
      }else if(residentSession&&residentSession.sessionKey&&Sync.isOn()){
        res=await Sync.request({action:'residentImage',phone:residentSession.phone,sessionKey:residentSession.sessionKey,imageId:id.slice(5)});
      }else return'';
      const bin=atob(res.data);const arr=new Uint8Array(bin.length);
      for(let i=0;i<bin.length;i++)arr[i]=bin.charCodeAt(i);
      const url=URL.createObjectURL(new Blob([arr],{type:res.mime||'image/jpeg'}));
      imageUrlCache.set(id,url);return url;
    }catch(e){return''}
  }
  try{const blob=await dbGetImage(id);if(!blob)return'';const url=URL.createObjectURL(blob);imageUrlCache.set(id,url);return url}catch(e){return''}}
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
async function commitImageState(state,kind,entityId){const ids=[];for(const f of state.newFiles){try{ids.push(await saveImageFile(f))}catch(e){showToast('Có ảnh không lưu được. Hãy thử lại.')}}for(const id of state.removed){try{await removeImageIfUnused(id,kind,entityId)}catch(e){}}return [...state.existing,...ids]}

// ---------- Public site ----------
function renderAreaOptions(){const areas=[...new Set(visibleProperties().map(p=>p.area).filter(Boolean))].sort();const html='<option value="all">Tất cả khu vực</option>'+areas.map(a=>`<option value="${esc(a)}">${esc(a)}</option>`).join('');document.getElementById('areaFilter').innerHTML=html;document.getElementById('heroAreaFilter').innerHTML=html;document.getElementById('areaFilter').value=publicFilters.area;document.getElementById('heroAreaFilter').value=publicFilters.area}
function renderHeroStats(){const rooms=visibleRooms();const available=rooms.filter(r=>r.status==='available').length;document.getElementById('heroStats').innerHTML=`<div class="stat-mini"><strong>${visibleProperties().length}</strong><span>Căn trọ</span></div><div class="stat-mini"><strong>${rooms.length}</strong><span>Tổng số phòng</span></div><div class="stat-mini"><strong>${available}</strong><span>Phòng đang trống</span></div>`}
function applyBranding(){
  const brand=(data.settings.brandName||'Huy Rooms').trim()||'Huy Rooms';
  document.querySelectorAll('.brand-name').forEach(el=>{el.textContent=brand});
  const hotline=(data.settings.managerPhone||'').trim();
  const call=document.getElementById('contactCallBtn');
  if(call&&hotline){call.href='tel:'+hotline.replace(/\s/g,'');call.textContent='Gọi '+hotline}
}
function roomPublicRow(r){const canBook=r.status!=='reserved';const img=primaryRoomImage(r);return `<div class="room-row">
  <a class="room-thumb-link" href="#/phong/${esc(r.slug)}" aria-label="Xem chi tiết ${esc(r.name)}">${img?`<img class="room-thumb image-loading" loading="lazy" data-image-id="${img}" alt="Ảnh ${esc(r.name)}">`:`<div class="room-thumb room-thumb-placeholder">${icon('home',20)}</div>`}</a>
  <div class="room-name">
    <a class="room-link" href="#/phong/${esc(r.slug)}"><strong class="truncate-1">${esc(r.name)} · ${esc(r.type)}</strong></a>
    <small class="truncate-1">${r.area?`${r.area} m²`:''}${r.capacity?` · Tối đa ${r.capacity} người`:''}</small>
    <div class="amenities">${(r.amenities||[]).slice(0,3).map(a=>`<span class="amenity">${esc(a)}</span>`).join('')}</div>
  </div>
  <div class="room-price"><strong>${money(r.price)}<span>/tháng</span></strong><small>Cọc ${money(r.deposit)}</small></div>
  <div class="room-tail">${availabilityBadge(r)}${canBook?`<button class="btn btn-gold btn-small" data-evt="click" data-call="openBooking" data-a1="${r.id}" aria-label="Đặt lịch xem ${esc(r.name)}">Đặt lịch xem</button>`:''}</div>
</div>`}
/* ==================================================================
   TRANG KHÁCH v5 — URL riêng cho căn/phòng, ưu tiên phòng trống, bộ lọc sâu
   ================================================================== */
function parseRoute(){
  const h=String(location.hash||'');
  let m=h.match(/^#\/can\/([a-z0-9-]+)/);if(m)return{page:'property',slug:m[1]};
  m=h.match(/^#\/phong\/([a-z0-9-]+)/);if(m)return{page:'room',slug:m[1]};
  return{page:'list'};
}
function setMeta(title,desc){
  document.title=title;
  let m=document.querySelector('meta[name="description"]');
  if(!m){m=document.createElement('meta');m.setAttribute('name','description');document.head.appendChild(m)}
  m.setAttribute('content',String(desc||'').slice(0,160));
}
function hotline(){return data.settings.managerPhone||''}
function zaloLink(){const ph=(data.settings.zaloPhone||data.settings.managerPhone||'').replace(/\D/g,'');return ph?('https://zalo.me/'+ph):''}
/** Phòng "sắp trống": đang thuê nhưng có ngày vào ở dự kiến hoặc hợp đồng sắp hết (≤45 ngày). */
function roomSoonAvailable(r){
  if(r.status!=='occupied')return false;
  if(r.availableFrom&&r.availableFrom>=today())return true;
  const l=activeLeaseForRoom(r.id);
  if(l&&l.endDate){const d=daysUntil(l.endDate);return d>=0&&d<=45}
  return false;
}
function roomAvailableFromDate(r){
  if(r.status==='available')return today();
  if(r.availableFrom)return r.availableFrom;
  const l=activeLeaseForRoom(r.id);
  return l?.endDate||'';
}
function publicRooms(){
  // KHÔNG công khai phòng bảo trì / đã ẩn
  return visibleRooms().filter(r=>r.status!=='maintenance');
}
function roomSalePriority(r){return r.status==='available'?0:roomSoonAvailable(r)?1:r.status==='reserved'?2:3}
function roomMatchesFilters(r,p){
  const f=publicFilters,q=(f.q||'').toLowerCase();
  if(f.area!=='all'&&p.area!==f.area)return false;
  if(Number(r.price)>f.maxPrice)return false;
  if(f.status!=='all'){
    if(f.status==='available'&&!(r.status==='available'||roomSoonAvailable(r)))return false;
    if(f.status!=='available'&&r.status!==f.status)return false;
  }
  if(f.minArea&&Number(r.area||0)<f.minArea)return false;
  if(f.type!=='all'&&r.type!==f.type)return false;
  if(f.capacity&&Number(r.capacity||0)<f.capacity)return false;
  if(f.amenities.length&&!f.amenities.every(a=>(r.amenities||[]).includes(a)))return false;
  if(f.moveIn){const av=roomAvailableFromDate(r);if(!av||av>f.moveIn)return false}
  if(q&&![p.name,p.address,p.area,r.name,r.type,(r.amenities||[]).join(' ')].join(' ').toLowerCase().includes(q))return false;
  return true;
}
function renderExtraFilterOptions(){
  const rooms=publicRooms();
  const types=[...new Set(rooms.map(r=>r.type).filter(Boolean))].sort();
  const tSel=document.getElementById('typeFilter');
  if(tSel)tSel.innerHTML='<option value="all">Mọi loại phòng</option>'+types.map(t=>`<option value="${esc(t)}" ${publicFilters.type===t?'selected':''}>${esc(t)}</option>`).join('');
  const amenCount={};rooms.forEach(r=>(r.amenities||[]).forEach(a=>{amenCount[a]=(amenCount[a]||0)+1}));
  const top=Object.entries(amenCount).sort((a,b)=>b[1]-a[1]).slice(0,8).map(x=>x[0]);
  const box=document.getElementById('amenityChips');
  if(box)box.innerHTML=top.map(a=>`<button type="button" class="amen-chip ${publicFilters.amenities.includes(a)?'on':''}" data-evt="click" data-call="toggleAmenityFilter" data-a1="${esc(a)}" aria-pressed="${publicFilters.amenities.includes(a)}">${esc(a)}</button>`).join('');
}
window.toggleAdvancedFilters=function(){
  const box=document.getElementById('extraFilters'),btn=document.getElementById('toggleAdvancedFilters');
  if(!box||!btn)return;
  const open=box.classList.toggle('open');
  btn.setAttribute('aria-expanded',open?'true':'false');
  btn.textContent=open?'Ẩn bớt bộ lọc':'Lọc theo loại phòng, diện tích, tiện nghi…';
}
window.toggleAmenityFilter=function(a){
  const i=publicFilters.amenities.indexOf(a);
  if(i>=0)publicFilters.amenities.splice(i,1);else publicFilters.amenities.push(a);
  renderPublic();
}
function availabilityBadge(r){
  if(r.status==='available')return '<span class="pill pill-green">Đang trống</span>';
  if(roomSoonAvailable(r)){const d=roomAvailableFromDate(r);return `<span class="pill pill-amber">Sắp trống${d?' · từ '+esc(d):''}</span>`}
  if(r.status==='reserved')return '<span class="pill">Đã giữ chỗ</span>';
  return '<span class="pill">Đã thuê</span>';
}
async function renderPublic(){
  applyBranding();renderAreaOptions();renderHeroStats();renderExtraFilterOptions();
  const route=parseRoute();
  const listEls=['propertiesHead','publicFilterBar'];
  const hero=document.querySelector('.hero');
  if(route.page==='property'){if(hero)hero.classList.add('hidden');toggleListChrome(false);return renderPropertyPage(route.slug)}
  if(route.page==='room'){if(hero)hero.classList.add('hidden');toggleListChrome(false);return renderRoomPage(route.slug)}
  if(hero)hero.classList.remove('hidden');toggleListChrome(true);
  setMeta((data.settings.brandName||'Huy Rooms')+' — Tìm phòng trọ',(visibleProperties().map(p=>p.name).join(', ')||'Phòng trọ')+' — phòng trống cập nhật liên tục, đặt lịch xem trong 1 phút.');
  const matches=visibleProperties().map(p=>{
    let rooms=publicRooms().filter(r=>r.propertyId===p.id).filter(r=>roomMatchesFilters(r,p));
    if(publicFilters.area!=='all'&&p.area!==publicFilters.area)return null;
    rooms=rooms.sort((a,b)=>roomSalePriority(a)-roomSalePriority(b)||Number(a.price)-Number(b.price));
    return rooms.length?{p,rooms}:null;
  }).filter(Boolean)
    .sort((a,b)=>Math.min(...a.rooms.map(roomSalePriority))-Math.min(...b.rooms.map(roomSalePriority)));
  const total=matches.reduce((s,x)=>s+x.rooms.length,0);
  document.getElementById('resultCount').textContent=`${total} phòng phù hợp`;
  document.getElementById('propertyGrid').innerHTML=matches.length?matches.map(({p,rooms})=>{
    const cover=primaryPropertyImage(p);
    const availCount=rooms.filter(r=>r.status==='available').length;
    return `<article class="property-card">
    <a class="property-cover" href="#/can/${esc(p.slug)}" aria-label="Xem chi tiết ${esc(p.name)}">${cover?`<img class="image-loading" loading="lazy" data-image-id="${cover}" alt="Ảnh ${esc(p.name)}">`:`<div class="property-cover-fallback">${icon('home',34)}</div>`}<div class="property-cover-overlay"><span class="pill ${availCount?'pill-green':''}">${availCount?availCount+' phòng trống':'Hết phòng trống'}</span><div class="property-cover-text"><h3 class="truncate-1">${esc(p.name)}</h3><p class="truncate-1">${esc(p.address)}</p></div></div></a>
    <div class="property-body"><div class="property-meta"><span>${icon('pin',14)}${esc(p.area)}</span><span>${icon('home',14)}${publicRooms().filter(r=>r.propertyId===p.id).length} phòng</span><span>${icon('phone',14)}${esc(hotline()||'Liên hệ')}</span></div><div class="room-list">${rooms.map(roomPublicRow).join('')}</div></div></article>`;
  }).join(''):'<div class="empty" style="grid-column:1/-1">Không có phòng phù hợp với bộ lọc hiện tại.</div>';
  await hydrateImages(document.getElementById('propertyGrid'));
}
function toggleListChrome(show){
  const head=document.querySelector('#properties .section-head');
  const bar=document.querySelector('#properties .filter-bar');
  const extra=document.getElementById('extraFilters');
  [head,bar,extra].forEach(el=>{if(el)el.classList.toggle('hidden',!show)});
}
/* ---------- Trang chi tiết CĂN ---------- */
async function renderPropertyPage(slug){
  const p=visibleProperties().find(x=>x.slug===slug);
  const grid=document.getElementById('propertyGrid');
  if(!p){grid.innerHTML='<div class="empty" style="grid-column:1/-1">Không tìm thấy căn trọ này. <a href="#/">← Về danh sách</a></div>';return}
  setMeta(`${p.name} — ${data.settings.brandName||'Huy Rooms'}`,(p.description||`${p.name} tại ${p.address}`));
  const rooms=publicRooms().filter(r=>r.propertyId===p.id).sort((a,b)=>roomSalePriority(a)-roomSalePriority(b));
  grid.innerHTML=`<div class="detail-page" style="grid-column:1/-1">
    <nav class="breadcrumb"><a href="#/">← Danh sách</a><span>${esc(p.name)}</span></nav>
    <div class="detail-gallery">${(p.imageIds||[]).length?p.imageIds.slice(0,6).map((id,i)=>`<img class="image-loading ${i===0?'g-main':''}" loading="lazy" data-image-id="${id}" alt="Ảnh ${esc(p.name)} ${i+1}">`).join(''):`<div class="detail-fallback g-main" aria-hidden="true">${icon('home',44)}</div>`}</div>
    <h1>${esc(p.name)}</h1>
    <p class="detail-sub">${icon('pin',15)}${esc(p.area)} · ${esc(p.address)}</p>
    ${p.description?`<p class="detail-desc">${esc(p.description)}</p>`:''}
    ${ctaRow('')}
    <h2 class="detail-section-title">Phòng tại đây (${rooms.length})</h2>
    <div class="room-list">${rooms.map(roomPublicRow).join('')||'<div class="empty">Chưa có phòng công khai.</div>'}</div>
  </div>`;
  await hydrateImages(grid);
}
/* ---------- Trang chi tiết PHÒNG ---------- */
async function renderRoomPage(slug){
  const r=publicRooms().find(x=>x.slug===slug);
  const grid=document.getElementById('propertyGrid');
  if(!r){grid.innerHTML='<div class="empty" style="grid-column:1/-1">Không tìm thấy phòng này. <a href="#/">← Về danh sách</a></div>';return}
  const p=getProperty(r.propertyId);
  setMeta(`${r.name} · ${p?.name||''} — ${money(r.price)}/tháng`,
    `${r.type||'Phòng'} ${r.area?r.area+'m² ':''}tại ${p?.address||''}. Giá ${money(r.price)}/tháng, cọc ${money(r.deposit)}.${r.policies?' '+r.policies:''}`);
  const ids=[...(r.imageIds||[])];if(!ids.length&&p?.imageIds?.length)ids.push(...p.imageIds.slice(0,3));
  const avDate=roomAvailableFromDate(r);
  grid.innerHTML=`<div class="detail-page" style="grid-column:1/-1">
    <nav class="breadcrumb"><a href="#/">Danh sách</a>${p?`<a href="#/can/${esc(p.slug)}">${esc(p.name)}</a>`:''}<span>${esc(r.name)}</span></nav>
    <div class="detail-gallery">${ids.length?ids.slice(0,6).map((id,i)=>`<img class="image-loading ${i===0?'g-main':''}" loading="lazy" data-image-id="${id}" alt="Ảnh ${esc(r.name)} ${i+1}" data-evt="click" data-call="openGallery" data-a1="${r.id}" style="cursor:pointer">`).join(''):`<div class="detail-fallback g-main" aria-hidden="true">${icon('home',44)}</div>`}</div>
    <div class="detail-headrow"><h1>${esc(r.name)} · ${esc(r.type||'Phòng')}</h1>${availabilityBadge(r)}</div>
    <p class="detail-sub">${icon('pin',15)}${esc(p?.name||'')} · ${esc(p?.address||'')}</p>
    <div class="detail-facts">
      <div><small>GIÁ THUÊ</small><strong>${money(r.price)}<span>/tháng</span></strong></div>
      <div><small>TIỀN CỌC</small><strong>${money(r.deposit)}</strong></div>
      ${r.area?`<div><small>DIỆN TÍCH</small><strong>${r.area} m²</strong></div>`:''}
      ${r.capacity?`<div><small>SỐ NGƯỜI</small><strong>Tối đa ${r.capacity}</strong></div>`:''}
      ${avDate?`<div><small>CÓ THỂ VÀO Ở</small><strong>${r.status==='available'?'Ngay bây giờ':esc(avDate)}</strong></div>`:''}
      <div><small>ĐIỆN / NƯỚC</small><strong>${money(r.electricRate)}/kWh · ${r.waterMode==='meter'?money(r.waterRate)+'/m³':money(r.waterFixed)+'/tháng'}</strong></div>
    </div>
    ${(r.amenities||[]).length?`<h3 class="detail-section-title">Tiện nghi</h3><div class="gallery-info">${r.amenities.map(a=>`<span>${esc(a)}</span>`).join('')}</div>`:''}
    ${r.policies?`<h3 class="detail-section-title">Chính sách</h3><p class="detail-desc">${esc(r.policies)}</p>`:''}
    ${ctaRow(r.id,r.status!=='reserved')}
  </div>`;
  await hydrateImages(grid);
}
function ctaRow(roomId,canBook=true){
  const ph=hotline(),zl=zaloLink();
  return `<div class="cta-row">
    ${ph?`<a class="btn btn-light" href="tel:${esc(ph)}" aria-label="Gọi điện cho quản lý">${icon('phone',16)} Gọi ${esc(ph)}</a>`:''}
    ${zl?`<a class="btn btn-light" href="${zl}" target="_blank" rel="noopener" aria-label="Nhắn Zalo cho quản lý">${icon('message',16)} Zalo</a>`:''}
    ${roomId&&canBook?`<button class="btn btn-gold" data-evt="click" data-call="openBooking" data-a1="${roomId}" aria-label="Đặt lịch xem phòng">${icon('calendar',16)} Đặt lịch xem phòng</button>`:roomId?'<span class="pill">Phòng đang được giữ chỗ</span>':''}
  </div>`;
}
window.openGallery=async function(roomId){const r=getRoom(roomId);if(!r)return;const p=getProperty(r.propertyId);const ids=[...(r.imageIds||[])];if(!ids.length&&p?.imageIds?.length)ids.push(...p.imageIds);document.getElementById('galleryContent').innerHTML=`<div class="gallery-head"><h3>${esc(p?.name||'')} · ${esc(r.name)}</h3><p>${money(r.price)}/tháng · Cọc ${money(r.deposit)} · ${r.area||'-'} m²</p></div><div class="gallery-grid">${ids.length?ids.map(id=>`<img data-image-id="${id}" alt="Ảnh phòng">`).join(''):'<div class="gallery-empty">Phòng này chưa có ảnh. Quản lý có thể tải ảnh lên trong phần Căn trọ & phòng.</div>'}</div><div class="gallery-info">${(r.amenities||[]).map(a=>`<span>${esc(a)}</span>`).join('')}</div>`;openModal('galleryModal');await hydrateImages(document.getElementById('galleryContent'))}
function workSlots(){
  const st=data.settings,out=[];
  const [h1,m1]=(st.workStart||'08:00').split(':').map(Number);
  const [h2,m2]=(st.workEnd||'20:00').split(':').map(Number);
  const step=Number(st.slotMinutes||60);
  for(let t=h1*60+m1;t<=h2*60+m2;t+=step)out.push(String(Math.floor(t/60)).padStart(2,'0')+':'+String(t%60).padStart(2,'0'));
  return out;
}
window.refreshBookingSlots=function(){
  const roomId=document.getElementById('bookingRoomId').value;
  const date=document.getElementById('appointmentDate').value;
  const busy=new Set(data.appointments.filter(a=>a.roomId===roomId&&a.date===date&&!['cancelled','lost'].includes(a.status)).map(a=>a.time));
  const sel=document.getElementById('appointmentTime');
  const prev=sel.value;
  sel.innerHTML=workSlots().map(t=>`<option value="${t}" ${busy.has(t)?'disabled':''}>${t}${busy.has(t)?' — đã có khách hẹn':''}</option>`).join('');
  const firstFree=workSlots().find(t=>!busy.has(t));
  sel.value=(prev&&!busy.has(prev))?prev:(firstFree||workSlots()[0]||'09:00');
}
window.openBooking=function(roomId){const r=getRoom(roomId);if(!r)return;
  if(r.status==='reserved'){showToast('Phòng này đang được giữ chỗ, chưa nhận lịch xem.');return}
  const p=getProperty(r.propertyId);
  document.getElementById('bookingRoomId').value=r.id;
  document.getElementById('bookingRoomSummary').innerHTML=`<h4>${esc(p?.name||'')} · ${esc(r.name)}</h4><p>${money(r.price)}/tháng · ${r.area||'-'} m² · ${statusLabel(r.status)}</p><p style="color:var(--muted)">Khung giờ nhận khách: ${esc(data.settings.workStart||'08:00')}–${esc(data.settings.workEnd||'20:00')}</p>`;
  const date=document.getElementById('appointmentDate');date.min=today();date.value=nextDayISO(1);
  refreshBookingSlots();
  const ck=document.getElementById('bookingConsent');if(ck)ck.checked=false;
  openModal('bookingModal')}

// ---------- Navigation / login ----------
function showPublic(){document.getElementById('publicApp').classList.remove('hidden');document.getElementById('publicTopbar').classList.remove('hidden');document.getElementById('adminApp').classList.add('hidden');document.getElementById('residentApp').classList.add('hidden');renderPublic();updateSyncPill();window.scrollTo(0,0)}
function showAdmin(){
  // v4.1: không cho vào màn quản trị khi chưa xác thực (online = token, offline = cờ máy này)
  if(!(Sync.isAdmin&&Sync.isAdmin())&&localStorage.getItem('huyrooms_admin_v3')!=='true'){openModal('loginModal');return}
  document.getElementById('publicApp').classList.add('hidden');document.getElementById('publicTopbar').classList.add('hidden');document.getElementById('residentApp').classList.add('hidden');document.getElementById('adminApp').classList.remove('hidden');renderAdmin();updateSyncPill();window.scrollTo(0,0)}
function showResident(tenantId){if(tenantId)currentResidentId=tenantId;document.getElementById('publicApp').classList.add('hidden');document.getElementById('publicTopbar').classList.add('hidden');document.getElementById('adminApp').classList.add('hidden');document.getElementById('residentApp').classList.remove('hidden');renderResident();window.scrollTo(0,0);validateResidentSession()}
let residentValidated=false;
async function validateResidentSession(){
  if(!residentSession||!residentSession.sessionKey||!Sync.isOn()||residentValidated)return;
  try{
    await Sync.residentPing(residentSession.phone,residentSession.sessionKey);
    residentValidated=true;
  }catch(err){
    // Phiên bị hủy (đăng xuất mọi thiết bị / đổi PIN) hoặc hết hạn → không hiển thị dữ liệu cũ
    saveResidentSession(null);residentValidated=false;
    document.getElementById('residentContent').innerHTML='<div class="rs-error"><h3>Phiên đăng nhập không còn hiệu lực</h3><p>Tài khoản đã đăng xuất khỏi mọi thiết bị hoặc PIN đã đổi. Vui lòng đăng nhập lại.</p><button class="btn btn-primary" onclick="showPublic();openModal(\'residentLoginModal\')">Đăng nhập lại</button></div>';
  }
}

// ---------- Resident portal ----------
function effectiveInvoiceStatus(i){if(i.status==='paid')return'paid';if(i.dueDate&&i.dueDate<today())return'overdue';return i.status||'unpaid'}
function remainingInvoice(i){return Math.max(0,Number(i.total||0)-Number(i.amountPaid||0))}
function invoiceBadge(i){const s=effectiveInvoiceStatus(i);return `<span class="badge badge-${s}">${billStatusLabel(s)}</span>`}
/* ==================================================================
   CỔNG CƯ DÂN (v4 giai đoạn 4) — mobile-first, dạng thẻ tab
   ================================================================== */
let residentTab='home';
const READ_KEY='huyrooms_read_notices';
function readNoticeIds(){try{return JSON.parse(localStorage.getItem(READ_KEY)||'[]')}catch(e){return[]}}
function markNoticeLocal(id){const l=readNoticeIds();if(!l.includes(id)){l.push(id);try{localStorage.setItem(READ_KEY,JSON.stringify(l.slice(-200)))}catch(e){}}}
/** Gom dữ liệu cư dân về MỘT dạng, dù chạy qua máy chủ (residentSession) hay bản cục bộ. */
function RD(){
  if(residentSession){
    const st=residentSession.settings&&Object.keys(residentSession.settings).length?residentSession.settings:{};
    return {online:true,t:residentSession.tenant,r:residentSession.room,p:residentSession.property,
      lease:residentSession.lease||null,co:residentSession.coOccupants||[],
      inv:[...(residentSession.invoices||[])].sort((a,b)=>String(b.month).localeCompare(String(a.month))),
      readings:[...(residentSession.readings||[])].sort((a,b)=>String(b.month).localeCompare(String(a.month))),
      pays:residentSession.payments||[],tickets:residentSession.tickets||[],
      notices:residentSession.notifications||[],handover:residentSession.handoverItems||[],
      assets:residentSession.assets||[],dep:residentSession.depositLedger||[],settings:st};
  }
  const t=getTenant(currentResidentId);if(!t)return null;
  const lease=data.leases.find(l=>liveLease(l)&&(l.primaryTenantId===t.id||data.leaseOccupants.some(x=>x.leaseId===l.id&&x.occupantId===t.id&&!x.leftAt)))||null;
  const roomId=lease?.roomId||t.roomId;const r=getRoom(roomId);
  const co=lease?data.leaseOccupants.filter(x=>x.leaseId===lease.id&&!x.leftAt).map(x=>{const o=getTenant(x.occupantId);return o?{id:o.id,name:o.name,role:x.role}:null}).filter(Boolean):[];
  return {online:false,t,r,p:getProperty(r?.propertyId),lease,co,
    inv:data.invoices.filter(i=>i.tenantId===t.id||(lease&&i.leaseId===lease.id)).sort((a,b)=>String(b.month).localeCompare(String(a.month))),
    readings:data.utilityReadings.filter(u=>u.roomId===roomId).sort((a,b)=>String(b.month).localeCompare(String(a.month))),
    pays:data.payments.filter(pp=>data.invoices.some(i=>(i.tenantId===t.id||(lease&&i.leaseId===lease.id))&&i.id===pp.invoiceId)),
    tickets:data.maintenanceTickets.filter(k=>k.tenantId===t.id||(lease&&k.leaseId===lease.id)),
    notices:data.notifications.filter(n=>!n.tenantId||n.tenantId===t.id),
    handover:lease?data.handoverItems.filter(h=>h.leaseId===lease.id):[],
    assets:data.assets.filter(a=>a.roomId===roomId),
    dep:lease?data.depositLedger.filter(x=>x.leaseId===lease.id):[],
    settings:data.settings};
}
/** Thông báo suy ra tại chỗ: sắp đến hạn, quá hạn, hợp đồng sắp hết. */
function derivedNotices(rd){
  const out=[];
  rd.inv.filter(i=>effectiveInvoiceStatus(i)!=='paid').forEach(i=>{
    const d=daysUntil(i.dueDate);
    if(i.dueDate&&d<0)out.push({id:'drv_over_'+i.id,kind:'overdue',title:'Hóa đơn quá hạn',body:`Hóa đơn tháng ${i.month} đã quá hạn ${Math.abs(d)} ngày — còn ${money(remainingInvoice(i))}.`,createdAt:i.dueDate,refId:i.id});
    else if(i.dueDate&&d<=3)out.push({id:'drv_due_'+i.id,kind:'due_soon',title:'Sắp đến hạn thanh toán',body:`Hóa đơn tháng ${i.month} đến hạn ${i.dueDate} — còn ${money(remainingInvoice(i))}.`,createdAt:i.dueDate,refId:i.id});
  });
  if(rd.lease&&rd.lease.endDate){
    const d=daysUntil(rd.lease.endDate);
    if(d>=0&&d<=30)out.push({id:'drv_lease_'+rd.lease.id,kind:'lease_expiring',title:'Hợp đồng sắp hết hạn',body:`Hợp đồng phòng ${rd.r?.name||''} hết hạn ngày ${rd.lease.endDate} (còn ${d} ngày). Liên hệ quản lý để gia hạn.`,createdAt:today(),refId:rd.lease.id});
  }
  return out;
}
function allNotices(rd){
  const readLocal=readNoticeIds();
  const list=[...rd.notices.map(n=>({...n,unread:n.tenantId?!n.readAt:!readLocal.includes(n.id)})),
    ...derivedNotices(rd).map(n=>({...n,unread:!readLocal.includes(n.id)}))];
  return list.sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));
}
function noticeIcon(k){return icon(({invoice_new:'receipt',due_soon:'clock',overdue:'alert',lease_expiring:'filetext',maintenance:'wrench',general:'bell'})[k]||'bell',16)}
const TICKET_STATUS={new:'Mới gửi',received:'Đã tiếp nhận',in_progress:'Đang xử lý',waiting:'Chờ vật tư/hẹn',done:'Hoàn tất',cancelled:'Đã hủy'};
const TICKET_PRIORITY={low:'Thấp',normal:'Bình thường',high:'Cao',urgent:'Khẩn'};
function ticketBadge(st){const cls=st==='done'?'paid':st==='cancelled'?'unpaid':st==='new'?'unpaid':'partial';return `<span class="badge badge-${cls}">${TICKET_STATUS[st]||'Không xác định'}</span>`}
function ticketOpen(k){return !['done','cancelled'].includes(k.status)}

window.setResidentTab=function(tab){residentTab=tab;renderResident()}
async function renderResident(){
  const box=document.getElementById('residentContent');
  const rd=RD();
  if(!rd||!rd.t){box.innerHTML='<div class="rs-error"><h3>Không tìm thấy dữ liệu cư dân</h3><p>Phiên có thể đã hết hạn — hãy đăng nhập lại.</p><button class="btn btn-primary" onclick="showPublic();openModal(\'residentLoginModal\')">Đăng nhập lại</button></div>';return}
  const notices=allNotices(rd);
  const unread=notices.filter(n=>n.unread).length;
  const openTk=rd.tickets.filter(ticketOpen).length;
  const tabs=[['home',icon('home',18),'Trang chủ'],['invoices',icon('receipt',18),'Hóa đơn'],['lease',icon('filetext',18),'Hợp đồng'],['tickets',icon('wrench',18),'Sự cố'],['notify',icon('bell',18),'Thông báo']];
  box.innerHTML=`
    <div class="resident-welcome"><div class="eyebrow dark">CỔNG THÔNG TIN CƯ DÂN</div>
      <h1>Xin chào, ${esc(rd.t.name)}</h1>
      <p>${esc(rd.p?.name||'')} · Phòng ${esc(rd.r?.name||'-')}${rd.online?'':' · <em>bản trên máy này</em>'}</p></div>
    <nav class="rs-tabs" role="tablist">${tabs.map(([id,ic,lb])=>`<button role="tab" class="${residentTab===id?'active':''}" data-evt="click" data-call="setResidentTab" data-a1="${id}" aria-label="${lb}"><i>${ic}</i><span>${lb}</span>${id==='notify'&&unread?`<b class="rs-dot">${unread}</b>`:''}${id==='tickets'&&openTk?`<b class="rs-dot rs-dot2">${openTk}</b>`:''}</button>`).join('')}</nav>
    <div class="rs-body" id="rsBody">${({home:rsHome,invoices:rsInvoices,lease:rsLease,tickets:rsTickets,notify:rsNotify})[residentTab](rd,notices)}</div>`;
  applyTableLabels(box);hydrateImages(box);
}
/* ---------- Trang chủ ---------- */
function rsHome(rd,notices){
  const unpaid=rd.inv.filter(i=>effectiveInvoiceStatus(i)!=='paid');
  const debt=unpaid.reduce((s,i)=>s+remainingInvoice(i),0);
  const nearest=unpaid.filter(i=>i.dueDate).sort((a,b)=>a.dueDate.localeCompare(b.dueDate))[0];
  const depT=rd.dep.length?rd.dep.reduce((o,x)=>{o[x.type]=(o[x.type]||0)+Number(x.amount||0);return o},{collect:0,refund:0,deduct:0}):null;
  const held=depT?depT.collect-(depT.refund||0)-(depT.deduct||0):Number(rd.lease?.depositPaid??rd.t.depositPaid??0);
  const openTickets=rd.tickets.filter(ticketOpen).sort((a,b)=>String(b.createdAt).localeCompare(a.createdAt));
  const unreadNotices=notices.filter(n=>n.unread).slice(0,3);
  return `
  <div class="resident-grid">
    <div class="resident-card"><h3>Phòng & hợp đồng</h3><div class="big-number">${esc(rd.r?.name||'-')}</div>
      <div class="kv"><span>Tiền phòng${rd.lease?' (theo HĐ)':''}</span><strong>${money(rd.lease?rd.lease.rentAmount:rd.r?.price)}</strong></div>
      <div class="kv"><span>Hợp đồng đến</span><strong>${esc(rd.lease?.endDate||'không thời hạn')}</strong></div>
      ${rd.co.length>1?`<div class="kv"><span>Người ở cùng</span><strong>${rd.co.filter(x=>x.id!==rd.t.id).map(x=>esc(x.name)).join(', ')}</strong></div>`:''}
      <button class="btn btn-light" style="margin-top:8px" onclick="setResidentTab('lease')">Xem hợp đồng →</button></div>
    <div class="resident-card ${debt>0?'rs-due':''}"><h3>Cần thanh toán</h3><div class="big-number">${money(debt)}</div>
      ${nearest?`<div class="kv"><span>Hạn gần nhất</span><strong>${esc(nearest.dueDate)} (${daysUntil(nearest.dueDate)<0?'quá hạn '+Math.abs(daysUntil(nearest.dueDate))+' ngày':daysUntil(nearest.dueDate)===0?'hôm nay':'còn '+daysUntil(nearest.dueDate)+' ngày'})</strong></div>`:'<div class="kv"><span>Không có hóa đơn chờ</span><strong>🎉</strong></div>'}
      ${debt>0?`<button class="btn btn-primary" style="margin-top:8px" data-evt="click" data-call="openResidentInvoice" data-a1="${(nearest||unpaid[0]).id}">Xem & quét QR thanh toán</button>`:''}</div>
    <div class="resident-card rs-deposit"><h3>Tiền cọc đang giữ</h3><div class="big-number">${money(held)}</div>
      ${depT?`<div class="kv"><span>Đã đóng ${money(depT.collect)}${depT.deduct?' · đã trừ '+money(depT.deduct):''}${depT.refund?' · đã hoàn '+money(depT.refund):''}</span></div>`:''}
      <div class="kv"><span style="color:var(--muted)">Cọc được theo dõi riêng, không nằm trong hóa đơn hàng tháng</span></div></div>
    <div class="resident-card"><h3>Thông báo mới ${unreadNotices.length?`<b class="rs-dot">${notices.filter(n=>n.unread).length}</b>`:''}</h3>
      ${unreadNotices.length?unreadNotices.map(n=>`<div class="rs-notice" onclick="setResidentTab('notify')"><span>${noticeIcon(n.kind)}</span><div><strong>${esc(n.title)}</strong><small>${esc(n.body)}</small></div></div>`).join(''):'<div class="rs-empty">Không có thông báo mới.</div>'}
      <button class="btn btn-light" style="margin-top:8px" onclick="setResidentTab('notify')">Tất cả thông báo →</button></div>
    <div class="resident-card"><h3>Sự cố đang xử lý</h3>
      ${openTickets.length?openTickets.slice(0,3).map(k=>`<div class="rs-notice" data-evt="click" data-call="openTicketDetail" data-a1="${k.id}"><span>${icon('wrench',15)}</span><div><strong>${esc(k.title)}</strong><small>${TICKET_STATUS[k.status]} · ${esc((k.createdAt||'').slice(0,10))}</small></div>${ticketBadge(k.status)}</div>`).join(''):'<div class="rs-empty">Không có sự cố nào đang mở.</div>'}
      <div class="table-actions" style="margin-top:8px"><button class="btn btn-primary" onclick="openResidentTicketForm()">+ Báo sự cố</button><button class="btn btn-light" onclick="setResidentTab('tickets')">Danh sách →</button></div></div>
    <div class="resident-card"><h3>Tài khoản & bảo mật</h3>
      <div class="table-actions" style="flex-direction:column;align-items:stretch;gap:8px">
        <button class="btn btn-light" onclick="openPinChange()">🔑 Đổi mã PIN</button>
        ${rd.online?'<button class="btn btn-light" onclick="residentLogoutAllDevices()">🚪 Đăng xuất mọi thiết bị</button>':''}
        <button class="btn btn-light" onclick="clearResidentDevice()">🧹 Xóa dữ liệu trên thiết bị này</button>
      </div></div>
  </div>`;
}
/* ---------- Hóa đơn ---------- */
function rsInvoices(rd){
  return `<div class="resident-card resident-history"><div class="panel-head"><div><h3>Hóa đơn của tôi</h3><p>${rd.inv.length} hóa đơn — chạm để xem chi tiết, chỉ số, ảnh công tơ và mã QR</p></div></div>
  <div class="table-wrap"><table class="data-table"><thead><tr><th>Tháng</th><th>Tổng</th><th>Còn lại</th><th>Hạn</th><th>Trạng thái</th></tr></thead><tbody>
  ${rd.inv.length?rd.inv.map(i=>`<tr class="rs-click" data-evt="click" data-call="openResidentInvoice" data-a1="${i.id}"><td>${esc(i.month)}${i.code?`<br><span style="color:var(--muted)">${esc(i.code)}</span>`:''}</td><td>${money(i.total)}</td><td><strong>${money(remainingInvoice(i))}</strong></td><td>${esc(i.dueDate||'-')}</td><td>${invoiceBadge(i)}</td></tr>`).join(''):'<tr><td colspan="5"><div class="rs-empty">Chưa có hóa đơn nào.</div></td></tr>'}
  </tbody></table></div></div>`;
}
window.openResidentInvoice=function(invId){
  const rd=RD();if(!rd)return;
  const i=rd.inv.find(x=>x.id===invId);if(!i)return;
  const u=rd.readings.find(x=>x.id===i.readingId)||rd.readings.find(x=>x.month===i.month);
  const txs=rd.pays.filter(pp=>pp.invoiceId===i.id).sort((a,b)=>String(a.createdAt).localeCompare(b.createdAt));
  const remaining=remainingInvoice(i);
  const st=rd.settings||{};
  const qr=(st.bankCode&&st.bankAccount&&remaining>0)?('https://img.vietqr.io/image/'+encodeURIComponent(st.bankCode)+'-'+encodeURIComponent(st.bankAccount)+'-compact2.png?amount='+Math.round(remaining)+'&addInfo='+encodeURIComponent(i.code||('HD '+i.month))+(st.bankAccountName?'&accountName='+encodeURIComponent(st.bankAccountName):'')):'';
  document.getElementById('rsInvoiceTitle').textContent=`Hóa đơn tháng ${i.month}${i.code?' · '+i.code:''}`;
  document.getElementById('rsInvoiceBody').innerHTML=`
    <div class="bill-breakdown">
      <div class="bill-row"><span>Tiền phòng</span><strong>${money(i.rent)}</strong></div>
      <div class="bill-row"><span>Tiền điện${u?` (${u.electricStart} → ${u.electricEnd} = ${u.electricUnits} kWh)`:''}</span><strong>${money(i.electric)}</strong></div>
      <div class="bill-row"><span>Tiền nước${u&&u.waterMode==='meter'?` (${u.waterStart} → ${u.waterEnd} = ${u.waterUnits} m³)`:''}</span><strong>${money(i.water)}</strong></div>
      ${Number(i.other)?`<div class="bill-row"><span>Phí khác</span><strong>${money(i.other)}</strong></div>`:''}
      ${(i.serviceLines||[]).map(sv=>`<div class="bill-row"><span>${esc(sv.name)}${sv.quantity>1?` × ${sv.quantity}`:''}</span><strong>${money(sv.amount)}</strong></div>`).join('')}
      ${Number(i.adjustAmount)?`<div class="bill-row"><span>Điều chỉnh${i.adjustNote?` — ${esc(i.adjustNote)}`:''}</span><strong>${money(i.adjustAmount)}</strong></div>`:''}
      ${Number(i.depositAmount)?`<div class="bill-row"><span>Tiền cọc (theo dõi riêng)</span><strong>${money(i.depositAmount)}</strong></div>`:''}
      <div class="bill-row total"><span>Tổng</span><strong>${money(i.total)}</strong></div>
      <div class="bill-row"><span>Đã thanh toán</span><strong>${money(i.amountPaid)}</strong></div>
      <div class="bill-row total"><span>Còn lại</span><strong>${money(remaining)}</strong></div>
    </div>
    ${u&&(u.imageIds||[]).length?`<div style="margin:10px 0"><button class="icon-btn" data-evt="click" data-call="openResidentMeterPhotos" data-a1="${u.id}">📷 Xem ${u.imageIds.length} ảnh công tơ tháng này</button></div>`:''}
    <h4 class="lease-section-title">Lịch sử thanh toán</h4>
    ${txs.length?txs.map(pp=>`<div class="pay-tx ${pp.kind==='reversal'?'pay-rev':''} ${pp.reversedAt?'pay-reversed':''}"><div><strong>${pp.kind==='reversal'?'↩ Điều chỉnh':'💳 Đã thu'} ${money(Math.abs(pp.amount))}</strong> · ${esc(pp.paidAt)}${pp.reversedAt?' <span class="badge badge-unpaid">Đã hủy</span>':''}</div></div>`).join(''):'<div class="rs-empty">Chưa có lần thanh toán nào.</div>'}
    ${qr?`<div class="rs-qr"><img src="${qr}" alt="VietQR thanh toán" loading="lazy"><div><strong>Quét để chuyển đúng số tiền</strong><br>${esc(st.bankAccountName||'')}<br>${esc(st.bankCode||'')} · ${esc(st.bankAccount||'')}<br>Nội dung: <strong>${esc(i.code||('HD '+i.month))}</strong></div></div>`:''}
    <div class="table-actions" style="margin-top:12px"><button class="btn btn-primary" data-evt="click" data-call="openInvoicePdf" data-a1="${i.id}">📄 Tải / In PDF</button><button class="btn btn-light" data-evt="click" data-call="copyInvoiceText" data-a1="${i.id}">Sao chép chi tiết</button></div>`;
  openModal('rsInvoiceModal');
  hydrateImages(document.getElementById('rsInvoiceBody'));
}
/* ---------- Hợp đồng ---------- */
function rsLease(rd){
  const l=rd.lease;
  if(!l)return '<div class="rs-empty" style="padding:30px">Anh/chị hiện không gắn với hợp đồng đang hiệu lực nào. Liên hệ quản lý nếu có nhầm lẫn.</div>';
  const inItems=rd.handover.filter(h=>h.phase==='checkin'),outItems=rd.handover.filter(h=>h.phase==='checkout');
  const hoRow=h=>`<div class="occ-row"><div><strong>${esc(h.name)}</strong> × ${h.quantity??1} · ${esc(h.condition||'')}${h.note?`<br><span style="color:var(--muted)">${esc(h.note)}</span>`:''}</div>${(h.imageIds||[]).length?`<span>${h.imageIds.map(id=>`<img class="rs-thumb image-loading" data-image-id="${esc(id)}">`).join('')}</span>`:''}</div>`;
  return `<div class="resident-grid">
    <div class="resident-card"><h3>Thông tin hợp đồng</h3>
      <div class="kv"><span>Phòng</span><strong>${esc(rd.r?.name||'')} — ${esc(rd.p?.name||'')}</strong></div>
      <div class="kv"><span>Thời hạn</span><strong>${esc(l.startDate||'?')} → ${esc(l.endDate||'không thời hạn')}</strong></div>
      <div class="kv"><span>Tiền phòng / tháng</span><strong>${money(l.rentAmount)}</strong></div>
      <div class="kv"><span>Ngày thu tiền hằng tháng</span><strong>Ngày ${l.billingDay||5}</strong></div>
      <div class="kv"><span>Ngày nhận phòng</span><strong>${esc(l.moveInAt||'-')}</strong></div>
      <div class="kv"><span>Trạng thái</span><strong>${({active:'Đang hiệu lực',ending:'Sắp kết thúc'})[l.status]||l.status}</strong></div></div>
    <div class="resident-card"><h3>Người ở (${rd.co.length})</h3>
      ${rd.co.map(x=>`<div class="kv"><span>${esc(x.name)}</span><strong>${x.role==='primary'?'Đại diện thanh toán':'Ở cùng'}</strong></div>`).join('')||'<div class="rs-empty">Chưa có.</div>'}</div>
    <div class="resident-card resident-history"><h3>Tài sản bàn giao khi nhận phòng</h3>
      ${inItems.length?inItems.map(hoRow).join(''):(rd.assets.length?rd.assets.map(a=>`<div class="occ-row"><div><strong>${esc(a.name)}</strong> × ${a.quantity??1} · ${esc(a.condition||'')}</div></div>`).join(''):'<div class="rs-empty">Chưa có biên bản bàn giao.</div>')}
      ${outItems.length?`<h4 class="lease-section-title">Kiểm kê khi trả phòng</h4>${outItems.map(hoRow).join('')}`:''}</div>
    <div class="resident-card"><h3>Sổ cọc của hợp đồng</h3>
      ${rd.dep.length?rd.dep.map(x=>`<div class="rem-log">${({collect:'💰 Đóng cọc',refund:'↩ Được hoàn',deduct:'✂ Bị trừ'})[x.type]} ${money(x.amount)} · ${esc(x.at)}${x.note?` · ${esc(x.note)}`:''}</div>`).join(''):'<div class="rs-empty">Chưa có giao dịch cọc.</div>'}</div>
  </div>`;
}
/* ---------- Sự cố ---------- */
function rsTickets(rd){
  const list=[...rd.tickets].sort((a,b)=>String(b.createdAt).localeCompare(a.createdAt));
  return `<div class="resident-card resident-history"><div class="panel-head"><div><h3>Sự cố / yêu cầu sửa chữa</h3><p>Báo hỏng thiết bị, điện nước, vệ sinh… kèm ảnh — theo dõi tiến độ xử lý tại đây</p></div><button class="btn btn-primary" onclick="openResidentTicketForm()">+ Báo sự cố</button></div>
  ${list.length?list.map(k=>`<div class="rs-notice rs-click" data-evt="click" data-call="openTicketDetail" data-a1="${k.id}"><span>${icon('wrench',15)}</span><div><strong>${esc(k.title)}</strong><small>${esc((k.createdAt||'').slice(0,10))} · Ưu tiên: ${TICKET_PRIORITY[k.priority]||'Không xác định'}${(k.imageIds||[]).length?` · ${icon('camera',12)}${k.imageIds.length}`:''}</small></div>${ticketBadge(k.status)}</div>`).join(''):'<div class="rs-empty" style="padding:24px">Chưa có sự cố nào. Khi cần sửa chữa gì trong phòng, bấm “Báo sự cố”.</div>'}</div>`;
}
window.openTicketDetail=function(id){
  const rd=residentSession||currentResidentId?RD():null;
  const k=(rd?rd.tickets:data.maintenanceTickets).find(x=>x.id===id)||data.maintenanceTickets.find(x=>x.id===id);
  if(!k)return;
  const r=rd?rd.r:getRoom(k.roomId);
  document.getElementById('ticketDetailTitle').textContent=k.title;
  document.getElementById('ticketDetailBody').innerHTML=`
    <div class="kv"><span>Trạng thái</span>${ticketBadge(k.status)}</div>
    <div class="kv"><span>Phòng · Ưu tiên</span><strong>${esc(r?.name||'')} · ${TICKET_PRIORITY[k.priority]||'Không xác định'}</strong></div>
    ${k.description?`<p style="margin:8px 0">${esc(k.description)}</p>`:''}
    ${(k.imageIds||[]).length?`<div class="meter-photo-body" style="margin:8px 0">${k.imageIds.map(x=>`<img class="meter-photo image-loading" data-image-id="${esc(x)}">`).join('')}</div>`:''}
    <h4 class="lease-section-title">Tiến trình xử lý</h4>
    <div class="timeline">${(k.statusHistory||[]).map(h=>`<div class="tl-item"><div class="tl-dot"></div><div class="tl-body"><strong>${TICKET_STATUS[h.status]||h.status}</strong><small>${esc((h.at||'').slice(0,16).replace('T',' '))} · ${esc(h.by||'')}</small>${h.note?`<p>${esc(h.note)}</p>`:''}</div></div>`).join('')||'<div class="rs-empty">Chưa có cập nhật.</div>'}</div>
    ${k.resolution?`<div class="smart-note" style="margin-top:8px"><strong>Kết quả xử lý:</strong> ${esc(k.resolution)}</div>`:''}`;
  openModal('ticketDetailModal');
  hydrateImages(document.getElementById('ticketDetailBody'));
}
let rsTicketFiles=[];
window.openResidentTicketForm=function(){
  rsTicketFiles=[];
  document.getElementById('rsTicketForm').reset();
  document.getElementById('rsTicketPreview').innerHTML='';
  document.getElementById('rsTicketError').textContent='';
  openModal('rsTicketModal');
}
window.rsTicketPickPhotos=function(){
  const input=document.createElement('input');
  input.type='file';input.accept='image/*';input.capture='environment';input.multiple=true;
  input.onchange=async()=>{
    for(const f of [...(input.files||[])].slice(0,3-rsTicketFiles.length)){
      const blob=await compressImage(f);
      rsTicketFiles.push({blob,name:f.name||('su-co-'+Date.now()+'.jpg')});
    }
    document.getElementById('rsTicketPreview').innerHTML=rsTicketFiles.map((x,i)=>`<span class="rs-thumb-wrap"><img class="rs-thumb" src="${URL.createObjectURL(x.blob)}"><button type="button" data-evt="click" data-call="rsRemoveFile" data-a1="${i}">×</button></span>`).join('');
  };
  input.click();
}
document.getElementById('rsTicketForm').addEventListener('submit',async e=>{
  e.preventDefault();
  const btn=e.target.querySelector('button[type=submit]');
  const errBox=document.getElementById('rsTicketError');errBox.textContent='';
  const payload={
    title:document.getElementById('rsTicketTitle').value.trim(),
    category:document.getElementById('rsTicketCategory').value,
    priority:document.getElementById('rsTicketPriority').value,
    description:document.getElementById('rsTicketDesc').value.trim()
  };
  if(!payload.title){errBox.textContent='Vui lòng nhập tiêu đề sự cố.';return}
  if(residentSession){
    setBtnBusy(btn,true,'Đang gửi…');
    try{
      const images=[];
      for(const x of rsTicketFiles){
        const b64=await new Promise((res,rej)=>{const fr=new FileReader();fr.onload=()=>res(String(fr.result).split(',')[1]);fr.onerror=rej;fr.readAsDataURL(x.blob)});
        images.push({data:b64,mime:'image/jpeg',name:x.name});
      }
      const res=await Sync.residentTicket({phone:residentSession.phone,sessionKey:residentSession.sessionKey,...payload,images});
      residentSession.tickets=[...(residentSession.tickets||[]),res.ticket];
      saveResidentSession(residentSession);
      closeModal('rsTicketModal');residentTab='tickets';renderResident();
      showToast('Đã gửi sự cố tới quản lý. Anh/chị theo dõi tiến độ tại mục Sự cố.');
    }catch(err){errBox.textContent=err.message||'Không gửi được, thử lại sau.'}
    finally{setBtnBusy(btn,false)}
    return;
  }
  // Bản cục bộ (không máy chủ)
  const t=getTenant(currentResidentId);if(!t){errBox.textContent='Không xác định được cư dân.';return}
  const lease=data.leases.find(l=>liveLease(l)&&(l.primaryTenantId===t.id||data.leaseOccupants.some(x=>x.leaseId===l.id&&x.occupantId===t.id&&!x.leftAt)));
  const imageIds=[];
  for(const x of rsTicketFiles){const id=await saveImageFile(new File([x.blob],x.name,{type:'image/jpeg'}),'private');imageIds.push(id)}
  const now=new Date().toISOString();
  data.maintenanceTickets.push({id:uid('tk'),...payload,imageIds,status:'new',tenantId:t.id,
    leaseId:lease?.id||'',roomId:lease?.roomId||t.roomId||'',assigneeId:'',
    statusHistory:[{at:now,status:'new',by:'Cư dân',note:''}],resolution:'',createdAt:now,closedAt:''});
  saveData();closeModal('rsTicketModal');residentTab='tickets';renderResident();
  showToast('Đã ghi nhận sự cố.');
});
/* ---------- Thông báo ---------- */
function rsNotify(rd,notices){
  return `<div class="resident-card resident-history"><div class="panel-head"><div><h3>Thông báo</h3><p>Hóa đơn mới, nhắc hạn, bảo trì và thông báo chung từ quản lý</p></div>${notices.some(n=>n.unread)?`<button class="btn btn-light" onclick="markAllNoticesRead()">Đánh dấu đã đọc</button>`:''}</div>
  ${notices.length?notices.map(n=>`<div class="rs-notice ${n.unread?'rs-unread':''}"><span>${noticeIcon(n.kind)}</span><div><strong>${esc(n.title)}</strong><small>${esc(n.body)}</small><small style="color:var(--muted)">${esc(String(n.createdAt||'').slice(0,10))}</small></div></div>`).join(''):'<div class="rs-empty" style="padding:24px">Chưa có thông báo nào.</div>'}</div>`;
}
window.markAllNoticesRead=async function(){
  const rd=RD();if(!rd)return;
  const notices=allNotices(rd);
  const personal=notices.filter(n=>n.unread&&n.tenantId).map(n=>n.id);
  notices.filter(n=>n.unread&&!n.tenantId).forEach(n=>markNoticeLocal(n.id));
  if(personal.length){
    if(residentSession){
      try{await Sync.residentMarkRead(residentSession.phone,residentSession.sessionKey,personal);
        residentSession.notifications=(residentSession.notifications||[]).map(n=>personal.includes(n.id)?{...n,readAt:new Date().toISOString()}:n);
        saveResidentSession(residentSession);
      }catch(err){showToast('Chưa lưu được trạng thái đã đọc lên máy chủ.')}
    }else{
      data.notifications.forEach(n=>{if(personal.includes(n.id))n.readAt=new Date().toISOString()});saveData();
    }
  }
  renderResident();
}
/* ---------- Đổi PIN + đăng xuất mọi thiết bị ---------- */
window.openPinChange=function(){
  document.getElementById('pinChangeForm').reset();
  document.getElementById('pinChangeError').textContent='';
  openModal('pinChangeModal');
}
document.getElementById('pinChangeForm').addEventListener('submit',async e=>{
  e.preventDefault();
  const btn=e.target.querySelector('button[type=submit]');
  const errBox=document.getElementById('pinChangeError');errBox.textContent='';
  const oldPin=document.getElementById('pinOld').value.trim();
  const p1=document.getElementById('pinNew').value.trim(),p2=document.getElementById('pinNew2').value.trim();
  if(!/^\d{6}$/.test(p1)){errBox.textContent='PIN mới phải gồm đúng 6 chữ số.';return}
  if(p1!==p2){errBox.textContent='Hai lần nhập PIN mới không khớp.';return}
  if(p1===oldPin){errBox.textContent='PIN mới phải khác PIN cũ.';return}
  if(residentSession){
    setBtnBusy(btn,true,'Đang đổi…');
    try{
      await Sync.residentChangePin({phone:residentSession.phone,sessionKey:residentSession.sessionKey,oldPin,newPin:p1});
      saveResidentSession(null);closeModal('pinChangeModal');
      showPublic();openModal('residentLoginModal');
      showToast('Đã đổi PIN. Mọi thiết bị đã bị đăng xuất — đăng nhập lại bằng PIN mới.');
    }catch(err){errBox.textContent=err.message||'Không đổi được PIN.'}
    finally{setBtnBusy(btn,false)}
    return;
  }
  const t=getTenant(currentResidentId);
  const acc=data.accounts.find(a=>a.occupantId===t?.id&&a.active);
  const cur=acc?.pin||t?.pin||'';
  if(String(cur)!==oldPin){errBox.textContent='PIN cũ không đúng.';return}
  if(acc)acc.pin=p1;if(t&&t.pin)t.pin=p1;
  saveData();closeModal('pinChangeModal');showToast('Đã đổi PIN trên máy này.');
});
window.residentLogoutAllDevices=async function(){
  if(!residentSession)return;
  if(!confirm('Đăng xuất tài khoản cư dân này khỏi MỌI thiết bị (kể cả máy này)?'))return;
  try{
    await Sync.residentLogoutAll(residentSession.phone,residentSession.sessionKey);
    saveResidentSession(null);showPublic();
    showToast('Đã đăng xuất mọi thiết bị. Đăng nhập lại khi cần.');
  }catch(err){showToast(err.message||'Không thực hiện được, thử lại sau.')}
}
window.copyInvoiceText=function(id){let i,t,r;if(residentSession){i=(residentSession.invoices||[]).find(x=>x.id===id);t=residentSession.tenant;r=residentSession.room}else{i=getInvoice(id);t=getTenant(i?.tenantId);r=getRoom(i?.roomId)}if(!i)return;const text=`HÓA ĐƠN ${i.month} - Phòng ${r?.name||''}\nTiền phòng: ${money(i.rent)}\nTiền điện: ${money(i.electric)}\nTiền nước: ${money(i.water)}\nPhí khác: ${money(i.other)}${i.depositAmount?`\nTiền cọc: ${money(i.depositAmount)}`:''}\nTổng: ${money(i.total)}\nĐã thanh toán: ${money(i.amountPaid)}\nCòn lại: ${money(remainingInvoice(i))}\nHạn thanh toán: ${i.dueDate||'-'}`;copyText(text,'Đã sao chép chi tiết hóa đơn')}

// ---------- Admin common ----------
function switchAdminView(view){document.getElementById('fabSheet')?.classList.remove('show');document.getElementById('moreSheet')?.classList.remove('show');document.querySelectorAll('.side-link').forEach(b=>b.classList.toggle('active',b.dataset.view===view));document.querySelectorAll('.admin-view').forEach(v=>v.classList.remove('active'));document.getElementById('view-'+view)?.classList.add('active');document.getElementById('adminTitle').textContent=({dashboard:'Tổng quan',properties:'Căn trọ & phòng',leases:'Hợp đồng thuê',tenants:'Người thuê',utilities:'Điện & nước',invoices:'Hóa đơn',appointments:'Lịch hẹn',tickets:'Sự cố & thông báo',settings:'Cài đặt'})[view]||view;syncTabbar()}
document.querySelectorAll('.side-link').forEach(b=>b.addEventListener('click',()=>switchAdminView(b.dataset.view)));
function renderAdmin(){renderDashboard();renderPropertyAdmin();renderLeases();renderTenants();renderUtilities();renderInvoices();renderAppointments();renderTicketsAdmin();renderSettings();applyTableLabels(document.getElementById('adminApp'));syncTabbar();hydrateImages(document.getElementById('adminApp'))}

function svgBarChart(series,labels,{h=150,money:isMoney=true}={}){
  // v4.1: viewBox toạ độ thật, KHÔNG preserveAspectRatio="none" → chữ không méo
  const W=320,PAD=6,LBL=16;
  const all=series.flatMap(x=>x.values);
  // v4.2.2: chưa có số liệu thì nói rõ, không vẽ khung trống trơn trông như lỗi
  if(!all.some(v=>Number(v)>0)){
    return `<div class="chart-empty">${icon('chart',26)}<p>Chưa có số liệu cho kỳ này</p><small>Biểu đồ sẽ hiện khi có hóa đơn được phát hành và ghi nhận thanh toán.</small></div>`;
  }
  const max=Math.max(1,...all);
  const n=Math.max(1,labels.length),gw=(W-PAD*2)/n;
  const bw=Math.min(22,gw*0.32);
  const bars=series.map((sv,si)=>sv.values.map((v,i)=>{
    const bh=Math.round(v/max*(h-LBL-14));
    const x=PAD+i*gw+gw/2-(series.length*bw+2)/2+si*(bw+2);
    return `<rect x="${x.toFixed(1)}" y="${h-LBL-bh}" width="${bw.toFixed(1)}" height="${bh}" rx="2" fill="${sv.color}"><title>${sv.name} ${labels[i]}: ${isMoney?money(v):v}</title></rect>`;
  }).join('')).join('');
  const lbls=labels.map((l,i)=>`<text x="${(PAD+i*gw+gw/2).toFixed(1)}" y="${h-3}" text-anchor="middle" font-size="10" fill="#8A8179">${esc(l)}</text>`).join('');
  const legend=series.map(sv=>`<span class="chart-leg"><i style="background:${sv.color}"></i>${esc(sv.name)}</span>`).join('');
  return `<div class="chart-legend">${legend}</div><svg viewBox="0 0 ${W} ${h}" width="100%" role="img" aria-label="Biểu đồ cột doanh thu">${bars}${lbls}</svg>`;
}
function svgDonut(parts,{size=140}={}){
  if(!parts.some(p=>Number(p.value)>0)){
    return `<div class="chart-empty">${icon('home',26)}<p>Chưa có phòng nào</p><small>Thêm phòng để xem tỷ lệ trạng thái.</small></div>`;
  }
  const total=Math.max(1,parts.reduce((a,p)=>a+p.value,0));
  let acc=0;const r=15.9,cx=21,cy=21;
  const segs=parts.filter(p=>p.value>0).map(p=>{
    const frac=p.value/total,dash=frac*100;
    const seg=`<circle r="${r}" cx="${cx}" cy="${cy}" fill="transparent" stroke="${p.color}" stroke-width="6" stroke-dasharray="${dash} ${100-dash}" stroke-dashoffset="${25-acc*100}"><title>${esc(p.name)}: ${p.value}</title></circle>`;
    acc+=frac;return seg;
  }).join('');
  const legend=parts.map(p=>`<span class="chart-leg"><i style="background:${p.color}"></i>${esc(p.name)}: <b>${p.value}</b></span>`).join('');
  return `<div class="donut-wrap"><svg viewBox="0 0 42 42" width="${size}" height="${size}" role="img" aria-label="Tỷ lệ trạng thái phòng">${segs}<text x="21" y="20.6" text-anchor="middle" font-size="7" fill="#2C2723" font-weight="700">${total}</text><text x="21" y="25.4" text-anchor="middle" font-size="3.6" fill="#675F58" font-weight="600">phòng</text></svg><div class="donut-legend">${legend}</div></div>`;
}
function svgHBars(items){
  const max=Math.max(1,...items.map(x=>x.value));
  return `<div class="hbars">${items.map(x=>`<div class="hbar-row"><span class="hbar-name">${esc(x.name)}</span><div class="hbar-track"><i style="width:${Math.round(x.value/max*100)}%"></i></div><strong>${money(x.value)}</strong></div>`).join('')||'<div class="rs-empty">Không có công nợ 🎉</div>'}</div>`;
}
function last6Months(endMonth){
  const [y,m]=endMonth.split('-').map(Number);const out=[];
  for(let i=5;i>=0;i--){const d=new Date(y,m-1-i,1);out.push(d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'))}
  return out;
}
function renderDashboard(){
  const propId=reportState.propertyId;
  const props=scopedProperties();
  const rooms=visibleRooms().filter(r=>(!propId||r.propertyId===propId)&&props.some(p=>p.id===r.propertyId));
  const cnt=st=>rooms.filter(r=>r.status===st).length;
  const nRooms=rooms.length,nOcc=cnt('occupied'),nAvail=cnt('available'),nRes=cnt('reserved'),nMaint=cnt('maintenance');
  const occRate=nRooms?Math.round(100*(nOcc+nRes)/nRooms):0;
  const stats=revenueStats(reportState.month,propId);
  const la=leaseAlerts();
  const expiring=la.expiring.map(x=>x.lease).filter(l=>!propId||getRoom(l.roomId)?.propertyId===propId);
  const soon=rooms.filter(roomSoonAvailable);
  const newAppts=data.appointments.filter(a=>a.status==='new'&&(!propId||getRoom(a.roomId)?.propertyId===propId));
  const overdueTickets=data.maintenanceTickets.filter(k=>ticketOpen(k)&&(Date.now()-new Date(k.createdAt||0).getTime())>3*86400000);
  const months=last6Months(reportState.month);
  const rev=months.map(m=>revenueStats(m,propId));
  const debtByProp=props.map(p=>({name:p.name,value:data.invoices
    .filter(i=>getRoom(i.roomId)?.propertyId===p.id&&effectiveInvoiceStatus(i)!=='paid')
    .reduce((s2,i)=>s2+Math.max(0,Number(i.total)-(Number(i.depositAmount)||0)-Math.min(Number(i.amountPaid||0),Number(i.total)-(Number(i.depositAmount)||0))),0)}))
    .filter(x=>x.value>0).sort((a,b)=>b.value-a.value).slice(0,6);
  const metric=(label,val,sub,warn)=>`<div class="metric ${warn?'metric-warn':''}"><small>${label}</small><strong>${val}</strong>${sub?`<div class="trend">${sub}</div>`:''}</div>`;
  document.getElementById('view-dashboard').innerHTML=`
  <div class="panel" style="grid-column:1/-1">
    <div class="panel-head"><div><h3>Tổng quan vận hành</h3><p>Chọn tháng và căn để mọi con số bên dưới đi theo — cọc luôn tách khỏi doanh thu</p></div>
      ${can('export')?`<div class="table-actions"><button class="icon-btn" onclick="exportInvoicesCSV()">${icon('download',15)} CSV hóa đơn</button><button class="icon-btn" onclick="exportPaymentsCSV()">${icon('download',15)} CSV sổ thu</button></div>`:''}</div>
    <div class="meter-controls">
      <label>Tháng<input type="month" value="${reportState.month}" onchange="setReport('month',this.value)"></label>
      <label>Căn trọ<select onchange="setReport('propertyId',this.value)"><option value="">Tất cả căn</option>${props.map(p=>`<option value="${p.id}" ${p.id===propId?'selected':''}>${esc(p.name)}</option>`).join('')}</select></label>
    </div>
    <div class="dashboard-grid metric-grid">
      ${metric('TỔNG PHÒNG',nRooms,`${nAvail} trống · ${nRes} giữ chỗ · ${nMaint} bảo trì`)}
      ${metric('TỶ LỆ LẤP ĐẦY',occRate+'%',`${nOcc} phòng đang thuê`)}
      ${metric('DOANH THU DỰ KIẾN',money(stats.phaiThu),'Tháng '+reportState.month+' · không gồm cọc')}
      ${metric('ĐÃ THU',money(stats.daThu),'Theo sổ giao dịch')}
      ${metric('CÔNG NỢ',money(stats.conNo),stats.conNo>0?'Cần thu tiếp':'Sạch nợ',stats.conNo>0)}
      ${metric('CỌC ĐANG GIỮ',money(stats.cocDangGiu),'Sổ cọc — ngoài doanh thu')}
      ${metric('HĐ SẮP HẾT HẠN',expiring.length,'Trong 30 ngày tới',expiring.length>0)}
      ${metric('PHÒNG SẮP TRỐNG',soon.length,'Có thể chào khách mới')}
      ${metric('LỊCH HẸN MỚI',newAppts.length,newAppts.length?'Chờ liên hệ':'Không có',newAppts.length>0)}
      ${metric('SỰ CỐ QUÁ HẠN',overdueTickets.length,'Mở quá 3 ngày',overdueTickets.length>0)}
    </div>
  </div>
  <div class="panel chart-card"><div class="panel-head"><div><h3>Doanh thu 6 tháng</h3><p>Phải thu và đã thu — cọc không tính</p></div></div>
    ${svgBarChart([{name:'Phải thu',color:'#C9A86A',values:rev.map(x=>x.phaiThu)},{name:'Đã thu',color:'#4D3B30',values:rev.map(x=>x.daThu)}],months.map(m=>'T'+Number(m.slice(5))))}
  </div>
  <div class="panel chart-card"><div class="panel-head"><div><h3>Trạng thái phòng</h3><p>${propId?esc(props.find(p=>p.id===propId)?.name||''):'Toàn bộ'}</p></div></div>
    ${svgDonut([{name:'Đang thuê',value:nOcc,color:'#4D3B30'},{name:'Trống',value:nAvail,color:'#718071'},{name:'Giữ chỗ',value:nRes,color:'#B58A52'},{name:'Bảo trì',value:nMaint,color:'#C98D82'}])}
  </div>
  <div class="panel chart-card"><div class="panel-head"><div><h3>Công nợ theo căn</h3><p>Phần còn phải thu của hóa đơn chưa xong</p></div></div>
    ${svgHBars(debtByProp)}
  </div>
  <div class="panel" style="grid-column:1/-1"><div class="panel-head"><div><h3>Việc cần xử lý hôm nay</h3><p>Công nợ đến hạn, hẹn mới, hợp đồng sắp hết</p></div></div>
    ${(()=>{const items=[];
      data.invoices.filter(i=>effectiveInvoiceStatus(i)!=='paid'&&daysUntil(i.dueDate)<=3&&(!propId||getRoom(i.roomId)?.propertyId===propId)).slice(0,4).forEach(i=>{const t=getTenant(i.tenantId),r=getRoom(i.roomId);const d=daysUntil(i.dueDate);
        items.push(`<div class="tk-row"><div class="tk-main"><strong>${esc(t?.name||'')} · ${esc(r?.name||'')} · còn ${money(remainingInvoice(i))}</strong><small>${d<0?'Quá hạn '+Math.abs(d)+' ngày':d===0?'Đến hạn hôm nay':'Còn '+d+' ngày'} · HĐ ${esc(i.month)}</small></div><div class="table-actions"><button class="icon-btn" data-evt="click" data-call="openReminder" data-a1="${i.id}">${icon('bell',14)} Nhắc</button>${can('approve','payments')?`<button class="icon-btn" data-evt="click" data-call="recordPayment" data-a1="${i.id}">Thanh toán</button>`:''}</div></div>`)});
      newAppts.slice(0,3).forEach(a=>{const r=getRoom(a.roomId);items.push(`<div class="tk-row"><div class="tk-main"><strong>${esc(a.customerName)} · ${esc(a.customerPhone)}</strong><small>Hẹn xem ${esc(r?.name||'')} · ${esc(a.date)} ${esc(a.time)}</small></div><div class="table-actions"><button class="icon-btn" onclick="switchAdminView('appointments')">Mở CRM</button></div></div>`)});
      expiring.slice(0,3).forEach(l=>{const t=getTenant(l.primaryTenantId),r=getRoom(l.roomId);items.push(`<div class="tk-row"><div class="tk-main"><strong>HĐ ${esc(t?.name||'')} · ${esc(r?.name||'')}</strong><small>Hết hạn ${esc(l.endDate)} — trao đổi gia hạn sớm</small></div><div class="table-actions"><button class="icon-btn" data-evt="click" data-call="openLeaseDetail" data-a1="${l.id}">Chi tiết</button></div></div>`)});
      return items.join('')||emptyState('check','Hôm nay gọn gàng','Không có việc gấp. Có thể xem lại CRM khách hoặc chốt điện nước tháng.',`<button class="btn btn-light" onclick="switchAdminView('utilities')">Mở chốt điện nước</button>`)})()}
  </div>`;
}
function renderPropertyAdmin(){
  const root=document.getElementById('view-properties');root.innerHTML=`<div class="panel-head"><div><h3>Danh sách căn trọ</h3><p>Sửa giá trực tiếp hoặc mở “Sửa & ảnh” để cập nhật chi tiết</p></div><button class="btn btn-primary" onclick="openPropertyForm()">+ Thêm căn</button></div>`+(data.properties.length?data.properties.map(p=>{const rooms=data.rooms.filter(r=>r.propertyId===p.id),img=primaryPropertyImage(p);return `<div class="property-admin-card"><div class="property-admin-head"><div class="property-admin-title">${img?`<img class="admin-property-thumb" data-image-id="${img}">`:`<div class="admin-property-thumb room-thumb-placeholder">⌂</div>`}<div><h3>${esc(p.name)}${p.archived?' <span class="badge badge-unpaid">Đã lưu trữ</span>':''}</h3><p>${esc(p.address)} · ${rooms.length} phòng</p></div></div><div class="property-admin-actions">${p.archived?`<button class="icon-btn" data-evt="click" data-call="restoreProperty" data-a1="${p.id}">Khôi phục</button>`:`<button class="icon-btn" data-evt="click" data-call="openRoomForm" data-a1="null" data-a2="${p.id}">+ Phòng</button><button class="icon-btn" data-evt="click" data-call="openPropertyForm" data-a1="${p.id}">Sửa & ảnh</button><button class="icon-btn danger" data-evt="click" data-call="deleteProperty" data-a1="${p.id}">Lưu trữ / Xóa</button>`}</div></div><div class="property-admin-body"><div class="table-wrap"><table class="data-table"><thead><tr><th>Ảnh</th><th>Phòng</th><th>Diện tích</th><th>Giá/tháng</th><th>Cọc</th><th>Trạng thái</th><th></th></tr></thead><tbody>${rooms.length?rooms.map(r=>{const ri=primaryRoomImage(r);return `<tr>${ri?`<td><img class="thumb-mini" data-image-id="${ri}"></td>`:`<td><div class="thumb-mini room-thumb-placeholder">⌂</div></td>`}<td><strong>${esc(r.name)}</strong>${r.archived?' <span class="badge badge-unpaid">Lưu trữ</span>':''}<br><span style="color:var(--muted)">${esc(r.type)}</span></td><td>${r.area||'-'} m²</td><td><input class="inline-input" type="number" value="${Number(r.price||0)}" data-evt="change" data-call="quickRoomMoney" data-a1="${r.id}" data-a2="price" data-a3="V"></td><td><input class="inline-input" type="number" value="${Number(r.deposit||0)}" data-evt="change" data-call="quickRoomMoney" data-a1="${r.id}" data-a2="deposit" data-a3="V"></td><td><select class="select-small" data-evt="change" data-call="quickRoomStatus" data-a1="${r.id}" data-a2="V"><option value="available" ${r.status==='available'?'selected':''}>Đang trống</option><option value="reserved" ${r.status==='reserved'?'selected':''}>Giữ chỗ</option><option value="occupied" ${r.status==='occupied'?'selected':''}>Đã thuê</option><option value="maintenance" ${r.status==='maintenance'?'selected':''}>Bảo trì</option></select></td><td><div class="table-actions">${r.archived?`<button class="icon-btn" data-evt="click" data-call="restoreRoom" data-a1="${r.id}">Khôi phục</button>`:`<button class="icon-btn" data-evt="click" data-call="openRoomForm" data-a1="${r.id}">Sửa & ảnh</button><button class="icon-btn" data-evt="click" data-call="openRoomAssets" data-a1="${r.id}">Tài sản</button><button class="icon-btn danger" data-evt="click" data-call="deleteRoom" data-a1="${r.id}">Lưu trữ / Xóa</button>`}</div></td></tr>`}).join(''):'<tr><td colspan="7"><div class="empty">Chưa có phòng trong căn này.</div></td></tr>'}</tbody></table></div></div></div>`}).join(''):'<div class="empty">Chưa có căn trọ nào.</div>');hydrateImages(root)}
window.quickRoomMoney=function(id,key,value){const r=getRoom(id);if(!r)return;r[key]=Math.max(0,Number(value||0));saveData();renderPublic();showToast(key==='price'?'Đã cập nhật giá phòng':'Đã cập nhật tiền cọc')}
window.quickRoomStatus=function(id,status){const r=getRoom(id);if(!r)return;r.status=status;if(status==='occupied'&&!activeTenantForRoom(id)){reconcileRoomStatus(id);saveData();renderAdmin();renderPublic();showToast('Phòng chưa có người thuê hoạt động nên chưa thể đặt "Đã thuê". Hãy thêm người thuê trước.');return}if(status!=='maintenance'&&status!=='reserved')reconcileRoomStatus(id);saveData();renderAdmin();renderPublic();showToast('Đã đổi trạng thái phòng')}
window.deleteRoom=async function(id){const r=getRoom(id);if(!r)return;
  if(roomHasHistory(id)){
    if(!confirm('Phòng này đã có lịch sử (người thuê / điện nước / hóa đơn) nên sẽ được LƯU TRỮ thay vì xóa hẳn: ẩn khỏi trang khách, giữ nguyên hóa đơn để đối chiếu. Tiếp tục?'))return;
    r.archived=true;
    data.tenants.filter(t=>t.roomId===id&&t.active).forEach(t=>{t.active=false;t.moveOutDate=t.moveOutDate||today()});
    saveData();renderAdmin();renderPublic();showToast('Đã lưu trữ phòng');return;
  }
  if(!confirm('Xóa hẳn phòng này? Phòng chưa có lịch sử nên có thể xóa an toàn.'))return;
  for(const img of r.imageIds||[])await removeImageIfUnused(img,'room',id);
  data.rooms=data.rooms.filter(x=>x.id!==id);
  saveData();renderAdmin();renderPublic();showToast('Đã xóa phòng')}
window.restoreRoom=function(id){const r=getRoom(id);if(!r)return;r.archived=false;reconcileRoomStatus(id);saveData();renderAdmin();renderPublic();showToast('Đã khôi phục phòng')}
window.deleteProperty=async function(id){const p=getProperty(id);if(!p)return;const rooms=data.rooms.filter(r=>r.propertyId===id);
  const hasHistory=rooms.some(r=>roomHasHistory(r.id));
  if(hasHistory){
    if(!confirm('Căn trọ này đã có lịch sử nên sẽ được LƯU TRỮ thay vì xóa hẳn: ẩn khỏi trang khách, giữ nguyên hóa đơn để đối chiếu. Tiếp tục?'))return;
    p.archived=true;
    rooms.forEach(r=>{data.tenants.filter(t=>t.roomId===r.id&&t.active).forEach(t=>{t.active=false;t.moveOutDate=t.moveOutDate||today()})});
    saveData();renderAdmin();renderPublic();showToast('Đã lưu trữ căn trọ');return;
  }
  if(!confirm(`Xóa hẳn căn trọ này và ${rooms.length} phòng thuộc căn?`))return;
  for(const img of p?.imageIds||[])await removeImageIfUnused(img,'property',id);
  for(const r of rooms)for(const img of r.imageIds||[])await removeImageIfUnused(img,'room',r.id);
  const roomIds=new Set(rooms.map(r=>r.id));
  data.properties=data.properties.filter(x=>x.id!==id);
  data.rooms=data.rooms.filter(r=>!roomIds.has(r.id));
  saveData();renderAdmin();renderPublic();showToast('Đã xóa căn trọ')}
window.restoreProperty=function(id){const p=getProperty(id);if(!p)return;p.archived=false;saveData();renderAdmin();renderPublic();showToast('Đã khôi phục căn trọ')}
window.openPropertyForm=function(id=null){const p=id?getProperty(id):null;document.getElementById('propertyModalTitle').textContent=p?'Sửa căn trọ & ảnh':'Thêm căn trọ';document.getElementById('propertyId').value=p?.id||'';document.getElementById('propertyName').value=p?.name||'';document.getElementById('propertyArea').value=p?.area||'';document.getElementById('propertyAddress').value=p?.address||'';document.getElementById('propertyDescription').value=p?.description||'';document.getElementById('propertyPhone').value=p?.phone||data.settings.managerPhone||'';document.getElementById('propertySlug').value=p?.slug||'';document.getElementById('propertyImages').value='';propertyImageState={existing:[...(p?.imageIds||[])],removed:[],newFiles:[]};renderImageEditor('property');openModal('propertyModal')}
function fillRoomPropertySelect(selected){document.getElementById('roomProperty').innerHTML=data.properties.filter(p=>!p.archived||p.id===selected).map(p=>`<option value="${p.id}" ${p.id===selected?'selected':''}>${esc(p.name)}</option>`).join('')}
window.openRoomForm=function(id=null,propertyId=null){if(!data.properties.length){showToast('Hãy tạo ít nhất 1 căn trọ trước.');return}const r=id?getRoom(id):null;document.getElementById('roomModalTitle').textContent=r?'Sửa phòng & ảnh':'Thêm phòng';document.getElementById('roomId').value=r?.id||'';fillRoomPropertySelect(r?.propertyId||propertyId||data.properties[0].id);document.getElementById('roomName').value=r?.name||'';document.getElementById('roomPrice').value=r?.price||'';document.getElementById('roomDeposit').value=r?.deposit||'';document.getElementById('roomArea').value=r?.area||'';document.getElementById('roomCapacity').value=r?.capacity||2;document.getElementById('roomType').value=r?.type||'Phòng trọ';document.getElementById('roomStatus').value=r?.status||'available';document.getElementById('roomElectricRate').value=r?.electricRate||3500;document.getElementById('roomWaterMode').value=r?.waterMode||'fixed';document.getElementById('roomWaterRate').value=r?.waterRate||15000;document.getElementById('roomWaterFixed').value=r?.waterFixed||0;document.getElementById('roomAmenities').value=(r?.amenities||[]).join(', ');document.getElementById('roomNote').value=r?.note||'';document.getElementById('roomSlug').value=r?.slug||'';document.getElementById('roomAvailableFrom').value=r?.availableFrom||'';document.getElementById('roomPolicies').value=r?.policies||'';document.getElementById('roomImages').value='';roomImageState={existing:[...(r?.imageIds||[])],removed:[],newFiles:[]};renderImageEditor('room');openModal('roomModal')}

// ---------- Tenants ----------
function fillTenantRoomSelect(selected){document.getElementById('tenantRoom').innerHTML=data.rooms.filter(r=>!r.archived||r.id===selected).map(r=>{const p=getProperty(r.propertyId);return `<option value="${r.id}" ${r.id===selected?'selected':''}>${esc(p?.name||'')} · ${esc(r.name)}</option>`}).join('')}
window.openTenantForm=function(id=null,roomId=null){if(!data.rooms.length){showToast('Hãy tạo phòng trước.');return}const t=id?getTenant(id):null;document.getElementById('tenantModalTitle').textContent=t?'Sửa người thuê':'Thêm người thuê';document.getElementById('tenantId').value=t?.id||'';document.getElementById('tenantName').value=t?.name||'';document.getElementById('tenantPhone').value=t?.phone||'';fillTenantRoomSelect(t?.roomId||roomId||data.rooms[0].id);document.getElementById('tenantMoveIn').value=t?.moveInDate||today();document.getElementById('tenantActive').value=String(t?.active!==false);const rr=getRoom(t?.roomId||roomId||data.rooms[0].id);document.getElementById('tenantDepositRequired').value=t?.depositRequired??rr?.deposit??0;document.getElementById('tenantDepositPaid').value=t?.depositPaid??0;document.getElementById('tenantNote').value=t?.note||'';openModal('tenantModal')}
function tenantHasPin(t){if(!t)return false;const a=accountForOccupant(t.id);return !!((a&&(a.hasPin||a.pin))||t.hasPin||t.pin)}
function renderTenants(){const root=document.getElementById('view-tenants');
  const st=ui('tenants');const q=st.q.toLowerCase();
  let list=[...data.tenants];
  if(q)list=list.filter(t=>{const r=getRoom(t.roomId);return [t.name,t.phone,r?.name].join(' ').toLowerCase().includes(q)});
  if(st.filter==='active')list=list.filter(t=>t.active);
  if(st.filter==='inactive')list=list.filter(t=>!t.active);
  list.sort((a,b)=>String(a.name).localeCompare(String(b.name),'vi'));
  const {slice,nav}=paginate(list,'tenants');
  root.innerHTML=`<div class="panel"><div class="panel-head"><div><h3>Người thuê & tài khoản cư dân</h3><p>Tài khoản cư dân dùng số điện thoại + mã PIN 6 số (PIN chỉ hiển thị một lần khi tạo/đặt lại)</p></div>${can('create','tenants')?`<button class="btn btn-primary" onclick="openTenantForm()">${icon('plus',15)} Thêm người thuê</button>`:''}</div>
  <div class="table-tools">
    <span class="tt-search">${icon('search',15)}<input value="${esc(st.q)}" placeholder="Tìm tên, SĐT, phòng…" aria-label="Tìm người thuê" oninput="uiSet('tenants','q',this.value)"></span>
    <select aria-label="Lọc người thuê" onchange="uiSet('tenants','filter',this.value)">
      <option value="all" ${st.filter==='all'?'selected':''}>Tất cả</option>
      <option value="active" ${st.filter==='active'?'selected':''}>Đang thuê</option>
      <option value="inactive" ${st.filter==='inactive'?'selected':''}>Đã trả phòng</option>
    </select>
  </div>
  <div class="table-wrap"><table class="data-table"><thead><tr><th>Người thuê</th><th>Điện thoại</th><th>Phòng</th><th>Cọc phải đóng</th><th>Đã nhận</th><th>Còn thiếu</th><th>Tài khoản</th><th></th></tr></thead><tbody>${slice.length?slice.map(t=>{const r=getRoom(t.roomId),p=getProperty(r?.propertyId);return `<tr><td><strong>${esc(t.name)}</strong><br><span style="color:var(--muted)">${t.active?'Đang thuê':'Đã trả phòng'+(t.moveOutDate?' '+esc(t.moveOutDate):'')}</span></td><td>${esc(t.phone)}</td><td>${esc(p?.name||'')} · ${esc(r?.name||'-')}</td><td>${money(t.depositRequired)}</td><td>${money(t.depositPaid)}</td><td>${money(Math.max(0,t.depositRequired-t.depositPaid))}</td><td>${tenantHasPin(t)?'<span class="badge badge-paid">Đã có PIN</span>':'<span class="badge badge-unpaid">Chưa có PIN</span>'}</td><td><div class="table-actions"><button class="icon-btn" data-act="tenantEdit" data-id="${esc(t.id)}">Sửa</button><button class="icon-btn" data-act="tenantPin" data-id="${esc(t.id)}">Đặt lại PIN</button><button class="icon-btn danger" data-act="tenantDelete" data-id="${esc(t.id)}">${data.invoices.some(i=>i.tenantId===t.id)?'Lưu trữ':'Xóa'}</button></div></td></tr>`}).join(''):`<tr><td colspan="8">${data.tenants.length?emptyState('search','Không khớp bộ lọc','Thử từ khóa khác hoặc chuyển bộ lọc về Tất cả.',''):emptyState('users','Chưa có người thuê','Tạo hợp đồng từ CRM khách xem phòng, hoặc thêm trực tiếp tại đây.',`<button class="btn btn-primary" onclick="openTenantForm()">${icon('plus',15)} Thêm người thuê</button>`)}</td></tr>`}</tbody></table></div>${nav}</div>`}
function showPinModal(t,pin){
  const r=getRoom(t.roomId);
  document.getElementById('pinDisplay').textContent=pin;
  const brand=(data.settings.brandName||'Huy Rooms');
  const text=`${brand} - thông tin đăng nhập cư dân\nSố điện thoại: ${t.phone}\nMã PIN: ${pin}\nPhòng: ${r?.name||''}\nĐăng nhập tại website để xem tiền phòng, điện, nước, tiền cọc và lịch sử hóa đơn.`;
  const btn=document.getElementById('pinCopyBtn');
  btn.onclick=()=>copyText(text,'Đã sao chép nội dung gửi cư dân');
  openModal('pinModal');
}
window.resetTenantPin=async function(id){
  const t=getTenant(id);if(!t)return;
  if(!confirm(`Đặt lại mã PIN cho ${t.name}? PIN cũ sẽ không dùng được nữa.`))return;
  if(Sync.isOn()&&Sync.isAdmin()){
    showToast('Đang tạo mã PIN mới…');
    try{
      const res=await Sync.setTenantPin(t.id);
      t.hasPin=true;saveLocal();renderTenants();applyTableLabels(document.getElementById('adminApp'));
      showPinModal(t,res.pin);
    }catch(err){showToast('Chưa đặt lại được PIN: '+(err.message||err))}
    return;
  }
  // Bản chạy hoàn toàn trên máy (không máy chủ): PIN nằm trên TÀI KHOẢN đăng nhập, tách khỏi hồ sơ người ở
  const pin=String(Math.floor(100000+Math.random()*900000));
  const acc=ensureAccountFor(t);
  if(!acc){showToast('Người thuê chưa có số điện thoại nên không tạo được tài khoản đăng nhập.');return}
  acc.pin=pin;acc.active=true;t.pin='';
  saveData();renderTenants();applyTableLabels(document.getElementById('adminApp'));
  showPinModal(t,pin);
}
window.deleteTenant=function(id){
  const t=getTenant(id);if(!t)return;
  const roomId=t.roomId;
  const hasInvoices=data.invoices.some(i=>i.tenantId===id)||data.leaseOccupants.some(x=>x.occupantId===id&&leaseHasInvoices(x.leaseId));
  if(hasInvoices){
    if(!confirm('Người thuê này đã có hóa đơn nên sẽ được LƯU TRỮ (chuyển thành "Đã trả phòng", giữ toàn bộ lịch sử). Tiếp tục?'))return;
    t.active=false;t.moveOutDate=t.moveOutDate||today();
    const lz=leaseForOccupant(id);
    if(lz&&liveLease(lz)){
      if(lz.primaryTenantId===id){lz.status='ended';lz.moveOutAt=t.moveOutDate;leaseOccupantsOf(lz.id).forEach(lo=>{lo.leftAt=lz.moveOutAt})}
      else leaseOccupantsOf(lz.id).forEach(lo=>{if(lo.occupantId===id)lo.leftAt=t.moveOutDate});
    }
    reconcileRoomStatus(roomId);
    saveData();renderAdmin();renderPublic();showToast('Đã lưu trữ người thuê');return;
  }
  if(!confirm('Xóa hẳn người thuê này? Người thuê chưa có hóa đơn nên có thể xóa an toàn.'))return;
  data.tenants=data.tenants.filter(x=>x.id!==id);
  reconcileRoomStatus(roomId);
  saveData();renderAdmin();renderPublic();showToast('Đã xóa người thuê')}

// ---------- Utilities ----------
function roomOptionHtml(selected){return data.rooms.filter(r=>!r.archived||r.id===selected).map(r=>{const p=getProperty(r.propertyId);return `<option value="${r.id}" ${r.id===selected?'selected':''}>${esc(p?.name||'')} · ${esc(r.name)}</option>`}).join('')}
function calcUtilityFromForm(){const es=Number(document.getElementById('electricStart').value||0),ee=Number(document.getElementById('electricEnd').value||0),er=Number(document.getElementById('electricRate').value||0);const eu=Math.max(0,ee-es),ea=eu*er;document.getElementById('electricUnitsPreview').textContent=`${eu.toLocaleString('vi-VN')} kWh`;document.getElementById('electricPreview').textContent=money(ea);const wm=document.getElementById('waterMode').value;document.querySelectorAll('.water-meter-field').forEach(e=>e.classList.toggle('hidden',wm==='fixed'));document.querySelectorAll('.water-fixed-field').forEach(e=>e.classList.toggle('hidden',wm!=='fixed'));let wu=0,wa=0;if(wm==='fixed'){wa=Number(document.getElementById('waterFixed').value||0);document.getElementById('waterUnitsPreview').textContent='Cố định'}else{const ws=Number(document.getElementById('waterStart').value||0),we=Number(document.getElementById('waterEnd').value||0),wr=Number(document.getElementById('waterRate').value||0);wu=Math.max(0,we-ws);wa=wu*wr;document.getElementById('waterUnitsPreview').textContent=`${wu.toLocaleString('vi-VN')} m³`}document.getElementById('waterPreview').textContent=money(wa);return{electricUnits:eu,electricAmount:ea,waterUnits:wu,waterAmount:wa}}
function readingLockedByPaidInvoice(readingId){if(!readingId)return false;return data.invoices.some(i=>i.readingId===readingId&&i.status==='paid')}
function updateUtilityGapNote(roomId,month,previous){
  const note=document.getElementById('utilitySmartNote');if(!note)return;
  if(previous&&previous.month!==prevMonth(month)){
    note.innerHTML=`⚠️ Chỉ số gần nhất của phòng này là tháng <strong>${esc(previous.month)}</strong> — đã bỏ trống ${'tháng ở giữa. Đầu kỳ đang lấy theo cuối kỳ '+esc(previous.month)+', hãy kiểm tra lại trước khi lưu.'}`;
  }else{
    note.innerHTML='💡 Đầu kỳ sẽ tự lấy từ cuối kỳ tháng trước nếu có dữ liệu. Anh chỉ cần kiểm tra và nhập chỉ số cuối tháng.';
  }
}
function loadReadingIntoForm(u){
  document.getElementById('utilityId').value=u.id;
  document.getElementById('electricStart').value=u.electricStart??'';document.getElementById('electricEnd').value=u.electricEnd??'';document.getElementById('electricRate').value=u.electricRate??3500;
  document.getElementById('waterMode').value=u.waterMode||'fixed';document.getElementById('waterStart').value=u.waterStart??'';document.getElementById('waterEnd').value=u.waterEnd??'';
  document.getElementById('waterRate').value=u.waterRate??15000;document.getElementById('waterFixed').value=u.waterFixed??0;
  document.getElementById('utilityOtherFee').value=u.otherFee??0;document.getElementById('utilityNote').value=u.note||'';
  calcUtilityFromForm();
}
function smartPrefillUtility(force=false){
  const roomId=document.getElementById('utilityRoom').value,month=document.getElementById('utilityMonth').value;
  if(!roomId||!month)return;
  // Mỗi phòng chỉ có 1 bản ghi cho mỗi tháng: nếu đã có thì mở bản ghi đó để sửa
  const existing=data.utilityReadings.find(u=>u.roomId===roomId&&u.month===month);
  if(existing&&existing.id!==document.getElementById('utilityId').value){
    loadReadingIntoForm(existing);
    updateUtilityGapNote(roomId,month,null);
    showToast('Tháng này đã có chỉ số cho phòng — đã mở bản ghi đó để sửa');
    return;
  }
  if(!existing)document.getElementById('utilityId').value='';
  const r=getRoom(roomId);
  document.getElementById('electricRate').value=r?.electricRate||3500;document.getElementById('waterMode').value=r?.waterMode||'fixed';
  document.getElementById('waterRate').value=r?.waterRate||15000;document.getElementById('waterFixed').value=r?.waterFixed||0;
  const previous=[...data.utilityReadings].filter(u=>u.roomId===roomId&&u.month<month).sort((a,b)=>b.month.localeCompare(a.month))[0];
  updateUtilityGapNote(roomId,month,previous);
  if(force||!document.getElementById('utilityId').value){
    document.getElementById('electricStart').value=previous?.electricEnd??'';document.getElementById('electricEnd').value='';
    document.getElementById('waterStart').value=previous?.waterEnd??'';document.getElementById('waterEnd').value='';
  }
  calcUtilityFromForm();
}
window.openUtilityForm=function(id=null,roomId=null){if(!data.rooms.length){showToast('Chưa có phòng để ghi điện nước.');return}const u=id?getReading(id):null;
  if(u&&readingLockedByPaidInvoice(u.id)&&!confirm('Chỉ số này đã gắn với hóa đơn ĐÃ THANH TOÁN. Mở khóa để sửa? (Sửa xong nên kiểm tra lại hóa đơn liên quan.)'))return;
  document.getElementById('utilityId').value=u?.id||'';
  const firstRoom=data.rooms.find(r=>!r.archived)||data.rooms[0];
  document.getElementById('utilityRoom').innerHTML=roomOptionHtml(u?.roomId||roomId||firstRoom.id);
  document.getElementById('utilityMonth').value=u?.month||monthNow();
  if(u){loadReadingIntoForm(u);updateUtilityGapNote(u.roomId,u.month,null)}
  else{document.getElementById('utilityOtherFee').value=0;document.getElementById('utilityNote').value='';smartPrefillUtility(true)}
  openModal('utilityModal')}
function renderUtilities(){
  const props=scopedProperties();
  if(!meterBoard.propertyId||!props.some(p=>p.id===meterBoard.propertyId))meterBoard.propertyId=props[0]?.id||'';
  const rooms=meterBoardRooms();
  const entered=rooms.filter(r=>{const rec=findReading(r.id,meterBoard.month);return rec&&rec.electricEnd!==''&&rec.electricEnd!==undefined&&rec.electricEnd!==null});
  const finals=rooms.filter(r=>findReading(r.id,meterBoard.month)?.status==='final');
  const boardHtml=`<div class="panel">
    <div class="panel-head"><div><h3>Chốt điện nước tháng</h3><p>Nhập cuối kỳ liên tục cho cả căn trên một màn hình — đầu kỳ tự lấy từ tháng trước, lưu nháp ngay khi nhập</p></div>
      <button class="btn btn-primary" onclick="openBulkInvoice()">🧾 Tạo hóa đơn hàng loạt</button></div>
    <div class="meter-controls">
      <label>Căn trọ<select onchange="setMeterBoard('propertyId',this.value)">${props.map(p=>`<option value="${p.id}" ${p.id===meterBoard.propertyId?'selected':''}>${esc(p.name)}</option>`).join('')}</select></label>
      <label>Tháng<input type="month" value="${meterBoard.month}" onchange="setMeterBoard('month',this.value)"></label>
      <div class="meter-progress">${entered.length}/${rooms.length} phòng đã nhập · ${finals.length} đã chốt</div>
      <button class="btn btn-light" onclick="finalizeMeterMonth()">🔒 Chốt kỳ ${meterBoard.month}</button>
    </div>
    ${rooms.length?rooms.map(r=>meterRowHtml(r,meterBoard.month)).join(''):'<div class="empty">Căn này chưa có phòng đang cho thuê.</div>'}
  </div>
  <div class="panel"><div class="panel-head"><div><h3>Dịch vụ áp dụng cho hợp đồng</h3><p>Wifi, rác, giữ xe… — tính cố định/phòng, theo người, theo số lượng hoặc nhập tay; gắn vào từng hợp đồng trong Chi tiết hợp đồng</p></div><button class="btn btn-primary" onclick="openServiceForm()">+ Dịch vụ</button></div>
    <div class="table-wrap"><table class="data-table"><thead><tr><th>Dịch vụ</th><th>Cách tính</th><th>Đơn giá hiện tại</th><th>Thuế</th><th>Đang dùng</th><th></th></tr></thead><tbody>
    ${data.serviceDefinitions.filter(x=>!x.archived).map(sv=>{const used=data.leaseServices.filter(ls=>ls.serviceId===sv.id&&!ls.endedAt).length;
      return `<tr><td><strong>${esc(sv.name)}</strong>${sv.note?`<br><span style="color:var(--muted)">${esc(sv.note)}</span>`:''}</td><td>${calcTypeLabel(sv.calcType)}</td><td>${money(sv.price)}${sv.unit?'/'+esc(sv.unit):''}</td><td>${sv.taxPercent?sv.taxPercent+'%':'—'}</td><td>${used} hợp đồng</td><td><div class="table-actions"><button class="icon-btn" data-evt="click" data-call="openServiceForm" data-a1="${sv.id}">Sửa / đổi giá</button><button class="icon-btn danger" data-evt="click" data-call="archiveService" data-a1="${sv.id}">Ngừng</button></div></td></tr>`}).join('')||'<tr><td colspan="6"><div class="empty">Chưa khai báo dịch vụ nào.</div></td></tr>'}
    </tbody></table></div></div>
  `;
  const ust=ui('utilities');
  let sorted=[...data.utilityReadings].sort((a,b)=>(b.month+b.roomId).localeCompare(a.month+a.roomId));
  if(ust.q)sorted=sorted.filter(u=>{const r=getRoom(u.roomId);return (u.month+' '+(r?.name||'')).toLowerCase().includes(ust.q.toLowerCase())});
  const {slice:uSlice,nav:uNav}=paginate(sorted,'utilities',12);
  document.getElementById('view-utilities').innerHTML=boardHtml+`<div class="panel"><div class="panel-head"><div><h3>Lịch sử chỉ số</h3><p>Kỳ đã chốt bị khóa — muốn sửa phải mở khóa kèm lý do</p></div><button class="btn btn-light" onclick="openUtilityForm()">${icon('plus',15)} Ghi chỉ số lẻ</button></div>
  <div class="table-tools"><span class="tt-search">${icon('search',15)}<input value="${esc(ust.q)}" placeholder="Tìm theo tháng hoặc phòng…" aria-label="Tìm chỉ số" oninput="uiSet('utilities','q',this.value)"></span></div>
  <div class="table-wrap"><table class="data-table"><thead><tr><th>Tháng</th><th>Phòng</th><th>Điện đầu → cuối</th><th>kWh</th><th>Tiền điện</th><th>Nước</th><th>Tiền nước</th><th>Trạng thái</th><th></th></tr></thead><tbody>${uSlice.length?uSlice.map(u=>{const r=getRoom(u.roomId),p=getProperty(r?.propertyId);const hasInvoice=data.invoices.some(i=>i.readingId===u.id);return `<tr><td><strong>${esc(u.month)}</strong></td><td>${esc(p?.name||'')} · ${esc(r?.name||'-')}</td><td>${u.electricStart} → ${u.electricEnd}</td><td>${u.electricUnits} kWh</td><td>${money(u.electricAmount)}</td><td>${u.waterMode==='fixed'?'Cố định':`${u.waterStart} → ${u.waterEnd} (${u.waterUnits} m³)`}</td><td>${money(u.waterAmount)}</td><td>${u.status==='final'?'<span class="badge badge-paid">Đã chốt</span>':'<span class="badge badge-unpaid">Nháp</span>'}${(u.imageIds||[]).length?` <button class="icon-btn" data-evt="click" data-call="openMeterPhotos" data-a1="${u.id}">📷${u.imageIds.length}</button>`:''}</td><td><div class="table-actions">${u.status==='final'?`<button class="icon-btn danger" data-evt="click" data-call="unlockReading" data-a1="${u.id}">Mở khóa</button>`:`<button class="icon-btn" data-evt="click" data-call="openUtilityForm" data-a1="${u.id}">Sửa</button>`}<button class="icon-btn" data-evt="click" data-call="openInvoiceForm" data-a1="${u.id}">${hasInvoice?'Xem/Lập lại HĐ':'Lập hóa đơn'}</button><button class="icon-btn danger" data-evt="click" data-call="deleteReading" data-a1="${u.id}">Xóa</button></div></td></tr>`}).join(''):`<tr><td colspan="9">${emptyState('zap','Chưa có chỉ số nào','Chọn căn và tháng ở bảng chốt phía trên rồi nhập số cuối kỳ cho từng phòng.','')}</td></tr>`}</tbody></table></div>${uNav}</div>`}
window.deleteReading=function(id){
  {const u0=getReading(id);if(u0&&u0.status==='final'){showToast('Kỳ đã chốt không xóa được. Hãy mở khóa kèm lý do trước.');return}}
  if(readingLockedByPaidInvoice(id)){
    if(!confirm('Chỉ số này đã gắn với hóa đơn ĐÃ THANH TOÁN. Bạn chắc chắn muốn mở khóa và xóa? Hóa đơn vẫn giữ nguyên số tiền đã ghi.'))return;
  }else if(!confirm('Xóa bản ghi điện nước này?'))return;
  data.invoices.forEach(i=>{if(i.readingId===id)i.readingId=''});
  data.utilityReadings=data.utilityReadings.filter(x=>x.id!==id);
  saveData();renderAdmin();showToast('Đã xóa chỉ số')}

// ---------- Invoices ----------
function calcInvoicePreview(){const roomId=document.getElementById('invoiceRoom').value,t=activeTenantForRoom(roomId);const dep=t?Math.max(0,t.depositRequired-t.depositPaid):0;const include=document.getElementById('invoiceIncludeDeposit').value==='true';const total=['invoiceRent','invoiceElectric','invoiceWater','invoiceOther'].reduce((s,id)=>s+Number(document.getElementById(id).value||0),0)+(include?dep:0);document.getElementById('invoiceTotalPreview').textContent=money(total);return{total,depositAmount:include?dep:0}}
/** Nạp lại toàn bộ số liệu hóa đơn theo đúng phòng + tháng đang chọn (không giữ dữ liệu phòng/tháng trước). */
function refreshInvoiceForm(){
  const roomId=document.getElementById('invoiceRoom').value,month=document.getElementById('invoiceMonth').value;
  const r=getRoom(roomId),t=activeTenantForRoom(roomId);
  const note=document.getElementById('invoiceTenantNote'),btn=document.getElementById('invoiceSubmit');
  const u=data.utilityReadings.find(x=>x.roomId===roomId&&x.month===month);
  const existing=t?data.invoices.find(i=>i.tenantId===t.id&&i.roomId===roomId&&i.month===month):null;
  document.getElementById('invoiceReadingId').value=u?.id||'';
  if(note)note.innerHTML=t
    ?`🧾 Người thuê trong kỳ: <strong>${esc(t.name)}</strong> · ${esc(t.phone)}${u?'':' · <em>Chưa có chỉ số điện nước tháng này</em>'}${existing?' · <strong>Đang sửa hóa đơn đã có</strong>':''}`
    :'⚠️ Phòng này chưa có người thuê đang hoạt động — không thể lập hóa đơn.';
  if(btn)btn.disabled=!t;
  const lease=activeLeaseForRoom(roomId);
  document.getElementById('invoiceLeaseId').value=existing?.leaseId||lease?.id||'';
  document.getElementById('invoiceDueDate').value=existing?.dueDate||nextDayISO(Number(lease?.billingDay||data.settings.defaultDueDay||5));
  // Giá thuê lấy theo HỢP ĐỒNG (đã chốt) — không lấy giá niêm yết hiện tại của phòng
  document.getElementById('invoiceRent').value=existing?.rent??lease?.rentAmount??r?.price??0;
  document.getElementById('invoiceElectric').value=existing?.electric??u?.electricAmount??0;
  document.getElementById('invoiceWater').value=existing?.water??u?.waterAmount??0;
  document.getElementById('invoiceOther').value=existing?.other??u?.otherFee??0;
  document.getElementById('invoiceIncludeDeposit').value=String((existing?.depositAmount||0)>0);
  calcInvoicePreview();
}
window.openInvoiceForm=function(readingId=null){if(!data.rooms.length){showToast('Chưa có phòng.');return}
  const u=readingId?getReading(readingId):null;
  const roomId=u?.roomId||data.rooms.find(r=>!r.archived&&activeTenantForRoom(r.id))?.id||data.rooms[0].id;
  const t=activeTenantForRoom(roomId);
  if(!u&&!t){showToast('Phòng này chưa có người thuê đang hoạt động. Hãy tạo người thuê trước.');return}
  document.getElementById('invoiceRoom').innerHTML=roomOptionHtml(roomId);
  document.getElementById('invoiceMonth').value=u?.month||monthNow();
  refreshInvoiceForm();
  openModal('invoiceModal')}
function renderInvoices(){
  const st=ui('invoices');
  let list=[...data.invoices];
  const q=st.q.toLowerCase();
  if(q)list=list.filter(i=>{const t=getTenant(i.tenantId),r=getRoom(i.roomId);
    return [i.code,i.month,t?.name,t?.phone,r?.name].join(' ').toLowerCase().includes(q)});
  if(st.filter!=='all')list=list.filter(i=>effectiveInvoiceStatus(i)===st.filter);
  const sorts={month:(a,b)=>(b.month+b.createdAt).localeCompare(a.month+a.createdAt),
    total:(a,b)=>b.total-a.total,remaining:(a,b)=>remainingInvoice(b)-remainingInvoice(a),
    due:(a,b)=>String(a.dueDate||'9').localeCompare(String(b.dueDate||'9'))};
  list.sort(sorts[st.sort]||sorts.month);
  const debt=data.invoices.reduce((s2,i)=>s2+remainingInvoice(i),0);
  const {slice,nav}=paginate(list,'invoices');
  document.getElementById('view-invoices').innerHTML=`<div class="panel"><div class="panel-head"><div><h3>Hóa đơn & công nợ</h3><p>Tổng còn phải thu: ${money(debt)}</p></div>${can('create','invoices')?`<button class="btn btn-primary" onclick="openInvoiceForm()">${icon('plus',15)} Lập hóa đơn</button>`:''}</div>
  <div class="table-tools">
    <span class="tt-search">${icon('search',15)}<input value="${esc(st.q)}" placeholder="Tìm mã HĐ, tên, SĐT, phòng…" aria-label="Tìm hóa đơn" oninput="uiSet('invoices','q',this.value)"></span>
    <select aria-label="Lọc trạng thái" onchange="uiSet('invoices','filter',this.value)">
      <option value="all" ${st.filter==='all'?'selected':''}>Mọi trạng thái</option>
      <option value="unpaid" ${st.filter==='unpaid'?'selected':''}>Chưa thu</option>
      <option value="partial" ${st.filter==='partial'?'selected':''}>Thu một phần</option>
      <option value="overdue" ${st.filter==='overdue'?'selected':''}>Quá hạn</option>
      <option value="paid" ${st.filter==='paid'?'selected':''}>Đã thu đủ</option>
    </select>
    <select aria-label="Sắp xếp" onchange="uiSet('invoices','sort',this.value)">
      <option value="month" ${st.sort==='month'?'selected':''}>Mới nhất</option>
      <option value="remaining" ${st.sort==='remaining'?'selected':''}>Còn nợ nhiều nhất</option>
      <option value="total" ${st.sort==='total'?'selected':''}>Tổng lớn nhất</option>
      <option value="due" ${st.sort==='due'?'selected':''}>Hạn gần nhất</option>
    </select>
  </div>
  <div class="table-wrap"><table class="data-table"><thead><tr><th>Tháng</th><th>Người thuê</th><th>Căn / Phòng</th><th>Tổng</th><th>Đã thu</th><th>Còn lại</th><th>Hạn</th><th>Trạng thái</th><th></th></tr></thead><tbody>
  ${slice.length?slice.map(i=>{const t=getTenant(i.tenantId),r=getRoom(i.roomId),p=getProperty(r?.propertyId);
    return `<tr><td><strong>${esc(i.month)}</strong>${i.code?`<br><span style="color:var(--muted)">${esc(i.code)}</span>`:''}</td><td>${esc(t?.name||'')}<br><span style="color:var(--muted)">${esc(t?.phone||'')}</span></td><td>${esc(p?.name||'')} · ${esc(r?.name||'-')}</td><td><strong>${money(i.total)}</strong></td><td>${money(i.amountPaid)}</td><td><strong>${money(remainingInvoice(i))}</strong></td><td>${esc(i.dueDate||'-')}</td><td>${invoiceBadge(i)}</td><td><div class="table-actions">${can('approve','payments')?`<button class="icon-btn" data-act="recordPayment" data-id="${esc(i.id)}">Thanh toán</button>`:''}<button class="icon-btn" data-act="payHistory" data-id="${esc(i.id)}">Sổ thu</button><button class="icon-btn" data-act="invoicePdf" data-id="${esc(i.id)}">PDF</button><button class="icon-btn" data-act="reminder" data-id="${esc(i.id)}">Nhắc</button>${can('edit','invoices')?`<button class="icon-btn danger" data-act="deleteInvoice" data-id="${esc(i.id)}">Xóa</button>`:''}</div></td></tr>`}).join('')
  :`<tr><td colspan="9">${data.invoices.length?emptyState('search','Không khớp bộ lọc','Thử xóa từ khóa hoặc đổi trạng thái lọc.',''):emptyState('receipt','Chưa có hóa đơn nào','Chốt điện nước xong, dùng "Tạo hóa đơn hàng loạt" để phát hành cho cả căn trong một lần.',`<button class="btn btn-primary" onclick="switchAdminView('utilities')">Mở chốt điện nước</button>`)}</td></tr>`}
  </tbody></table></div>${nav}</div>`;
}
window.recordPayment=function(id){const i=getInvoice(id);if(!i)return;const t=getTenant(i.tenantId),r=getRoom(i.roomId);const remaining=remainingInvoice(i);
  document.getElementById('paymentInvoiceId').value=i.id;
  document.getElementById('paymentSummary').innerHTML=`<h4>Hóa đơn ${esc(i.month)} · ${esc(t?.name||'')} · ${esc(r?.name||'')}</h4><p>Tổng ${money(i.total)} · Đã thu ${money(i.amountPaid)} · Còn lại <strong>${money(remaining)}</strong></p>`;
  document.getElementById('paymentAmount').value=remaining||'';
  document.getElementById('paymentDate').value=today();
  document.getElementById('paymentMethod').value='cash';
  document.getElementById('paymentNote').value='';
  openModal('paymentModal');
}
document.getElementById('paymentForm').addEventListener('submit',e=>{e.preventDefault();
  const i=getInvoice(document.getElementById('paymentInvoiceId').value);
  if(!i){showToast('Không tìm thấy hóa đơn. Hãy đóng cửa sổ và thử lại.');return}
  let amount=Number(document.getElementById('paymentAmount').value||0);
  const remaining=remainingInvoice(i);
  if(amount<=0){showToast('Số tiền thu phải lớn hơn 0.');return}
  if(amount>remaining){amount=remaining;showToast('Số tiền vượt phần còn lại nên chỉ ghi nhận đúng phần còn thiếu.')}
  const payDate=document.getElementById('paymentDate').value||today();
  const oldApplied=!!i.depositApplied;
  // Mỗi lần thu là MỘT GIAO DỊCH trong sổ ThanhToan; amountPaid/trạng thái tính lại từ sổ
  addPayment(i.id,{amount,paidAt:payDate,method:document.getElementById('paymentMethod').value,
    reference:document.getElementById('paymentRef')?.value?.trim()||'',
    note:document.getElementById('paymentNote').value.trim()});
  const t=getTenant(i.tenantId);
  if(i.status==='paid'&&i.depositAmount>0&&!oldApplied&&t){t.depositPaid=Math.min(t.depositRequired,t.depositPaid+i.depositAmount);i.depositApplied=true}
  else if(i.status!=='paid'&&oldApplied&&t){t.depositPaid=Math.max(0,t.depositPaid-i.depositAmount);i.depositApplied=false}
  saveData();closeModal('paymentModal');renderAdmin();
  if(!residentSession&&currentResidentId===i.tenantId)renderResident();
  showToast(`Đã ghi nhận ${money(amount)} (${i.status==='paid'?'hóa đơn đã thanh toán đủ':'còn lại '+money(remainingInvoice(i))})`);
});
window.deleteInvoice=function(id){
  const netPaid=paidOfInvoice(id);
  if(netPaid>0){showToast('Hóa đơn đã có tiền thu trong sổ. Hãy đảo các giao dịch trước rồi mới xóa được.');return}
  if(!confirm('Xóa hóa đơn này?'))return;
  const i=getInvoice(id),t=getTenant(i?.tenantId);
  if(i?.depositApplied&&t)t.depositPaid=Math.max(0,t.depositPaid-i.depositAmount);
  data.invoices=data.invoices.filter(x=>x.id!==id);
  saveData();renderAdmin();showToast('Đã xóa hóa đơn')}
window.copyZaloReminder=function(id){const i=getInvoice(id);if(!i)return;const t=getTenant(i.tenantId),r=getRoom(i.roomId),p=getProperty(r?.propertyId);const text=`Xin chào ${t?.name||'anh/chị'}, ${data.settings.managerName||'quản lý'} nhắc hóa đơn tháng ${i.month} của phòng ${r?.name||''} - ${p?.name||''}.\nTiền phòng: ${money(i.rent)}\nTiền điện: ${money(i.electric)}\nTiền nước: ${money(i.water)}\nPhí khác: ${money(i.other)}${i.depositAmount?`\nTiền cọc: ${money(i.depositAmount)}`:''}\nTổng: ${money(i.total)}\nĐã thanh toán: ${money(i.amountPaid)}\nCòn lại: ${money(remainingInvoice(i))}\nHạn thanh toán: ${i.dueDate||'-'}.\nCảm ơn anh/chị.`;copyText(text,'Đã sao chép tin nhắn. Có thể dán vào Zalo của khách.')}
function copyText(text,msg){if(navigator.clipboard?.writeText){navigator.clipboard.writeText(text).then(()=>showToast(msg)).catch(()=>fallbackCopy(text,msg))}else fallbackCopy(text,msg)}
function fallbackCopy(text,msg){const ta=document.createElement('textarea');ta.value=text;document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove();showToast(msg)}

// ---------- Appointments ----------

/* ==================================================================
   v6 — ICON LUCIDE (SVG inline, không dùng emoji cho nghiệp vụ chính)
   ================================================================== */
const ICONS={
  dashboard:'<rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>',
  home:'<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
  filetext:'<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>',
  users:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  zap:'<path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/>',
  receipt:'<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 17.5v-11"/>',
  calendar:'<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>',
  wrench:'<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
  settings:'<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
  search:'<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  phone:'<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>',
  message:'<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
  bell:'<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  menu:'<line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/>',
  x:'<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  check:'<path d="M20 6 9 17l-5-5"/>',
  alert:'<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  camera:'<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>',
  download:'<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>',
  clock:'<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  plus:'<path d="M5 12h14"/><path d="M12 5v14"/>',
  logout:'<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/>',
  back:'<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',
  key:'<path d="m15.5 7.5 2.3 2.3a1 1 0 0 0 1.4 0l2.1-2.1a1 1 0 0 0 0-1.4L19 4"/><path d="m21 2-9.6 9.6"/><circle cx="7.5" cy="15.5" r="5.5"/>',
  shield:'<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
  book:'<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>',
  chart:'<path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>',
  pin:'<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
  ruler:'<path d="m14.5 12.5 2-2"/><path d="m11.5 9.5 2-2"/><path d="m8.5 6.5 2-2"/><path d="m17.5 15.5 2-2"/><path d="M21.34 8.34a2 2 0 0 0 0-2.83l-2.85-2.85a2 2 0 0 0-2.83 0L2.34 15.98a2 2 0 0 0 0 2.83l2.85 2.85a2 2 0 0 0 2.83 0Z"/>',
  users2:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'
};
function icon(name,size=18,cls=''){
  const d=ICONS[name]||ICONS.home;
  return `<svg class="lc ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
}

/* ==================================================================
   v6 — PHÂN QUYỀN CLIENT: owner / manager / accountant / staff
   Quyền theo hành động (xem/tạo/sửa/duyệt/xuất) + theo căn.
   Máy chủ chặn thêm ở tầng collection (ROLE_WRITE trong Code.gs).
   ================================================================== */
const PERM={
  owner:{all:true},
  manager:{view:'*',create:'*',edit:'*',approve:'*',export:'*',deny:['staffUsers']},
  accountant:{view:'*',create:['payments','depositLedger','invoices','reminders','serviceDefinitions','leaseServices','notifications'],
    edit:['payments','depositLedger','invoices','reminders','serviceDefinitions','leaseServices'],
    approve:['payments','invoices'],export:'*'},
  staff:{view:'*',create:['appointments','maintenanceTickets','utilityReadings','notifications'],
    edit:['appointments','maintenanceTickets','utilityReadings'],approve:[],export:[]}
};
function currentRole(){const st=Sync.staff&&Sync.staff();return st?st.role:'owner'}
function roleIsPending(){return currentRole()==='pending'}
function currentStaffName(){const st=Sync.staff&&Sync.staff();return st?st.name:'Chủ nhà'}
/** can('edit','rooms') / can('approve','invoices') / can('export') */
function can(action,module){
  if(roleIsPending())return false; // chưa xác minh vai trò sau reload → khóa hết, chờ máy chủ
  const p=PERM[currentRole()]||PERM.staff;
  if(p.all)return true;
  if(p.deny&&module&&p.deny.includes(module))return false;
  const rule=p[action];
  if(rule==='*')return true;
  if(Array.isArray(rule))return module?rule.includes(module):rule.length>0;
  return false;
}
function denyToast(){showToast('Vai trò '+({owner:'Chủ nhà',manager:'Quản lý',accountant:'Kế toán',staff:'Nhân viên'}[currentRole()]||currentRole())+' không có quyền thao tác này.')}
/** Căn trọ trong phạm vi được giao (owner/không giới hạn = tất cả). */
function scopedProperties(){
  const st=Sync.staff&&Sync.staff();
  const all=visibleProperties();
  if(!st||!st.propertyIds||!st.propertyIds.length)return all;
  return all.filter(p=>st.propertyIds.includes(p.id));
}
/** Nhật ký cục bộ (khi KHÔNG có máy chủ — online thì máy chủ tự ghi kèm before/after). */
function auditLocal(action,col,recordId,before,after){
  if(Sync.isOn&&Sync.isOn())return;
  data.auditLog=Array.isArray(data.auditLog)?data.auditLog:[];
  data.auditLog.push({id:uid('au'),at:new Date().toISOString(),actor:'Chủ nhà (máy này)',role:'owner',
    action,col,recordId:String(recordId||''),before:before||null,after:after||null,note:''});
  if(data.auditLog.length>500)data.auditLog=data.auditLog.slice(-500);
}


/* ==================================================================
   v6 — COMMAND PALETTE (Ctrl/Cmd+K) + tìm kiếm toàn cục mobile
   ================================================================== */
let palIndex=[],palSel=0;
function buildPalIndex(q){
  q=q.toLowerCase().trim();
  const out=[];
  const add=(type,label,sub,run)=>out.push({type,label,sub,run});
  // Hành động nhanh
  const acts=[
    ['Mở tổng quan','dashboard',()=>switchAdminView('dashboard')],
    ['Mở căn trọ & phòng','home',()=>switchAdminView('properties')],
    ['Mở hợp đồng','filetext',()=>switchAdminView('leases')],
    ['Mở người thuê','users',()=>switchAdminView('tenants')],
    ['Mở điện nước','zap',()=>switchAdminView('utilities')],
    ['Mở hóa đơn','receipt',()=>switchAdminView('invoices')],
    ['Mở CRM khách xem','calendar',()=>switchAdminView('appointments')],
    ['Mở sự cố','wrench',()=>switchAdminView('tickets')],
    ['Mở cài đặt','settings',()=>switchAdminView('settings')]
  ];
  if(can('create','leases'))acts.push(['Tạo hợp đồng mới','plus',()=>{switchAdminView('leases');openLeaseForm()}]);
  if(can('create','tenants'))acts.push(['Thêm người thuê','plus',()=>{switchAdminView('tenants');openTenantForm()}]);
  if(can('approve','invoices'))acts.push(['Tạo hóa đơn hàng loạt','plus',()=>{switchAdminView('utilities');openBulkInvoice()}]);
  acts.forEach(([label,ic,run])=>{if(!q||label.toLowerCase().includes(q))add(ic,label,'Hành động',run)});
  if(!q)return out.slice(0,9);
  // Dữ liệu
  visibleRooms().filter(r=>{const p=getProperty(r.propertyId);return (r.name+' '+(p?.name||'')).toLowerCase().includes(q)}).slice(0,4)
    .forEach(r=>{const p=getProperty(r.propertyId);add('home',`${r.name} · ${p?.name||''}`,`Phòng · ${statusLabel(r.status)} · ${money(r.price)}/tháng`,()=>{switchAdminView('properties');setTimeout(()=>openRoomForm(r.id),50)})});
  data.tenants.filter(t=>(t.name+' '+t.phone).toLowerCase().includes(q)).slice(0,4)
    .forEach(t=>{const r=getRoom(t.roomId);add('users',`${t.name} · ${t.phone}`,`Người thuê · ${r?.name||'-'}`,()=>{setUi('tenants',{q:t.phone,page:1});switchAdminView('tenants')})});
  data.leases.filter(l=>{const t=getTenant(l.primaryTenantId),r=getRoom(l.roomId);return [t?.name,t?.phone,r?.name].join(' ').toLowerCase().includes(q)}).slice(0,3)
    .forEach(l=>{const t=getTenant(l.primaryTenantId),r=getRoom(l.roomId);add('filetext',`HĐ ${t?.name||''} · ${r?.name||''}`,`Hợp đồng · ${leaseStatusLabel(l.status)}`,()=>openLeaseDetail(l.id))});
  data.invoices.filter(i=>{const t=getTenant(i.tenantId);return (String(i.code)+' '+i.month+' '+(t?.name||'')).toLowerCase().includes(q)}).slice(0,3)
    .forEach(i=>{const t=getTenant(i.tenantId);add('receipt',`${i.code||i.month} · ${t?.name||''}`,`Hóa đơn · còn ${money(remainingInvoice(i))}`,()=>{setUi('invoices',{q:String(i.code||i.month),page:1});switchAdminView('invoices')})});
  data.appointments.filter(a=>(a.customerName+' '+a.customerPhone).toLowerCase().includes(q)).slice(0,3)
    .forEach(a=>add('calendar',`${a.customerName} · ${a.customerPhone}`,`Lead · ${LEAD_STATUS[a.status]||a.status}`,()=>switchAdminView('appointments')));
  data.maintenanceTickets.filter(k=>(k.title+' '+(k.description||'')).toLowerCase().includes(q)).slice(0,3)
    .forEach(k=>add('wrench',k.title,`Sự cố · ${TICKET_STATUS[k.status]||k.status}`,()=>switchAdminView('tickets')));
  return out.slice(0,12);
}
function renderPalette(){
  const box=document.getElementById('palResults');if(!box)return;
  box.innerHTML=palIndex.length?palIndex.map((x,i)=>`<button class="pal-item ${i===palSel?'sel':''}" data-pi="${i}" data-evt="click" data-call="palRun" data-a1="${i}">${icon(x.type,17)}<span><strong>${esc(x.label)}</strong><small>${esc(x.sub)}</small></span></button>`).join('')
    :emptyState('search','Không tìm thấy','Thử tên người thuê, số điện thoại, tên phòng hoặc mã hóa đơn.','');
}
window.palRun=function(i){const x=palIndex[i];if(!x)return;closePalette();x.run()}
window.openPalette=function(){
  document.getElementById('palModal').classList.remove('hidden');
  const inp=document.getElementById('palInput');inp.value='';palSel=0;
  palIndex=buildPalIndex('');renderPalette();
  setTimeout(()=>inp.focus(),30);
}
window.closePalette=function(){document.getElementById('palModal').classList.add('hidden')}
document.addEventListener('keydown',e=>{
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){
    if(document.getElementById('adminApp').classList.contains('hidden'))return;
    e.preventDefault();openPalette();return;
  }
  const pal=document.getElementById('palModal');
  if(!pal||pal.classList.contains('hidden'))return;
  if(e.key==='Escape'){closePalette()}
  else if(e.key==='ArrowDown'){e.preventDefault();palSel=Math.min(palIndex.length-1,palSel+1);renderPalette()}
  else if(e.key==='ArrowUp'){e.preventDefault();palSel=Math.max(0,palSel-1);renderPalette()}
  else if(e.key==='Enter'){e.preventDefault();palRun(palSel)}
});

/* ==================================================================
   v6 — TRẠNG THÁI BẢNG (tìm kiếm / lọc / sắp xếp / trang) LƯU LẠI
   ================================================================== */
const UI_KEY='huyrooms_admin_ui_v6';
let uiState={};
try{uiState=JSON.parse(localStorage.getItem(UI_KEY)||'{}')}catch(e){uiState={}}
function ui(view){uiState[view]=uiState[view]||{q:'',sort:'',page:1,filter:'all'};return uiState[view]}
function setUi(view,patch){Object.assign(ui(view),patch);try{localStorage.setItem(UI_KEY,JSON.stringify(uiState))}catch(e){}}
window.uiSet=function(view,field,value){const p={};p[field]=value;if(field!=='page')p.page=1;setUi(view,p);
  ({invoices:renderInvoices,tenants:renderTenants,leases:renderLeases,utilities:renderUtilities,tickets:renderTicketsAdmin})[view]?.()}
function paginate(list,view,perPage=15){
  const st=ui(view);
  const pages=Math.max(1,Math.ceil(list.length/perPage));
  if(st.page>pages)st.page=pages;
  const slice=list.slice((st.page-1)*perPage,st.page*perPage);
  const nav=pages>1?`<div class="pager" role="navigation" aria-label="Phân trang">
    <button class="icon-btn" ${st.page<=1?'disabled':''} data-evt="click" data-call="uiSet" data-a1="${view}" data-a2="page" data-a3="${st.page-1}" aria-label="Trang trước">‹</button>
    <span>Trang ${st.page}/${pages} · ${list.length} dòng</span>
    <button class="icon-btn" ${st.page>=pages?'disabled':''} data-evt="click" data-call="uiSet" data-a1="${view}" data-a2="page" data-a3="${st.page+1}" aria-label="Trang sau">›</button>
  </div>`:'';
  return {slice,nav};
}
function searchBox(view,placeholder){
  const st=ui(view);
  return `<div class="table-tools"><span class="tt-search">${icon('search',15)}<input value="${esc(st.q)}" placeholder="${esc(placeholder)}" aria-label="${esc(placeholder)}" data-evt="input" data-call="uiSet" data-a1="${view}" data-a2="q" data-a3="V"></span></div>`;
}
function emptyState(ic,title,desc,btn){
  return `<div class="empty-v6">${icon(ic,34)}<h4>${esc(title)}</h4><p>${desc}</p>${btn||''}</div>`;
}

/* ==================================================================
   CRM KHÁCH XEM PHÒNG (v5): new → contacted → appointment_confirmed →
   viewed → reserved → lease_draft → converted / lost
   ================================================================== */
const LEAD_STATUS={new:'Mới',contacted:'Đã liên hệ',appointment_confirmed:'Hẹn đã chốt',viewed:'Đã xem phòng',reserved:'Đang giữ chỗ',lease_draft:'Soạn hợp đồng',converted:'Đã ký HĐ',lost:'Không thành'};
const LEAD_SOURCE={website:'Website',facebook:'Facebook',zalo:'Zalo',walkin:'Khách ghé',referral:'Giới thiệu',other:'Khác'};
function leadOpen(a){return !['converted','lost'].includes(a.status)}
function leadLog(a,note,channel){a.careLog=Array.isArray(a.careLog)?a.careLog:[];a.careLog.push({at:new Date().toISOString(),by:'Quản lý',channel:channel||'note',note:String(note||'')})}
function leadBadge(st){const cls=st==='converted'?'paid':st==='lost'?'unpaid':st==='reserved'||st==='lease_draft'?'partial':'unpaid';return `<span class="badge badge-${cls}">${LEAD_STATUS[st]||'Không xác định'}</span>`}
window.leadSetStatus=function(id,st){
  const a=data.appointments.find(x=>x.id===id);if(!a)return;
  if(a.status===st)return;
  leadLog(a,'Chuyển trạng thái: '+(LEAD_STATUS[a.status]||a.status)+' → '+(LEAD_STATUS[st]||st),'status');
  a.status=st;
  saveData();renderAppointments();
}
window.leadSetSource=function(id,src){const a=data.appointments.find(x=>x.id===id);if(!a)return;a.source=src;saveData()}
window.leadAddCare=function(id){
  const a=data.appointments.find(x=>x.id===id);if(!a)return;
  const note=prompt('Ghi chú chăm sóc (gọi điện, nhắn Zalo, hẹn lại…):','');
  if(note===null||!note.trim())return;
  leadLog(a,note.trim(),'care');
  if(a.status==='new')a.status='contacted';
  saveData();renderAppointments();showToast('Đã ghi lịch sử chăm sóc.');
}
window.leadReschedule=function(id){
  const a=data.appointments.find(x=>x.id===id);if(!a)return;
  document.getElementById('resLeadId').value=id;
  document.getElementById('resDate').value=a.date;document.getElementById('resDate').min=today();
  const busy=new Set(data.appointments.filter(x=>x.id!==id&&x.roomId===a.roomId&&x.date===a.date&&!['cancelled','lost'].includes(x.status)).map(x=>x.time));
  document.getElementById('resTime').innerHTML=workSlots().map(t=>`<option value="${t}" ${busy.has(t)?'disabled':''} ${t===a.time?'selected':''}>${t}${busy.has(t)?' — bận':''}</option>`).join('');
  openModal('rescheduleModal');
}
window.refreshRescheduleSlots=function(){
  const id=document.getElementById('resLeadId').value;
  const a=data.appointments.find(x=>x.id===id);if(!a)return;
  const date=document.getElementById('resDate').value;
  const busy=new Set(data.appointments.filter(x=>x.id!==id&&x.roomId===a.roomId&&x.date===date&&!['cancelled','lost'].includes(x.status)).map(x=>x.time));
  document.getElementById('resTime').innerHTML=workSlots().map(t=>`<option value="${t}" ${busy.has(t)?'disabled':''}>${t}${busy.has(t)?' — bận':''}</option>`).join('');
}
document.getElementById('rescheduleForm').addEventListener('submit',e=>{
  e.preventDefault();
  const a=data.appointments.find(x=>x.id===document.getElementById('resLeadId').value);if(!a)return;
  const date=document.getElementById('resDate').value,time=document.getElementById('resTime').value;
  const clash=data.appointments.some(x=>x.id!==a.id&&x.roomId===a.roomId&&x.date===date&&x.time===time&&!['cancelled','lost'].includes(x.status));
  if(clash){showToast('Khung giờ này đã có khách khác. Chọn giờ khác giúp anh.');return}
  leadLog(a,`Đổi lịch: ${a.date} ${a.time} → ${date} ${time}`,'reschedule');
  a.date=date;a.time=time;
  if(['new','contacted'].includes(a.status))a.status='appointment_confirmed';
  saveData();closeModal('rescheduleModal');renderAppointments();showToast('Đã đổi lịch hẹn.');
});
/* Giữ chỗ: ghi tiền + hạn giữ, phòng chuyển sang "Đã giữ chỗ" */
window.leadReserve=function(id){
  const a=data.appointments.find(x=>x.id===id);if(!a)return;
  const r=getRoom(a.roomId);
  document.getElementById('rsvLeadId').value=id;
  document.getElementById('rsvSummary').innerHTML=`<h4>${esc(a.customerName)} · ${esc(r?.name||'')}</h4><p>SĐT ${esc(a.customerPhone)} · Cọc phòng niêm yết ${money(r?.deposit)}</p>`;
  document.getElementById('rsvAmount').value=a.reserveAmount||Math.min(500000,Number(r?.deposit||500000));
  document.getElementById('rsvUntil').value=a.reserveUntil||nextDayISO(3);
  document.getElementById('rsvUntil').min=today();
  openModal('reserveModal');
}
document.getElementById('reserveForm').addEventListener('submit',e=>{
  e.preventDefault();
  const a=data.appointments.find(x=>x.id===document.getElementById('rsvLeadId').value);if(!a)return;
  const amount=Number(document.getElementById('rsvAmount').value||0);
  const until=document.getElementById('rsvUntil').value;
  if(amount<=0||!until||until<today()){showToast('Nhập tiền giữ chỗ và hạn giữ hợp lệ.');return}
  const r=getRoom(a.roomId);
  a.reserveAmount=amount;a.reserveUntil=until;a.status='reserved';
  leadLog(a,`Giữ chỗ ${money(amount)} đến hết ${until}`,'reserve');
  if(r&&r.status==='available'){r.status='reserved'}
  saveData();closeModal('reserveModal');renderAdmin();renderPublic();
  showToast('Đã ghi giữ chỗ — phòng chuyển sang trạng thái Đã giữ chỗ.');
});
/* Hết hạn giữ chỗ: quản lý XÁC NHẬN mới trả phòng về trạng thái phù hợp */
window.releaseExpiredHold=function(id){
  const a=data.appointments.find(x=>x.id===id);if(!a)return;
  if(!confirm(`Khách ${a.customerName} chưa ký sau hạn giữ ${a.reserveUntil}. Trả phòng về "Đang trống" và đóng lead?`))return;
  const r=getRoom(a.roomId);
  if(r&&r.status==='reserved'&&!activeLeaseForRoom(r.id))r.status='available';
  leadLog(a,'Hết hạn giữ chỗ, chưa ký hợp đồng — trả phòng, đóng lead','release');
  a.status='lost';
  saveData();renderAdmin();renderPublic();
  showToast('Đã trả phòng về Đang trống.');
}
/* Chuyển lead thành hợp đồng: KHÔNG nhập lại tên / SĐT / phòng */
let pendingLeadId='';
window.convertLeadToLease=function(id){
  const a=data.appointments.find(x=>x.id===id);if(!a)return;
  const phone=normalizePhone(a.customerPhone);
  const existing=data.tenants.find(t=>normalizePhone(t.phone)===phone&&t.active);
  pendingLeadId=id;
  a.status='lease_draft';leadLog(a,'Bắt đầu soạn hợp đồng','convert');saveData();
  switchAdminView('leases');
  openLeaseForm(null,a.roomId);
  const sel=document.getElementById('leaseOccupant');
  if(existing){sel.value=existing.id}
  else{
    sel.value='__new';toggleLeaseNewOccupant();
    document.getElementById('leaseNewName').value=a.customerName;
    document.getElementById('leaseNewPhone').value=a.customerPhone;
  }
  if(a.reserveAmount>0)document.getElementById('leaseDepositPaid').value=a.reserveAmount;
  document.getElementById('leaseSnapshotNote').innerHTML+=`<div class="smart-note">Đang chuyển từ lead <strong>${esc(a.customerName)} · ${esc(a.customerPhone)}</strong>${a.reserveAmount?` — tiền giữ chỗ ${money(a.reserveAmount)} sẽ tính vào cọc đã đóng`:''}. Lưu hợp đồng xong lead tự chuyển "Đã ký HĐ".</div>`;
  showToast('Thông tin khách + phòng đã điền sẵn từ lead — kiểm tra rồi lưu.');
}
function completeLeadConversion(lease){
  if(!pendingLeadId)return;
  const a=data.appointments.find(x=>x.id===pendingLeadId);
  pendingLeadId='';
  if(!a)return;
  a.status='converted';a.convertedLeaseId=lease.id;
  leadLog(a,'Đã ký hợp đồng '+lease.id,'convert');
}
function renderAppointments(){
  const sorted=[...data.appointments].sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time));
  const openLeads=sorted.filter(leadOpen);
  const expiredHolds=sorted.filter(a=>a.status==='reserved'&&a.reserveUntil&&a.reserveUntil<today());
  const shown=leadFilter==='open'?openLeads:leadFilter==='all'?sorted:sorted.filter(a=>a.status===leadFilter);
  document.getElementById('view-appointments').innerHTML=`
  ${expiredHolds.length?`<div class="panel" style="border:2px solid #C9A86A"><div class="panel-head"><div><h3>${icon('alert',16)} Hết hạn giữ chỗ (${expiredHolds.length})</h3><p>Khách chưa ký sau hạn giữ — xác nhận để trả phòng về trạng thái phù hợp</p></div></div>
    ${expiredHolds.map(a=>{const r=getRoom(a.roomId);return `<div class="tk-row"><div class="tk-main"><strong>${esc(a.customerName)} · ${esc(r?.name||'')}</strong><small>Giữ ${money(a.reserveAmount)} đến ${esc(a.reserveUntil)} — đã quá hạn</small></div><div class="table-actions"><button class="btn btn-primary" data-act="leadRelease" data-id="${esc(a.id)}">Xác nhận trả phòng</button><button class="icon-btn" data-act="leadConvert" data-id="${esc(a.id)}">Vẫn ký HĐ</button></div></div>`}).join('')}</div>`:''}
  <div class="panel"><div class="panel-head"><div><h3>Khách xem phòng (CRM)</h3><p>${openLeads.length} lead đang theo · phễu: mới → liên hệ → chốt hẹn → đã xem → giữ chỗ → soạn HĐ → ký/thôi</p></div>
    <select class="select-small" onchange="setLeadFilter(this.value)">
      <option value="open" ${leadFilter==='open'?'selected':''}>Đang theo</option>
      <option value="all" ${leadFilter==='all'?'selected':''}>Tất cả</option>
      ${Object.entries(LEAD_STATUS).map(([k,v])=>`<option value="${k}" ${leadFilter===k?'selected':''}>${v}</option>`).join('')}
    </select></div>
  ${shown.length?shown.map(a=>{
    const r=getRoom(a.roomId),p=getProperty(r?.propertyId);
    const d=new Date(`${a.date}T00:00:00`);
    const care=(a.careLog||[]).slice(-3).reverse();
    return `<div class="lead-card ${a.status==='reserved'?'lead-reserved':''}">
      <div class="appt-date"><strong>${String(d.getDate()).padStart(2,'0')}</strong><small>TH${d.getMonth()+1}</small></div>
      <div class="lead-info">
        <strong>${esc(a.customerName)} · ${esc(a.customerPhone)}</strong> ${leadBadge(a.status)}
        <span>${esc(p?.name||'')} · ${esc(r?.name||'-')} · ${esc(a.time)} ngày ${esc(a.date)}</span>
        <small>Nguồn: <select class="select-inline" data-chg="leadSource" data-id="${esc(a.id)}">${Object.entries(LEAD_SOURCE).map(([k,v])=>`<option value="${k}" ${a.source===k?'selected':''}>${v}</option>`).join('')}</select>
        ${a.reserveAmount?` · Giữ ${money(a.reserveAmount)} đến ${esc(a.reserveUntil)}`:''}${a.note?` · ${esc(a.note)}`:''}</small>
        ${care.length?`<div class="lead-care">${care.map(c=>`<div class="rem-log">${icon('message',12)} ${esc((c.at||'').slice(5,16).replace('T',' '))} · ${esc(c.note)}</div>`).join('')}</div>`:''}
      </div>
      <div class="lead-actions">
        <select class="select-small" data-chg="leadStatus" data-id="${esc(a.id)}" aria-label="Trạng thái lead">${Object.entries(LEAD_STATUS).map(([k,v])=>`<option value="${k}" ${a.status===k?'selected':''}>${v}</option>`).join('')}</select>
        <div class="table-actions">
          <button class="icon-btn" data-act="leadCare" data-id="${esc(a.id)}" aria-label="Ghi chăm sóc">${icon('message',14)} Chăm sóc</button>
          ${leadOpen(a)?`<button class="icon-btn" data-act="leadReschedule" data-id="${esc(a.id)}">Đổi lịch</button>`:''}
          ${leadOpen(a)&&a.status!=='reserved'?`<button class="icon-btn" data-act="leadReserve" data-id="${esc(a.id)}">Giữ chỗ</button>`:''}
          ${leadOpen(a)?`<button class="icon-btn" data-act="leadConvert" data-id="${esc(a.id)}">→ Hợp đồng</button>`:''}
          ${a.convertedLeaseId?`<button class="icon-btn" data-act="leaseDetail" data-id="${esc(a.convertedLeaseId)}">Xem HĐ</button>`:''}
          <button class="icon-btn danger" data-act="leadDelete" data-id="${esc(a.id)}">Xóa</button>
        </div>
      </div>
    </div>`}).join(''):'<div class="empty">Không có lead nào trong bộ lọc này.</div>'}
  </div>`;
}
let leadFilter='open';
window.setLeadFilter=function(v){leadFilter=v;renderAppointments()}
window.updateAppointmentStatus=function(id,status){const a=data.appointments.find(x=>x.id===id);if(!a)return;a.status=status;saveData();renderAdmin();showToast('Đã cập nhật lịch hẹn')}
window.deleteAppointment=function(id){if(!confirm('Xóa lịch hẹn này?'))return;data.appointments=data.appointments.filter(a=>a.id!==id);saveData();renderAdmin();showToast('Đã xóa lịch hẹn')}

// ---------- Settings / export ----------



/* ---------- Quản lý sự cố + soạn thông báo (v4 giai đoạn 4) ---------- */
let ticketFilter='open';
window.setTicketFilter=function(v){ticketFilter=v;renderTicketsAdmin()}
function pushTicketStatus(k,status,note){
  const now=new Date().toISOString();
  k.status=status;
  k.statusHistory=Array.isArray(k.statusHistory)?k.statusHistory:[];
  k.statusHistory.push({at:now,status,by:'Quản lý',note:note||''});
  if(status==='done'||status==='cancelled')k.closedAt=now;
}
window.ticketAction=function(id,action){
  const k=data.maintenanceTickets.find(x=>x.id===id);if(!k)return;
  if(action==='assign'){
    const name=prompt('Giao cho ai xử lý? (tên người phụ trách)',k.assigneeId||'');
    if(name===null)return;
    k.assigneeId=name.trim();
    if(k.status==='new')pushTicketStatus(k,'received','Giao cho '+k.assigneeId);
    else k.statusHistory.push({at:new Date().toISOString(),status:k.status,by:'Quản lý',note:'Đổi người xử lý: '+k.assigneeId});
  }
  if(action==='received')pushTicketStatus(k,'received','');
  if(action==='progress')pushTicketStatus(k,'in_progress','');
  if(action==='waiting'){const note=prompt('Lý do chờ (vật tư, hẹn khách…):','');if(note===null)return;pushTicketStatus(k,'waiting',note.trim())}
  if(action==='done'){
    const res=prompt('Kết quả xử lý (cư dân sẽ thấy):','');
    if(res===null)return;
    k.resolution=res.trim();
    pushTicketStatus(k,'done',res.trim());
    notifyTenant(k.tenantId,'maintenance','Sự cố đã xử lý xong','“'+k.title+'” đã được xử lý.'+(k.resolution?' Kết quả: '+k.resolution:''),k.id);
  }
  if(action==='cancel'){const note=prompt('Lý do hủy:','');if(note===null)return;pushTicketStatus(k,'cancelled',note.trim())}
  saveData();renderTicketsAdmin();
}
function notifyTenant(tenantId,kind,title,body,refId){
  data.notifications.push({id:uid('nt'),tenantId:tenantId||'',kind,title:String(title).slice(0,120),
    body:String(body).slice(0,500),refId:refId||'',createdBy:'admin',createdAt:new Date().toISOString(),readAt:''});
}
function renderTicketsAdmin(){
  const root=document.getElementById('view-tickets');if(!root)return;
  const all=[...data.maintenanceTickets].sort((a,b)=>String(b.createdAt).localeCompare(a.createdAt));
  const list=all.filter(k=>ticketFilter==='all'?true:ticketFilter==='open'?ticketOpen(k):k.status===ticketFilter);
  const openCount=all.filter(ticketOpen).length;
  root.innerHTML=`
  <div class="panel"><div class="panel-head"><div><h3>Sự cố cư dân báo</h3><p>${openCount} sự cố đang mở — tiếp nhận, phân công và cập nhật để cư dân thấy tiến độ</p></div>
    <select class="select-small" onchange="setTicketFilter(this.value)">
      <option value="open" ${ticketFilter==='open'?'selected':''}>Đang mở</option>
      <option value="all" ${ticketFilter==='all'?'selected':''}>Tất cả</option>
      ${Object.entries(TICKET_STATUS).map(([k2,v])=>`<option value="${k2}" ${ticketFilter===k2?'selected':''}>${v}</option>`).join('')}
    </select></div>
  ${list.length?list.map(k=>{const t=getTenant(k.tenantId),r=getRoom(k.roomId);
    return `<div class="tk-row ${k.priority==='urgent'?'tk-urgent':''}">
      <div class="tk-main rs-click" data-evt="click" data-call="openTicketDetail" data-a1="${k.id}">
        <strong>${esc(k.title)}</strong> ${ticketBadge(k.status)}${k.priority!=='normal'?` <span class="badge badge-partial">${TICKET_PRIORITY[k.priority]}</span>`:''}
        <small>${esc(r?.name||'?')} · ${esc(t?.name||'?')} · ${esc((k.createdAt||'').slice(0,16).replace('T',' '))}${k.assigneeId?` · 👤 ${esc(k.assigneeId)}`:''}${(k.imageIds||[]).length?` · ${icon('camera',12)}${k.imageIds.length}`:''}</small>
      </div>
      <div class="table-actions">
        ${k.status==='new'?`<button class="icon-btn" data-evt="click" data-call="ticketAction" data-a1="${k.id}" data-a2="received">Tiếp nhận</button>`:''}
        ${ticketOpen(k)?`<button class="icon-btn" data-evt="click" data-call="ticketAction" data-a1="${k.id}" data-a2="assign">Phân công</button>`:''}
        ${['received','waiting'].includes(k.status)?`<button class="icon-btn" data-evt="click" data-call="ticketAction" data-a1="${k.id}" data-a2="progress">Bắt đầu</button>`:''}
        ${k.status==='in_progress'?`<button class="icon-btn" data-evt="click" data-call="ticketAction" data-a1="${k.id}" data-a2="waiting">Chờ</button>`:''}
        ${ticketOpen(k)?`<button class="icon-btn" data-evt="click" data-call="ticketAction" data-a1="${k.id}" data-a2="done">✔ Xong</button><button class="icon-btn danger" data-evt="click" data-call="ticketAction" data-a1="${k.id}" data-a2="cancel">Hủy</button>`:''}
      </div>
    </div>`}).join(''):'<div class="empty">Không có sự cố nào trong bộ lọc này.</div>'}
  </div>
  <div class="panel"><div class="panel-head"><div><h3>Gửi thông báo cho cư dân</h3><p>Thông báo chung (mọi cư dân) hoặc riêng một người — hiện trong cổng cư dân, mục Thông báo</p></div></div>
    <div class="form-grid">
      <label>Gửi tới<select id="ntTarget"><option value="">📢 Tất cả cư dân</option>${data.tenants.filter(t=>t.active).map(t=>`<option value="${t.id}">${esc(t.name)} · ${esc(getRoom(t.roomId)?.name||'')}</option>`).join('')}</select></label>
      <label>Loại<select id="ntKind"><option value="general">Thông báo chung</option><option value="maintenance">Lịch bảo trì</option></select></label>
      <label class="span-2">Tiêu đề<input id="ntTitle" maxlength="120" placeholder="VD: Cắt nước bảo trì sáng thứ 7"></label>
      <label class="span-2">Nội dung<textarea id="ntBody" rows="3" maxlength="500" style="width:100%;font:inherit;padding:10px;border:1px solid var(--line);border-radius:11px"></textarea></label>
      <div class="form-actions span-2"><button class="btn btn-primary" onclick="sendAdminNotice()">Gửi thông báo</button></div>
    </div>
    ${data.notifications.filter(n=>['general','maintenance'].includes(n.kind)).slice(-5).reverse().map(n=>`<div class="rem-log">${noticeIcon(n.kind)} ${esc(n.title)} · ${n.tenantId?esc(getTenant(n.tenantId)?.name||''):'tất cả'} · ${esc(String(n.createdAt).slice(0,16).replace('T',' '))} <button class="icon-btn danger" data-evt="click" data-call="deleteNotice" data-a1="${n.id}">Xóa</button></div>`).join('')}
  </div>`;
}
window.sendAdminNotice=function(){
  const title=document.getElementById('ntTitle').value.trim();
  const body=document.getElementById('ntBody').value.trim();
  if(!title){showToast('Nhập tiêu đề thông báo.');return}
  notifyTenant(document.getElementById('ntTarget').value,document.getElementById('ntKind').value,title,body,'');
  saveData();renderTicketsAdmin();showToast('Đã gửi thông báo — cư dân sẽ thấy khi mở cổng cư dân.');
}
window.deleteNotice=function(id){
  data.notifications=data.notifications.filter(n=>n.id!==id);saveData();renderTicketsAdmin();
}
/* Gửi qua Zalo OA (adapter máy chủ) — không bao giờ giả vờ đã gửi khi chưa cấu hình */
window.sendReminderZalo=async function(){
  const inv=getInvoice(document.getElementById('remInvoiceId').value);if(!inv)return;
  if(!Sync.isOn()||!Sync.isAdmin()){showToast('Cần kết nối máy chủ với quyền quản lý để gửi Zalo OA.');return}
  const kind=document.getElementById('remKind').value;
  const msg=document.getElementById('remText').value;
  try{
    const res=await Sync.sendZalo(inv.tenantId,msg);
    if(res.mock){
      showToast('CHẾ ĐỘ THỬ: tin KHÔNG gửi thật (ZALO_OA_MOCK đang bật).');
      data.reminders.push({id:uid('rem'),invoiceId:inv.id,tenantId:inv.tenantId,kind,channel:'zalo_mock (thử — chưa gửi thật)',message:msg,sentAt:new Date().toISOString(),sentBy:'admin',createdAt:new Date().toISOString()});
    }else{
      showToast('Đã gửi qua Zalo OA.');
      data.reminders.push({id:uid('rem'),invoiceId:inv.id,tenantId:inv.tenantId,kind,channel:'zalo_oa',message:msg,sentAt:new Date().toISOString(),sentBy:'admin',createdAt:new Date().toISOString()});
    }
    saveData();openReminder(inv.id);
  }catch(err){
    showToast(err.message||'Chưa gửi được qua Zalo OA.');
  }
}

/* ==================================================================
   BỘ MÁY HÓA ĐƠN HÀNG THÁNG (v4 giai đoạn 3)
   ================================================================== */

function prevMonthOf(month){const [y,m]=month.split('-').map(Number);const d=new Date(y,m-2,1);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')}
function findReading(roomId,month){return data.utilityReadings.find(u=>u.roomId===roomId&&u.month===month)}
function computeReadingAmounts(room,rec){
  rec.electricRate=Number(rec.electricRate||room.electricRate||3500);
  rec.electricUnits=Math.max(0,Number(rec.electricEnd||0)-Number(rec.electricStart||0));
  rec.electricAmount=rec.electricUnits*rec.electricRate;
  rec.waterMode=rec.waterMode||room.waterMode||'fixed';
  if(rec.waterMode==='meter'){
    rec.waterRate=Number(rec.waterRate||room.waterRate||15000);
    rec.waterUnits=Math.max(0,Number(rec.waterEnd||0)-Number(rec.waterStart||0));
    rec.waterAmount=rec.waterUnits*rec.waterRate;
  }else{
    rec.waterFixed=Number(rec.waterFixed||room.waterFixed||0);
    rec.waterUnits=0;rec.waterAmount=rec.waterFixed;
  }
  return rec;
}
/** Cảnh báo cho một phòng trong bảng chốt: số âm, tăng bất thường, thiếu kỳ trước, chưa nhập. */
function meterWarnings(room,month){
  const rec=findReading(room.id,month),prev=findReading(room.id,prevMonthOf(month));
  const warns=[];
  const lease=activeLeaseForRoom(room.id);
  const startedBeforePrev=lease&&(lease.moveInAt||lease.startDate||'').slice(0,7)<prevMonthOf(month);
  if(!prev&&startedBeforePrev)warns.push({level:'warn',text:'Thiếu kỳ trước'});
  if(!rec||(rec.electricEnd===undefined||rec.electricEnd===null||rec.electricEnd==='')){warns.push({level:'muted',text:'Chưa nhập'});return warns}
  if(Number(rec.electricEnd)<Number(rec.electricStart))warns.push({level:'bad',text:'Số điện âm'});
  if(rec.waterMode==='meter'&&Number(rec.waterEnd)<Number(rec.waterStart))warns.push({level:'bad',text:'Số nước âm'});
  if(prev){
    const prevUse=Number(prev.electricUnits||0),use=Math.max(0,Number(rec.electricEnd)-Number(rec.electricStart));
    if(prevUse>0&&use>prevUse*2.5)warns.push({level:'warn',text:'Điện tăng bất thường ×'+(use/prevUse).toFixed(1)});
  }
  return warns;
}
let meterBoard={propertyId:'',month:monthNow()};
function meterBoardRooms(){
  return visibleRooms().filter(r=>r.propertyId===meterBoard.propertyId&&activeLeaseForRoom(r.id)&&scopedProperties().some(p=>p.id===r.propertyId));
}
window.setMeterBoard=function(field,value){meterBoard[field]=value;renderUtilities()}
/** Nhập cuối kỳ ngay trên bảng — mỗi ô lưu nháp tức thì, KHÔNG mở modal từng phòng. */
window.meterInput=function(roomId,field,value){
  const room=getRoom(roomId);if(!room)return;
  const month=meterBoard.month;
  let rec=findReading(roomId,month);
  if(rec&&rec.status==='final'){showToast('Kỳ này đã chốt. Bấm "Mở khóa" của phòng để sửa (cần lý do).');renderUtilities();return}
  if(!rec){
    const prev=findReading(roomId,prevMonthOf(month));
    rec={id:uid('u'),roomId,month,
      electricStart:Number(prev?.electricEnd??0),electricEnd:'',electricRate:room.electricRate,
      waterMode:room.waterMode,waterStart:room.waterMode==='meter'?Number(prev?.waterEnd??0):0,waterEnd:'',
      waterRate:room.waterRate,waterFixed:room.waterFixed,otherFee:0,note:'',imageIds:[],
      status:'draft',lockedAt:'',unlockNote:'',createdAt:new Date().toISOString()};
    data.utilityReadings.push(rec);
  }
  rec[field]=value===''?'':Number(value);
  computeReadingAmounts(room,rec);
  rec.status='draft';
  saveData();
  patchMeterRow(roomId);
}
function meterRowHtml(room,month){
  const rec=findReading(room.id,month),prev=findReading(room.id,prevMonthOf(month));
  const t=activeTenantForRoom(room.id);
  const warns=meterWarnings(room,month);
  const locked=rec?.status==='final';
  const eStart=rec?rec.electricStart:Number(prev?.electricEnd??0);
  const photoCount=(rec?.imageIds||[]).length;
  return `<div class="meter-row ${locked?'meter-locked':''}" data-meter-room="${room.id}">
    <div class="meter-room-head">
      <div><strong>${esc(room.name)}</strong> <span style="color:var(--muted)">· ${esc(t?.name||'')}</span></div>
      <div class="meter-warns">${warns.map(w=>`<span class="meter-warn ${w.level}">${esc(w.text)}</span>`).join('')}
        ${locked?`<span class="meter-warn ok">Đã chốt</span>`:rec?`<span class="meter-warn muted">Nháp</span>`:''}</div>
    </div>
    <div class="meter-grid">
      <label>Điện đầu kỳ<input type="number" inputmode="numeric" value="${eStart}" ${locked?'disabled':''} data-evt="change" data-call="meterInput" data-a1="${room.id}" data-a2="electricStart" data-a3="V"></label>
      <label>Điện cuối kỳ<input type="number" inputmode="numeric" class="meter-main" value="${rec?.electricEnd??''}" placeholder="Nhập số cuối" ${locked?'disabled':''} data-evt="change" data-call="meterInput" data-a1="${room.id}" data-a2="electricEnd" data-a3="V"></label>
      ${room.waterMode==='meter'?`
      <label>Nước đầu kỳ<input type="number" inputmode="numeric" value="${rec?rec.waterStart:Number(prev?.waterEnd??0)}" ${locked?'disabled':''} data-evt="change" data-call="meterInput" data-a1="${room.id}" data-a2="waterStart" data-a3="V"></label>
      <label>Nước cuối kỳ<input type="number" inputmode="numeric" class="meter-main" value="${rec?.waterEnd??''}" placeholder="Số nước" ${locked?'disabled':''} data-evt="change" data-call="meterInput" data-a1="${room.id}" data-a2="waterEnd" data-a3="V"></label>`
      :`<div class="meter-fixed">Nước cố định: <strong>${money(room.waterFixed)}</strong></div>`}
    </div>
    <div class="meter-foot">
      <span class="meter-stat" data-meter-stat="${room.id}">${rec&&rec.electricEnd!==''?`${rec.electricUnits} kWh · ${money(rec.electricAmount)}${rec.waterMode==='meter'?` · ${rec.waterUnits} m³ · ${money(rec.waterAmount)}`:` · nước ${money(rec.waterAmount)}`}`:'Chưa có số liệu'}</span>
      <span class="table-actions">
        <button type="button" class="icon-btn" data-evt="click" data-call="attachMeterPhoto" data-a1="${room.id}">📷 Ảnh công tơ${photoCount?` (${photoCount})`:''}</button>
        ${photoCount?`<button type="button" class="icon-btn" data-evt="click" data-call="openMeterPhotos" data-a1="${rec.id}">Xem ảnh</button>`:''}
        ${locked?`<button type="button" class="icon-btn danger" data-evt="click" data-call="unlockReading" data-a1="${rec.id}">Mở khóa</button>`:''}
      </span>
    </div>
  </div>`;
}
function patchMeterRow(roomId){
  const rec=findReading(roomId,meterBoard.month);
  const el=document.querySelector(`[data-meter-stat="${roomId}"]`);
  if(el&&rec)el.textContent=rec.electricEnd!==''?`${rec.electricUnits} kWh · ${money(rec.electricAmount)}${rec.waterMode==='meter'?` · ${rec.waterUnits} m³ · ${money(rec.waterAmount)}`:` · nước ${money(rec.waterAmount)}`}`:'Chưa có số liệu';
  const row=document.querySelector(`[data-meter-room="${roomId}"] .meter-warns`);
  if(row){const room=getRoom(roomId);const warns=meterWarnings(room,meterBoard.month);
    row.innerHTML=warns.map(w=>`<span class="meter-warn ${w.level}">${esc(w.text)}</span>`).join('')+(rec?`<span class="meter-warn muted">Nháp</span>`:'');}
}
window.attachMeterPhoto=function(roomId){
  const month=meterBoard.month;
  const input=document.createElement('input');
  input.type='file';input.accept='image/*';input.capture='environment';
  input.onchange=async()=>{
    const file=input.files&&input.files[0];if(!file)return;
    showToast('Đang lưu ảnh công tơ…');
    const id=await saveImageFile(file,'private'); // ảnh công tơ là ảnh nghiệp vụ — kho PRIVATE
    let rec=findReading(roomId,month);
    if(!rec){window.meterInput(roomId,'electricStart',Number(findReading(roomId,prevMonthOf(month))?.electricEnd??0));rec=findReading(roomId,month)}
    rec.imageIds=rec.imageIds||[];rec.imageIds.push(id);
    saveData();renderUtilities();showToast('Đã lưu ảnh công tơ vào kỳ '+month);
  };
  input.click();
}
window.openResidentMeterPhotos=function(readingId){
  const list=residentSession?(residentSession.readings||[]):data.utilityReadings;
  const rec=list.find(u=>u.id===readingId);if(!rec)return;
  document.getElementById('meterPhotoTitle').textContent='Ảnh công tơ tháng '+rec.month;
  document.getElementById('meterPhotoBody').innerHTML=(rec.imageIds||[]).map(id=>`<img class="meter-photo image-loading" data-image-id="${esc(id)}">`).join('')||'<div class="empty">Chưa có ảnh.</div>';
  openModal('meterPhotoModal');
  hydrateImages(document.getElementById('meterPhotoBody'));
}
window.openMeterPhotos=function(readingId){
  const rec=getReading(readingId);if(!rec)return;
  const r=getRoom(rec.roomId);
  document.getElementById('meterPhotoTitle').textContent=`Ảnh công tơ ${r?.name||''} — ${rec.month}`;
  document.getElementById('meterPhotoBody').innerHTML=(rec.imageIds||[]).map(id=>`<img class="meter-photo image-loading" data-image-id="${esc(id)}">`).join('')||'<div class="empty">Chưa có ảnh.</div>';
  openModal('meterPhotoModal');
  hydrateImages(document.getElementById('meterPhotoBody'));
}
/** Chốt kỳ: mọi bản ghi nháp có số liệu của căn+tháng → khóa. */
window.finalizeMeterMonth=function(){
  const rooms=meterBoardRooms();
  const done=[],missing=[];
  rooms.forEach(r=>{
    const rec=findReading(r.id,meterBoard.month);
    if(rec&&rec.electricEnd!==''&&rec.electricEnd!==null&&rec.electricEnd!==undefined)done.push({r,rec});
    else missing.push(r);
  });
  if(!done.length){showToast('Chưa có phòng nào nhập số liệu.');return}
  const bad=done.filter(({r})=>meterWarnings(r,meterBoard.month).some(w=>w.level==='bad'));
  if(bad.length){showToast('Còn phòng có SỐ ÂM: '+bad.map(x=>x.r.name).join(', ')+'. Sửa trước khi chốt.');return}
  if(!confirm(`Chốt kỳ ${meterBoard.month}: khóa ${done.length} phòng${missing.length?`, BỎ QUA ${missing.length} phòng chưa nhập (${missing.map(r=>r.name).join(', ')})`:''}?`))return;
  const now=new Date().toISOString();
  done.forEach(({rec})=>{rec.status='final';rec.lockedAt=now;auditLocal('update','utilityReadings',rec.id,{status:'draft'},{status:'final'})});
  saveData();renderUtilities();
  showToast(`Đã chốt ${done.length} phòng kỳ ${meterBoard.month}.`);
}
/** Kỳ đã chốt muốn sửa phải mở khóa và ghi lý do. */
window.unlockReading=async function(readingId){
  const rec=getReading(readingId);if(!rec||rec.status!=='final')return;
  if(!can('approve','invoices')){denyToast();return}
  const reason=prompt('Lý do mở khóa kỳ đã chốt (bắt buộc):','');
  if(!reason||!reason.trim()){showToast('Cần ghi lý do để mở khóa.');return}
  if(Sync.isOn()){
    // v4.1: online thì mở khóa qua ACTION máy chủ — sync thường không sửa được kỳ đã chốt
    try{
      await Sync.request({action:'unlockReading',token:Sync.cfg.token,readingId,reason:reason.trim()});
      rec.status='draft';rec.unlockNote=(rec.unlockNote?rec.unlockNote+' | ':'')+today()+': '+reason.trim();rec.lockedAt='';
      Sync.snapshot&&Sync.snapshot(); // bản mở khóa coi như đã đồng bộ, không đẩy đè
      saveData();renderUtilities();showToast('Đã mở khóa trên máy chủ — nhớ chốt lại sau khi sửa.');
    }catch(err){showToast('Không mở khóa được: '+(err.message||err));}
    return;
  }
  auditLocal('update','utilityReadings',rec.id,{status:'final'},{status:'draft',unlockNote:reason.trim()});
  rec.status='draft';
  rec.unlockNote=(rec.unlockNote?rec.unlockNote+' | ':'')+today()+': '+reason.trim();
  rec.lockedAt='';
  saveData();renderUtilities();showToast('Đã mở khóa — nhớ chốt lại sau khi sửa.');
}

/* ---------- Tạo hóa đơn hàng loạt ---------- */

function invoiceForLeaseMonth(leaseId,month){return data.invoices.find(i=>i.leaseId===leaseId&&i.month===month)}
function genInvoiceCode(month,room){
  const base='HD'+month.replace('-','')+'-'+String(room?.name||'P').replace(/[^A-Za-z0-9]/g,'');
  let code=base,n=1;
  while(data.invoices.some(i=>i.code===code))code=base+'-'+(++n);
  return code;
}
/** Dựng preview toàn căn/tháng: phòng đủ dữ liệu + phòng bị bỏ qua kèm lý do. */
function buildBulkPreview(propertyId,month){
  const rows=[],skipped=[];
  data.leases.filter(l=>liveLease(l)&&(getRoom(l.roomId)?.propertyId)===propertyId).forEach(l=>{
    const room=getRoom(l.roomId),t=getTenant(l.primaryTenantId);
    if(invoiceForLeaseMonth(l.id,month)){skipped.push({room,reason:'Đã có hóa đơn tháng này (không tạo trùng)'});return}
    const rec=findReading(l.roomId,month);
    if(!rec){skipped.push({room,reason:'Chưa nhập điện nước tháng này'});return}
    if(rec.status!=='final'){skipped.push({room,reason:'Chỉ số còn nháp — chưa chốt kỳ'});return}
    if(meterWarnings(room,month).some(w=>w.level==='bad')){skipped.push({room,reason:'Chỉ số âm — cần kiểm tra lại'});return}
    const services=serviceLinesFor(l,month);
    const svcTotal=services.reduce((s2,x)=>s2+x.amount,0);
    rows.push({lease:l,room,tenant:t,reading:rec,services,
      rent:Number(l.rentAmount||0),electric:Number(rec.electricAmount||0),water:Number(rec.waterAmount||0),
      other:Number(rec.otherFee||0),svcTotal,adjust:0,adjustNote:'',
      total:Number(l.rentAmount||0)+Number(rec.electricAmount||0)+Number(rec.waterAmount||0)+Number(rec.otherFee||0)+svcTotal});
  });
  return {rows,skipped};
}
let bulkState=null;
window.openBulkInvoice=function(){
  if(!can('approve','invoices')){denyToast();return}
  const props=scopedProperties();
  if(!props.length){showToast('Chưa có căn trọ.');return}
  document.getElementById('bulkProperty').innerHTML=props.map(p=>`<option value="${p.id}" ${p.id===meterBoard.propertyId?'selected':''}>${esc(p.name)}</option>`).join('');
  document.getElementById('bulkMonth').value=meterBoard.month;
  renderBulkPreview();
  openModal('bulkInvoiceModal');
}
window.renderBulkPreview=function(){
  const propertyId=document.getElementById('bulkProperty').value;
  const month=document.getElementById('bulkMonth').value;
  bulkState=buildBulkPreview(propertyId,month);
  bulkState.propertyId=propertyId;bulkState.month=month;
  const body=document.getElementById('bulkPreviewBody');
  body.innerHTML=`
    ${bulkState.rows.length?bulkState.rows.map((row,idx)=>`
      <div class="bulk-row">
        <div class="bulk-row-head"><strong>${esc(row.room.name)}</strong> · ${esc(row.tenant?.name||'')}
          <strong class="bulk-total" data-bulk-total="${idx}">${money(row.total+row.adjust)}</strong></div>
        <div class="bulk-lines">Phòng ${money(row.rent)} · Điện ${money(row.electric)} · Nước ${money(row.water)}${row.other?` · Khác ${money(row.other)}`:''}${row.services.map(sv=>` · ${esc(sv.name)} ${money(sv.amount)}`).join('')}</div>
        <div class="bulk-adjust">
          <label>Điều chỉnh ±<input type="number" value="0" data-evt="change" data-call="bulkAdjust" data-a1="${idx}" data-a2="adjust" data-a3="V"></label>
          <label>Lý do<input placeholder="Giảm trừ / phụ thu…" data-evt="change" data-call="bulkAdjust" data-a1="${idx}" data-a2="adjustNote" data-a3="V"></label>
        </div>
      </div>`).join(''):'<div class="empty">Không có phòng nào đủ điều kiện lập hóa đơn.</div>'}
    ${bulkState.skipped.length?`<div class="bulk-skips"><h4>Bỏ qua ${bulkState.skipped.length} phòng</h4>${bulkState.skipped.map(x=>`<div class="bulk-skip">⚠️ <strong>${esc(x.room?.name||'?')}</strong> — ${esc(x.reason)}</div>`).join('')}</div>`:''}`;
  document.getElementById('bulkIssueBtn').disabled=!bulkState.rows.length;
  document.getElementById('bulkIssueBtn').textContent=`Phát hành ${bulkState.rows.length} hóa đơn`;
}
window.bulkAdjust=function(idx,field,value){
  const row=bulkState?.rows[idx];if(!row)return;
  if(field==='adjust'){row.adjust=Number(value||0);const el=document.querySelector(`[data-bulk-total="${idx}"]`);if(el)el.textContent=money(row.total+row.adjust)}
  else row.adjustNote=String(value||'');
}
window.issueBulkInvoices=function(){
  if(!bulkState||!bulkState.rows.length)return;
  const month=bulkState.month;
  let created=0;
  bulkState.rows.forEach(row=>{
    if(invoiceForLeaseMonth(row.lease.id,month))return; // chống trùng lần cuối
    const total=row.total+row.adjust;
    const inv={id:uid('i'),tenantId:row.lease.primaryTenantId,roomId:row.room.id,leaseId:row.lease.id,
      readingId:row.reading.id,month,dueDate:dueDateForMonth(month,row.lease.billingDay),
      rent:row.rent,electric:row.electric,water:row.water,other:row.other,
      depositAmount:0,total,amountPaid:0,status:'unpaid',depositApplied:false,
      createdAt:new Date().toISOString(),payments:[],code:genInvoiceCode(month,row.room),
      serviceLines:row.services,adjustAmount:row.adjust,adjustNote:row.adjustNote,issuedAt:new Date().toISOString()};
    data.invoices.push(inv);created++;
    notifyTenant(inv.tenantId,'invoice_new','Hóa đơn tháng '+month,'Hóa đơn '+(inv.code||'')+' đã phát hành: '+money(total)+', hạn '+inv.dueDate+'.',inv.id);
  });
  saveData();closeModal('bulkInvoiceModal');renderAdmin();
  showToast(created?`Đã phát hành ${created} hóa đơn tháng ${month}. Các phòng thiếu dữ liệu đã được bỏ qua.`:'Không tạo thêm hóa đơn nào (tránh trùng).');
}
function dueDateForMonth(month,day){
  const [y,m]=month.split('-').map(Number);
  const dd=Math.min(28,Math.max(1,Number(day||5)));
  let yy=y,mm=m;
  const cand=`${yy}-${String(mm).padStart(2,'0')}-${String(dd).padStart(2,'0')}`;
  if(cand<today()){mm+=1;if(mm>12){mm=1;yy+=1}}
  return `${yy}-${String(mm).padStart(2,'0')}-${String(dd).padStart(2,'0')}`;
}

/* ---------- Dịch vụ: định nghĩa + gắn vào hợp đồng ---------- */

window.openServiceForm=function(id=null){
  const sv=id?getService(id):null;
  document.getElementById('serviceId').value=sv?.id||'';
  document.getElementById('serviceName').value=sv?.name||'';
  document.getElementById('serviceCalcType').value=sv?.calcType||'fixed';
  document.getElementById('serviceUnit').value=sv?.unit||'';
  document.getElementById('servicePrice').value=sv?.price??'';
  document.getElementById('serviceTax').value=sv?.taxPercent??0;
  document.getElementById('serviceFrom').value=sv?'':monthNow();
  document.getElementById('serviceFromRow').classList.toggle('hidden',!sv);
  document.getElementById('serviceNote').value=sv?.note||'';
  openModal('serviceModal');
}
document.getElementById('serviceForm').addEventListener('submit',e=>{
  e.preventDefault();
  const id=document.getElementById('serviceId').value;
  const price=Number(document.getElementById('servicePrice').value||0);
  const values={name:document.getElementById('serviceName').value.trim(),
    calcType:document.getElementById('serviceCalcType').value,
    unit:document.getElementById('serviceUnit').value.trim(),
    taxPercent:Number(document.getElementById('serviceTax').value||0),
    note:document.getElementById('serviceNote').value.trim()};
  if(!values.name){showToast('Nhập tên dịch vụ');return}
  if(id){
    const sv=getService(id);
    const from=document.getElementById('serviceFrom').value||monthNow();
    if(price!==Number(sv.price)){
      // Đổi giá có tháng hiệu lực — hóa đơn các tháng trước giữ giá cũ
      sv.priceHistory=sv.priceHistory||[];
      if(!sv.priceHistory.length)sv.priceHistory.push({from:'1970-01',price:Number(sv.price)});
      sv.priceHistory.push({from,price});
      if(from<=monthNow())sv.price=price;
    }
    Object.assign(sv,values);
  }else{
    data.serviceDefinitions.push({id:uid('sv'),...values,price,
      effectiveFrom:monthNow(),priceHistory:[{from:'1970-01',price}],archived:false,createdAt:new Date().toISOString()});
  }
  saveData();closeModal('serviceModal');renderUtilities();renderAdmin();
  showToast('Đã lưu dịch vụ');
});
window.archiveService=function(id){
  const sv=getService(id);if(!sv)return;
  if(!confirm('Ngừng dịch vụ này? Hóa đơn cũ giữ nguyên, hóa đơn mới sẽ không tính nữa.'))return;
  sv.archived=true;saveData();renderUtilities();showToast('Đã ngừng dịch vụ');
}
window.openLeaseServiceForm=function(leaseId){
  const l=getLease(leaseId);if(!l)return;
  const svcs=data.serviceDefinitions.filter(x=>!x.archived);
  if(!svcs.length){showToast('Chưa có dịch vụ nào. Khai báo ở mục Điện nước & dịch vụ trước.');return}
  document.getElementById('lsLeaseId').value=leaseId;
  document.getElementById('lsService').innerHTML=svcs.map(x=>`<option value="${x.id}">${esc(x.name)} — ${calcTypeLabel(x.calcType)} · ${money(x.price)}${x.unit?'/'+esc(x.unit):''}</option>`).join('');
  document.getElementById('lsQty').value=1;
  document.getElementById('lsOverride').value='';
  document.getElementById('lsDiscount').value=0;
  document.getElementById('lsFrom').value=monthNow()+'-01';
  openModal('leaseServiceModal');
}
document.getElementById('leaseServiceForm').addEventListener('submit',e=>{
  e.preventDefault();
  const leaseId=document.getElementById('lsLeaseId').value;
  data.leaseServices.push({id:uid('ls'),leaseId,serviceId:document.getElementById('lsService').value,
    quantity:Math.max(1,Number(document.getElementById('lsQty').value||1)),
    priceOverride:Number(document.getElementById('lsOverride').value||0),
    discountPercent:Math.min(100,Math.max(0,Number(document.getElementById('lsDiscount').value||0))),
    discountAmount:0,effectiveFrom:document.getElementById('lsFrom').value||today(),endedAt:'',
    note:'',createdAt:new Date().toISOString()});
  saveData();closeModal('leaseServiceModal');openLeaseDetail(leaseId);
  showToast('Đã gắn dịch vụ vào hợp đồng');
});
window.endLeaseService=function(lsId){
  const ls=data.leaseServices.find(x=>x.id===lsId);if(!ls)return;
  if(!confirm('Ngừng dịch vụ này cho hợp đồng từ tháng sau?'))return;
  ls.endedAt=today();
  saveData();openLeaseDetail(ls.leaseId);
}

/* ---------- Sổ cọc ---------- */

window.openDepositForm=function(leaseId,type){
  const l=getLease(leaseId);if(!l)return;
  const t=depositTotals(leaseId);
  document.getElementById('depLeaseId').value=leaseId;
  document.getElementById('depType').value=type||'collect';
  document.getElementById('depAmount').value=type==='refund'?t.held:'';
  document.getElementById('depDate').value=today();
  document.getElementById('depMethod').value='cash';
  document.getElementById('depNote').value='';
  document.getElementById('depSummary').innerHTML=`Đã thu ${money(t.collect)} · Đã trừ ${money(t.deduct)} · Đã hoàn ${money(t.refund)} · <strong>Đang giữ ${money(t.held)}</strong>`;
  openModal('depositModal');
}
document.getElementById('depositForm').addEventListener('submit',e=>{
  e.preventDefault();
  const leaseId=document.getElementById('depLeaseId').value;
  const type=document.getElementById('depType').value;
  const amount=Number(document.getElementById('depAmount').value||0);
  if(amount<=0){showToast('Số tiền phải lớn hơn 0');return}
  const t=depositTotals(leaseId);
  if((type==='refund'||type==='deduct')&&amount>t.held){showToast('Vượt quá số cọc đang giữ ('+money(t.held)+')');return}
  addDepositEntry(leaseId,type,amount,document.getElementById('depMethod').value,document.getElementById('depNote').value.trim(),document.getElementById('depDate').value);
  saveData();closeModal('depositModal');renderAdmin();openLeaseDetail(leaseId);
  showToast(({collect:'Đã ghi thu cọc',refund:'Đã ghi hoàn cọc',deduct:'Đã ghi trừ cọc'})[type]);
});

/* ---------- Lịch sử thu & giao dịch đảo ---------- */

window.openPayHistory=function(invoiceId){
  const inv=getInvoice(invoiceId);if(!inv)return;
  const t=getTenant(inv.tenantId),r=getRoom(inv.roomId);
  const txs=ledgerOf(invoiceId).sort((a,b)=>String(a.createdAt).localeCompare(b.createdAt));
  document.getElementById('payHistoryTitle').textContent=`Sổ thu — HĐ ${inv.code||inv.month} · ${r?.name||''}`;
  document.getElementById('payHistoryBody').innerHTML=`
    <p class="muted-text">Tổng ${money(inv.total)} · Đã thu ${money(inv.amountPaid)} · Còn lại <strong>${money(remainingInvoice(inv))}</strong>. Giao dịch đã ghi không sửa/xóa được — sai thì tạo giao dịch đảo.</p>
    ${txs.length?txs.map(p=>`
      <div class="pay-tx ${p.kind==='reversal'?'pay-rev':''} ${p.reversedAt?'pay-reversed':''}">
        <div><strong>${p.kind==='reversal'?'↩ Đảo':'💳 Thu'} ${money(Math.abs(p.amount))}</strong> · ${esc(p.paidAt)} · ${({cash:'Tiền mặt',bank:'Chuyển khoản',other:'Khác'})[p.method]||esc(p.method)}
          ${p.reference?` · CT: ${esc(p.reference)}`:''}
          ${p.reversedAt?` <span class="badge badge-unpaid">Đã đảo${p.reversalReason?': '+esc(p.reversalReason):''}</span>`:''}
          ${p.note?`<br><span style="color:var(--muted)">${esc(p.note)}</span>`:''}</div>
        <div class="table-actions">
          ${p.kind==='payment'&&!p.reversedAt?`<button class="icon-btn danger" data-evt="click" data-call="doReverse" data-a1="${p.id}">Đảo giao dịch</button>`:''}
          ${p.kind==='payment'?`<button class="icon-btn" data-evt="click" data-call="openReceiptPdf" data-a1="${p.id}">Phiếu thu</button>`:''}
        </div>
      </div>`).join(''):'<div class="empty">Chưa có giao dịch thu nào.</div>'}`;
  openModal('payHistoryModal');
}
window.doReverse=function(txId){
  const reason=prompt('Lý do đảo giao dịch (bắt buộc):','');
  if(!reason||!reason.trim()){showToast('Cần ghi lý do đảo giao dịch.');return}
  const rev=reversePayment(txId,reason.trim());
  if(!rev)return;
  saveData();renderAdmin();
  openPayHistory(rev.invoiceId);
  showToast('Đã tạo giao dịch đảo — công nợ được tính lại.');
}

/* ---------- PDF hóa đơn / phiếu thu + VietQR ---------- */

function vietQrUrl(amount,addInfo){
  const st=data.settings||{};
  if(!st.bankCode||!st.bankAccount||amount<=0)return '';
  return 'https://img.vietqr.io/image/'+encodeURIComponent(st.bankCode)+'-'+encodeURIComponent(st.bankAccount)+
    '-compact2.png?amount='+Math.round(amount)+'&addInfo='+encodeURIComponent(addInfo)+
    (st.bankAccountName?'&accountName='+encodeURIComponent(st.bankAccountName):'');
}
function docShell(title,body){
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>${esc(title)}</title><style>
    body{font:14px/1.55 "Segoe UI",Arial,sans-serif;color:#2C2723;max-width:720px;margin:24px auto;padding:0 16px}
    .doc-head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #4D3B30;padding-bottom:12px;margin-bottom:16px}
    .brand{font-size:22px;font-weight:800;color:#4D3B30}
    table{width:100%;border-collapse:collapse;margin:10px 0}
    th,td{border:1px solid #DED4C8;padding:8px 10px;text-align:left}
    th{background:#EEE6DC;color:#4D3B30}
    .tr td{text-align:right}
    .total-row td{font-weight:800;background:#F5ECDD}
    .qr{display:flex;gap:16px;align-items:center;margin-top:18px;border:1px dashed #CBBBAA;border-radius:10px;padding:12px}
    .qr img{width:180px;height:auto}
    .muted{color:#675F58;font-size:12.5px}
    @media print{.no-print{display:none}}
  </style></head><body>${body}
  <p class="no-print" style="text-align:center;margin-top:20px"><button onclick="window.print()" style="padding:10px 22px;font-size:15px">🖨 In / Lưu PDF</button></p>
  </body></html>`;
}
/** Dựng nội dung PDF hóa đơn từ bộ dữ liệu bất kỳ (quản trị hoặc phiên cư dân). */
function buildInvoiceDocHtml(inv,ctx){
  const t=ctx.tenant,r=ctx.room,p=ctx.property,st=data.settings||{};
  const brand=st.brandName||'Huy Rooms';
  const remaining=Math.max(0,Number(inv.total||0)-Number(inv.amountPaid||0));
  const code=inv.code||('HD-'+String(inv.month||'').replace('-','')+'-'+(r?.name||''));
  const qr=vietQrUrl(remaining,code);
  const svcRows=(inv.serviceLines||[]).map(sv=>`<tr><td>${esc(sv.name)}${sv.quantity>1?` × ${sv.quantity}${sv.unit?' '+esc(sv.unit):''}`:''}${sv.taxPercent?` (thuế ${sv.taxPercent}%)`:''}</td><td class="tr">${money(sv.amount)}</td></tr>`).join('');
  const body=`
    <div class="doc-head">
      <div><div class="brand">${esc(brand)}</div><div class="muted">${esc(st.managerName||'')}${st.managerPhone?' · '+esc(st.managerPhone):''}</div></div>
      <div style="text-align:right"><h2 style="margin:0">HÓA ĐƠN TIỀN PHÒNG</h2><div>Mã: <strong>${esc(code)}</strong></div><div class="muted">Tháng ${esc(inv.month)} · Hạn: ${esc(inv.dueDate||'-')}</div></div>
    </div>
    <p><strong>Khách thuê:</strong> ${esc(t?.name||'')}${t?.phone?' · '+esc(t.phone):''}<br>
       <strong>Phòng:</strong> ${esc(r?.name||'')} — ${esc(p?.name||'')}${p?.address?', '+esc(p.address):''}</p>
    <table>
      <tr><th>Khoản mục</th><th style="width:160px;text-align:right">Thành tiền</th></tr>
      <tr><td>Tiền phòng</td><td class="tr">${money(inv.rent)}</td></tr>
      <tr><td>Tiền điện</td><td class="tr">${money(inv.electric)}</td></tr>
      <tr><td>Tiền nước</td><td class="tr">${money(inv.water)}</td></tr>
      ${Number(inv.other)?`<tr><td>Phí khác</td><td class="tr">${money(inv.other)}</td></tr>`:''}
      ${svcRows}
      ${Number(inv.adjustAmount)?`<tr><td>Điều chỉnh${inv.adjustNote?` — ${esc(inv.adjustNote)}`:''}</td><td class="tr">${money(inv.adjustAmount)}</td></tr>`:''}
      ${Number(inv.depositAmount)?`<tr><td>Tiền cọc (không tính vào doanh thu tiền phòng)</td><td class="tr">${money(inv.depositAmount)}</td></tr>`:''}
      <tr class="total-row"><td>TỔNG CỘNG</td><td class="tr">${money(inv.total)}</td></tr>
      <tr><td>Đã thanh toán</td><td class="tr">${money(inv.amountPaid)}</td></tr>
      <tr class="total-row"><td>CÒN LẠI</td><td class="tr">${money(remaining)}</td></tr>
    </table>
    ${qr?`<div class="qr"><img src="${qr}" alt="VietQR"><div><strong>Quét VietQR để chuyển khoản đúng số tiền</strong><br>${esc(st.bankAccountName||'')} · ${esc(st.bankCode||'')} ${esc(st.bankAccount||'')}<br>Số tiền: <strong>${money(remaining)}</strong><br>Nội dung: <strong>${esc(code)}</strong></div></div>`
      :(remaining>0?`<p class="muted">— Khai báo tài khoản ngân hàng trong Cài đặt để hiện mã VietQR trên hóa đơn —</p>`:'')}
    <p class="muted">Xuất từ ${esc(brand)} ngày ${new Date().toLocaleDateString('vi-VN')}. Mọi thắc mắc vui lòng liên hệ ${esc(st.managerPhone||'quản lý')}.</p>`;
  return docShell('Hóa đơn '+code,body);
}
function openDocWindow(html){
  const w2=window.open('','_blank');
  if(!w2){showToast('Trình duyệt chặn cửa sổ mới. Hãy cho phép pop-up để xem PDF.');return}
  w2.document.open();w2.document.write(html);w2.document.close();
}
window.openInvoicePdf=function(invoiceId){
  let inv,ctx;
  if(residentSession){
    inv=(residentSession.invoices||[]).find(x=>x.id===invoiceId);
    ctx={tenant:residentSession.tenant,room:residentSession.room,property:residentSession.property};
  }else{
    inv=getInvoice(invoiceId);if(!inv)return;
    const r=getRoom(inv.roomId);
    ctx={tenant:getTenant(inv.tenantId),room:r,property:getProperty(r?.propertyId)};
  }
  if(!inv)return;
  openDocWindow(buildInvoiceDocHtml(inv,ctx));
}
function buildReceiptDocHtml(tx){
  const inv=getInvoice(tx.invoiceId)||{};
  const t=getTenant(inv.tenantId),r=getRoom(inv.roomId);
  const st=data.settings||{};
  const body=`
    <div class="doc-head">
      <div><div class="brand">${esc(st.brandName||'Huy Rooms')}</div><div class="muted">${esc(st.managerName||'')}${st.managerPhone?' · '+esc(st.managerPhone):''}</div></div>
      <div style="text-align:right"><h2 style="margin:0">PHIẾU THU</h2><div>Số: <strong>${esc(tx.id)}</strong></div><div class="muted">Ngày ${esc(tx.paidAt)}</div></div>
    </div>
    <p><strong>Người nộp:</strong> ${esc(t?.name||'')} · Phòng ${esc(r?.name||'')}</p>
    <table>
      <tr><td>Thu cho hóa đơn</td><td class="tr">${esc(inv.code||inv.month||'')}</td></tr>
      <tr class="total-row"><td>SỐ TIỀN</td><td class="tr">${money(tx.amount)}</td></tr>
      <tr><td>Hình thức</td><td class="tr">${({cash:'Tiền mặt',bank:'Chuyển khoản',other:'Khác'})[tx.method]||esc(tx.method)}</td></tr>
      ${tx.reference?`<tr><td>Số chứng từ</td><td class="tr">${esc(tx.reference)}</td></tr>`:''}
      ${tx.note?`<tr><td>Ghi chú</td><td class="tr">${esc(tx.note)}</td></tr>`:''}
    </table>
    <table style="border:0;margin-top:26px"><tr>
      <td style="border:0;text-align:center"><strong>Người nộp tiền</strong><br><span class="muted">(Ký, họ tên)</span></td>
      <td style="border:0;text-align:center"><strong>Người thu tiền</strong><br><span class="muted">(Ký, họ tên)</span></td>
    </tr></table>`;
  return docShell('Phiếu thu '+tx.id,body);
}
window.openReceiptPdf=function(txId){
  const tx=data.payments.find(p=>p.id===txId);if(!tx)return;
  openDocWindow(buildReceiptDocHtml(tx));
}

/* ---------- Mẫu tin nhắn nhắc nợ + lịch sử gửi ---------- */

function reminderKindOf(inv){const d=daysUntil(inv.dueDate);return d>0?'before':d===0?'due':'overdue'}
function reminderText(inv,kind){
  const t=getTenant(inv.tenantId)||{},r=getRoom(inv.roomId)||{},st=data.settings||{};
  const remaining=remainingInvoice(inv);
  const bank=st.bankAccount?`\nChuyển khoản: ${st.bankCode||''} ${st.bankAccount}${st.bankAccountName?' ('+st.bankAccountName+')':''} — nội dung: ${inv.code||('HD '+inv.month)}`:'';
  const head={
    before:`Xin chào ${t.name||'anh/chị'}, ${st.brandName||'Huy Rooms'} xin nhắc nhẹ: hóa đơn tháng ${inv.month} phòng ${r.name||''} sẽ đến hạn ngày ${inv.dueDate||''}.`,
    due:`Xin chào ${t.name||'anh/chị'}, hôm nay là hạn thanh toán hóa đơn tháng ${inv.month} phòng ${r.name||''}.`,
    overdue:`Xin chào ${t.name||'anh/chị'}, hóa đơn tháng ${inv.month} phòng ${r.name||''} đã QUÁ HẠN từ ngày ${inv.dueDate||''}. Mong anh/chị thu xếp sớm giúp.`
  }[kind];
  return `${head}\nSố tiền còn lại: ${money(remaining)}.${bank}\nCảm ơn anh/chị!`;
}
window.openReminder=function(invoiceId){
  const inv=getInvoice(invoiceId);if(!inv)return;
  document.getElementById('remInvoiceId').value=invoiceId;
  const kind=reminderKindOf(inv);
  document.getElementById('remKind').value=kind;
  document.getElementById('remText').value=reminderText(inv,kind);
  const hist=data.reminders.filter(x=>x.invoiceId===invoiceId).sort((a,b)=>String(b.sentAt).localeCompare(a.sentAt));
  document.getElementById('remHistory').innerHTML=hist.length?'<h4>Đã gửi</h4>'+hist.map(h=>`<div class="rem-log">📨 ${esc(h.sentAt.slice(0,16).replace('T',' '))} · ${({before:'Trước hạn',due:'Đến hạn',overdue:'Quá hạn'})[h.kind]||h.kind} · ${esc(h.channel)}</div>`).join(''):'';
  openModal('reminderModal');
}
window.remKindChanged=function(){
  const inv=getInvoice(document.getElementById('remInvoiceId').value);if(!inv)return;
  document.getElementById('remText').value=reminderText(inv,document.getElementById('remKind').value);
}
window.sendReminder=function(){
  const inv=getInvoice(document.getElementById('remInvoiceId').value);if(!inv)return;
  const kind=document.getElementById('remKind').value;
  const msg=document.getElementById('remText').value;
  copyText(msg,'Đã sao chép — dán vào Zalo/SMS của khách.');
  data.reminders.push({id:uid('rem'),invoiceId:inv.id,tenantId:inv.tenantId,kind,channel:'manual',
    message:msg,sentAt:new Date().toISOString(),sentBy:'admin',createdAt:new Date().toISOString()});
  saveData();openReminder(inv.id);
}

/* ---------- Báo cáo tháng + xuất CSV ---------- */

let reportState={month:monthNow(),propertyId:''};
window.setReport=function(field,value){reportState[field]=value;renderDashboard()}
/** Doanh thu KHÔNG gồm tiền cọc: phần cọc trên hóa đơn (nếu có) bị loại khỏi phải thu/đã thu. */
function revenueStats(month,propertyId){
  const invs=data.invoices.filter(i=>i.month===month&&(!propertyId||getRoom(i.roomId)?.propertyId===propertyId));
  let phaiThu=0,daThu=0;
  invs.forEach(i=>{
    const dep=Number(i.depositAmount||0);
    phaiThu+=Math.max(0,Number(i.total||0)-dep);
    daThu+=Math.min(Number(i.amountPaid||0),Math.max(0,Number(i.total||0)-dep)); // cọc coi như thu SAU CÙNG
  });
  const held=data.leases.reduce((s2,l)=>{
    if(propertyId&&(getRoom(l.roomId)?.propertyId)!==propertyId)return s2;
    const t=depositTotals(l.id);return s2+Math.max(0,t.held);
  },0);
  return {phaiThu,daThu,conNo:Math.max(0,phaiThu-daThu),cocDangGiu:held,count:invs.length};
}
function csvDownload(rows,filename){
  const csv='\ufeff'+rows.map(row=>row.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(',')).join('\n');
  downloadBlob(new Blob([csv],{type:'text/csv;charset=utf-8'}),filename);
}
window.exportInvoicesCSV=function(){
  const {month,propertyId}=reportState;
  const invs=data.invoices.filter(i=>i.month===month&&(!propertyId||getRoom(i.roomId)?.propertyId===propertyId));
  const rows=[['Ma HD','Thang','Can','Phong','Khach','Tien phong','Dien','Nuoc','Dich vu','Dieu chinh','Coc (khong tinh doanh thu)','Tong','Da thu','Con lai','Han','Trang thai']];
  invs.forEach(i=>{const r=getRoom(i.roomId),p=getProperty(r?.propertyId),t=getTenant(i.tenantId);
    rows.push([i.code||i.id,i.month,p?.name||'',r?.name||'',t?.name||'',i.rent,i.electric,i.water,
      (i.serviceLines||[]).reduce((s2,x)=>s2+x.amount,0),i.adjustAmount||0,i.depositAmount||0,i.total,i.amountPaid,remainingInvoice(i),i.dueDate||'',i.status]);
  });
  csvDownload(rows,`hoa-don-${month}${propertyId?'-'+propertyId:''}.csv`);
}
window.exportPaymentsCSV=function(){
  const {month,propertyId}=reportState;
  const invIds=new Set(data.invoices.filter(i=>i.month===month&&(!propertyId||getRoom(i.roomId)?.propertyId===propertyId)).map(i=>i.id));
  const rows=[['Ma GD','Loai','Hoa don','Phong','So tien','Ngay','Hinh thuc','Chung tu','Ghi chu','Da dao']];
  data.payments.filter(p=>invIds.has(p.invoiceId)).forEach(p=>{
    const inv=getInvoice(p.invoiceId),r=getRoom(inv?.roomId);
    rows.push([p.id,p.kind==='reversal'?'Dao':'Thu',inv?.code||p.invoiceId,r?.name||'',p.amount,p.paidAt,p.method,p.reference||'',p.note||'',p.reversedAt?'x':'']);
  });
  csvDownload(rows,`so-thu-${month}${propertyId?'-'+propertyId:''}.csv`);
}

/* ==================================================================
   HỢP ĐỒNG THUÊ (v4 giai đoạn 2)
   users/accounts — occupants — leases — rooms — deposits — payments
   ================================================================== */

function ensureAccountFor(occupant){
  if(!occupant)return null;
  let acc=accountForOccupant(occupant.id);
  const phone=String(occupant.phone||'').replace(/\D/g,'');
  if(!acc&&phone){
    acc={id:uid('acc'),phone,occupantId:occupant.id,active:true,pin:'',createdAt:new Date().toISOString(),note:''};
    data.accounts.push(acc);
  }
  return acc;
}

/** Tạo hợp đồng active + người ở đại diện + tài khoản cho người thuê tạo bằng form cũ (idempotent). */
function ensureLeaseForTenant(t){
  if(!t||!t.active||!t.roomId)return null;
  let lease=data.leases.find(l=>l.primaryTenantId===t.id&&l.status!=='cancelled');
  if(!lease){
    const room=getRoom(t.roomId)||{};
    lease={id:uid('l'),propertyId:room.propertyId||'',roomId:t.roomId,primaryTenantId:t.id,
      startDate:t.moveInDate||today(),endDate:'',billingDay:Number(data.settings.defaultDueDay||5),
      rentAmount:Number(room.price||0),depositRequired:Number(t.depositRequired||0),depositPaid:Number(t.depositPaid||0),
      status:'active',signedAt:t.moveInDate||today(),moveInAt:t.moveInDate||today(),moveOutAt:'',
      terminationReason:'',note:'',createdAt:new Date().toISOString(),
      depositDeduct:0,depositRefund:0,settlementNote:'',roomHistory:[],renewals:[]};
    data.leases.push(lease);
  }
  if(!data.leaseOccupants.some(x=>x.leaseId===lease.id&&x.occupantId===t.id)){
    data.leaseOccupants.push({id:uid('lo'),leaseId:lease.id,occupantId:t.id,role:'primary',
      joinedAt:lease.startDate,leftAt:'',note:'',createdAt:new Date().toISOString()});
  }
  ensureAccountFor(t);
  return lease;
}

/** Cảnh báo: hợp đồng sắp hết hạn (30/15/7 ngày) và phòng sắp trống. */
function leaseAlerts(){
  const expiring=[];
  data.leases.filter(liveLease).forEach(l=>{
    if(!l.endDate)return;
    const d=daysUntil(l.endDate);
    if(d===null||d<0||d>30)return;
    expiring.push({lease:l,days:d,level:d<=7?7:d<=15?15:30});
  });
  expiring.sort((a,b)=>a.days-b.days);
  const soonEmpty=expiring.map(x=>getRoom(x.lease.roomId)).filter(Boolean);
  return {expiring,soonEmpty};
}

function occupantOptionsHtml(selectedId,withNew=true){
  const used=new Set(data.leases.filter(liveLease).flatMap(l=>leaseOccupantsOf(l.id).map(x=>x.occupantId)));
  const opts=data.tenants
    .filter(t=>t.id===selectedId||!used.has(t.id))
    .map(t=>`<option value="${t.id}" ${t.id===selectedId?'selected':''}>${esc(t.name)} · ${esc(t.phone)}</option>`).join('');
  return (withNew?`<option value="__new">— Tạo người mới —</option>`:'')+opts;
}

/** Lấy hoặc tạo hồ sơ người ở từ ô chọn (select + name/phone khi chọn "người mới"). */
function occupantFromPicker(selectId,nameId,phoneId){
  const sel=document.getElementById(selectId).value;
  if(sel!=='__new'){const t=getTenant(sel);if(!t)showToast('Hãy chọn người ở');return t||null}
  const name=document.getElementById(nameId).value.trim();
  const phone=normalizePhone(document.getElementById(phoneId).value);
  if(name.length<2){showToast('Họ tên người ở cần ít nhất 2 ký tự');return null}
  if(!/^0\d{9}$/.test(phone)){showToast('Số điện thoại người ở chưa đúng (10 số)');return null}
  const t={id:uid('t'),name,phone,pin:'',roomId:'',moveInDate:'',active:true,moveOutDate:'',
    depositRequired:0,depositPaid:0,note:''};
  data.tenants.push(t);
  return t;
}

/* ---------- Form hợp đồng (nháp / sửa) ---------- */

window.openLeaseForm=function(id=null,roomId=null){
  if(!data.rooms.length){showToast('Chưa có phòng.');return}
  const l=id?getLease(id):null;
  document.getElementById('leaseId').value=l?.id||'';
  const firstRoom=visibleRooms().find(r=>r.status==='available')||visibleRooms()[0]||data.rooms[0];
  document.getElementById('leaseRoom').innerHTML=roomOptionHtml(l?.roomId||roomId||firstRoom.id);
  document.getElementById('leaseRoom').disabled=!!(l&&liveLease(l)); // đổi phòng của HĐ đang chạy → dùng "Chuyển phòng"
  document.getElementById('leaseOccupant').innerHTML=occupantOptionsHtml(l?.primaryTenantId||'');
  document.getElementById('leaseOccupant').disabled=!!l; // đổi đại diện → dùng nút trong chi tiết
  toggleLeaseNewOccupant();
  document.getElementById('leaseStart').value=l?.startDate||today();
  document.getElementById('leaseEnd').value=l?.endDate||'';
  document.getElementById('leaseBillingDay').value=l?.billingDay??Number(data.settings.defaultDueDay||5);
  const room=getRoom(l?.roomId||roomId||firstRoom.id);
  document.getElementById('leaseRent').value=l?l.rentAmount:Number(room?.price||0);
  document.getElementById('leaseDepositRequired').value=l?l.depositRequired:Number(room?.deposit||0);
  document.getElementById('leaseDepositPaid').value=l?.depositPaid??0;
  document.getElementById('leaseNote').value=l?.note||'';
  document.getElementById('leaseSnapshotNote').innerHTML=
    '📌 Giá thuê và tiền cọc được <strong>chốt trên hợp đồng</strong>: sau này đổi giá niêm yết của phòng sẽ KHÔNG làm thay đổi hợp đồng này.';
  openModal('leaseModal');
}
window.toggleLeaseNewOccupant=function(){
  const isNew=document.getElementById('leaseOccupant').value==='__new';
  document.getElementById('leaseNewOccupantRow').classList.toggle('hidden',!isNew);
}
document.getElementById('leaseRoom').addEventListener('change',()=>{
  if(document.getElementById('leaseId').value)return;
  const room=getRoom(document.getElementById('leaseRoom').value);
  document.getElementById('leaseRent').value=Number(room?.price||0);
  document.getElementById('leaseDepositRequired').value=Number(room?.deposit||0);
});
document.getElementById('leaseForm').addEventListener('submit',e=>{
  e.preventDefault();
  const id=document.getElementById('leaseId').value;
  const roomId=document.getElementById('leaseRoom').value;
  const room=getRoom(roomId);if(!room){showToast('Phòng không hợp lệ');return}
  const start=document.getElementById('leaseStart').value,end=document.getElementById('leaseEnd').value;
  if(end&&end<start){showToast('Ngày kết thúc phải sau ngày bắt đầu');return}
  const l=id?getLease(id):null;
  if(!l){
    const existing=activeLeaseForRoom(roomId)||draftLeaseForRoom(roomId);
    if(existing){showToast('Phòng này đã có hợp đồng '+leaseStatusLabel(existing.status).toLowerCase()+'. Hãy xử lý hợp đồng đó trước.');return}
  }
  let occupant;
  if(l)occupant=getTenant(l.primaryTenantId);
  else{occupant=occupantFromPicker('leaseOccupant','leaseNewName','leaseNewPhone');if(!occupant)return}
  const values={roomId,propertyId:room.propertyId,primaryTenantId:occupant.id,
    startDate:start,endDate:end,billingDay:Math.min(28,Math.max(1,Number(document.getElementById('leaseBillingDay').value||5))),
    rentAmount:Number(document.getElementById('leaseRent').value||0),
    depositRequired:Number(document.getElementById('leaseDepositRequired').value||0),
    depositPaid:Number(document.getElementById('leaseDepositPaid').value||0),
    note:document.getElementById('leaseNote').value.trim()};
  let lease;
  if(l){
    const before=Number(l.depositPaid||0);
    Object.assign(l,values);lease=l;
    const diff=Number(l.depositPaid||0)-before;
    if(diff>0)addDepositEntry(l.id,'collect',diff,'cash','Thu thêm cọc (sửa hợp đồng)');
  }
  else{
    lease={id:uid('l'),...values,status:'draft',signedAt:'',moveInAt:'',moveOutAt:'',terminationReason:'',
      createdAt:new Date().toISOString(),depositDeduct:0,depositRefund:0,settlementNote:'',roomHistory:[],renewals:[]};
    data.leases.push(lease);
    data.leaseOccupants.push({id:uid('lo'),leaseId:lease.id,occupantId:occupant.id,role:'primary',
      joinedAt:'',leftAt:'',note:'',createdAt:new Date().toISOString()});
    if(Number(lease.depositPaid)>0)addDepositEntry(lease.id,'collect',Number(lease.depositPaid),'cash','Đặt cọc giữ chỗ');
  }
  reconcileRoomStatus(roomId);
  if(!id)completeLeadConversion(lease);  // lead → converted, không nhập lại thông tin
  saveData();closeModal('leaseModal');renderAdmin();renderPublic();
  showToast(id?'Đã cập nhật hợp đồng':'Đã tạo hợp đồng nháp'+(Number(lease.depositPaid)>0?' — phòng chuyển sang Giữ chỗ':''));
});

window.signLease=function(id){
  const l=getLease(id);if(!l)return;
  l.signedAt=today();if(l.status==='draft')saveData();renderAdmin();
  showToast('Đã ghi nhận ký hợp đồng ngày '+l.signedAt);
}
window.cancelLease=function(id){
  const l=getLease(id);if(!l||l.status!=='draft')return;
  if(!confirm('Hủy hợp đồng nháp này? Tiền cọc giữ chỗ (nếu có) cần hoàn/xử lý thủ công.'))return;
  l.status='cancelled';reconcileRoomStatus(l.roomId);
  saveData();renderAdmin();renderPublic();showToast('Đã hủy hợp đồng nháp');
}
window.deleteLease=function(id){
  const l=getLease(id);if(!l)return;
  if(leaseHasInvoices(id)){showToast('Hợp đồng đã có hóa đơn nên không thể xóa. Hãy dùng "Trả phòng / Thanh lý" để kết thúc.');return}
  if(l.status!=='draft'&&l.status!=='cancelled'){showToast('Chỉ xóa được hợp đồng nháp hoặc đã hủy. Hợp đồng đang chạy dùng "Trả phòng / Thanh lý".');return}
  if(!confirm('Xóa hẳn hợp đồng nháp này?'))return;
  data.leaseOccupants=data.leaseOccupants.filter(x=>x.leaseId!==id);
  data.handoverItems=data.handoverItems.filter(h=>h.leaseId!==id);
  data.leases=data.leases.filter(x=>x.id!==id);
  reconcileRoomStatus(l.roomId);
  saveData();renderAdmin();renderPublic();showToast('Đã xóa hợp đồng nháp');
}

/* ---------- Nhận phòng + bàn giao tài sản ---------- */

function handoverRowsHtml(roomId,phase,leaseId){
  const assets=data.assets.filter(a=>a.roomId===roomId&&!a.archived);
  if(!assets.length)return '<div class="empty">Phòng chưa khai báo tài sản. Có thể thêm ở nút "Tài sản" của phòng, hoặc bàn giao không kèm danh mục.</div>';
  const prev={};
  if(phase==='checkout'&&leaseId){
    data.handoverItems.filter(h=>h.leaseId===leaseId&&h.phase==='checkin').forEach(h=>prev[h.assetId]=h);
  }
  return `<table class="data-table"><thead><tr><th>Tài sản</th><th>SL bàn giao</th><th>Tình trạng ${phase==='checkin'?'đầu vào':'đầu ra'}</th></tr></thead><tbody>`+
    assets.map(a=>`<tr>
      <td><strong>${esc(a.name)}</strong>${phase==='checkout'&&prev[a.id]?`<br><span style="color:var(--muted)">Đầu vào: SL ${prev[a.id].quantity} · ${esc(prev[a.id].condition||'')}</span>`:''}</td>
      <td><input class="inline-input" type="number" min="0" data-ho-qty="${a.id}" value="${phase==='checkout'&&prev[a.id]?prev[a.id].quantity:a.quantity}"></td>
      <td><input class="inline-input" style="width:100%" data-ho-cond="${a.id}" value="${esc(phase==='checkin'?(a.condition||'Tốt'):'')}" placeholder="${phase==='checkin'?'Tốt / trầy xước…':'Tốt / hư hỏng, mô tả…'}"></td>
    </tr>`).join('')+'</tbody></table>';
}
function collectHandover(container,leaseId,phase){
  const items=[];
  container.querySelectorAll('[data-ho-qty]').forEach(inp=>{
    const assetId=inp.dataset.hoQty,a=data.assets.find(x=>x.id===assetId);
    const cond=container.querySelector(`[data-ho-cond="${assetId}"]`)?.value.trim()||'';
    items.push({id:uid('ho'),leaseId,assetId,phase,name:a?.name||'',quantity:Number(inp.value||0),
      condition:cond,note:'',imageIds:[],createdAt:new Date().toISOString()});
  });
  return items;
}

window.openCheckin=function(leaseId){
  const l=getLease(leaseId);if(!l)return;
  document.getElementById('checkinLeaseId').value=l.id;
  document.getElementById('checkinDate').value=today();
  const r=getRoom(l.roomId),t=getTenant(l.primaryTenantId);
  document.getElementById('checkinSummary').innerHTML=`<h4>${esc(r?.name||'')} · ${esc(t?.name||'')}</h4><p>Giá HĐ ${money(l.rentAmount)}/tháng · Cọc đã nhận ${money(l.depositPaid)}/${money(l.depositRequired)}</p>`;
  document.getElementById('checkinHandover').innerHTML=handoverRowsHtml(l.roomId,'checkin');
  openModal('checkinModal');
}
document.getElementById('checkinForm').addEventListener('submit',async e=>{
  e.preventDefault();
  const l=getLease(document.getElementById('checkinLeaseId').value);if(!l)return;
  const dateIn=document.getElementById('checkinDate').value||today();
  l.status='active';l.moveInAt=dateIn;if(!l.signedAt)l.signedAt=dateIn;
  data.handoverItems.push(...collectHandover(document.getElementById('checkinHandover'),l.id,'checkin'));
  leaseOccupantsOf(l.id).forEach(lo=>{
    if(!lo.joinedAt)lo.joinedAt=dateIn;
    const t=getTenant(lo.occupantId);
    if(t){t.roomId=l.roomId;t.active=true;t.moveOutDate='';if(!t.moveInDate)t.moveInDate=dateIn}
  });
  const primary=getTenant(l.primaryTenantId);
  if(primary){primary.depositRequired=l.depositRequired;primary.depositPaid=l.depositPaid}
  reconcileRoomStatus(l.roomId);
  saveData();closeModal('checkinModal');renderAdmin();renderPublic();
  showToast('Đã nhận phòng, hợp đồng có hiệu lực từ '+dateIn);
  const acc=primary?accountForOccupant(primary.id):null;
  if(primary&&!(acc&&(acc.pin||acc.hasPin))&&!tenantHasPin(primary)){
    if(confirm('Người đại diện chưa có mã PIN đăng nhập cư dân. Tạo PIN ngay bây giờ?'))resetTenantPin(primary.id);
  }
});

/* ---------- Người ở: thêm / rời đi / đổi đại diện ---------- */

window.openOccupantForm=function(leaseId){
  const l=getLease(leaseId);if(!l)return;
  const r=getRoom(l.roomId);
  const cap=Number(r?.capacity||0);
  const now=leaseOccupantsOf(l.id).length;
  document.getElementById('occupantLeaseId').value=l.id;
  document.getElementById('occupantSelect').innerHTML=occupantOptionsHtml('');
  document.getElementById('occupantJoinDate').value=today();
  document.getElementById('occupantCapNote').innerHTML=cap?`Phòng ${esc(r.name)} sức chứa ${cap} người · hiện có ${now} người ở.${now>=cap?' <strong>Đã đủ chỗ — cân nhắc trước khi thêm.</strong>':''}`:'';
  toggleOccupantNew();
  openModal('occupantModal');
}
window.toggleOccupantNew=function(){
  const isNew=document.getElementById('occupantSelect').value==='__new';
  document.getElementById('occupantNewRow').classList.toggle('hidden',!isNew);
}
document.getElementById('occupantForm').addEventListener('submit',e=>{
  e.preventDefault();
  const l=getLease(document.getElementById('occupantLeaseId').value);if(!l)return;
  const t=occupantFromPicker('occupantSelect','occupantNewName','occupantNewPhone');if(!t)return;
  if(leaseOccupantsOf(l.id).some(x=>x.occupantId===t.id)){showToast('Người này đã ở trong hợp đồng');return}
  data.leaseOccupants.push({id:uid('lo'),leaseId:l.id,occupantId:t.id,role:'member',
    joinedAt:document.getElementById('occupantJoinDate').value||today(),leftAt:'',note:'',createdAt:new Date().toISOString()});
  t.roomId=l.roomId;t.active=true;t.moveOutDate='';
  saveData();closeModal('occupantModal');renderAdmin();
  openLeaseDetail(l.id);
  showToast('Đã thêm người ở cùng: '+t.name);
});
window.removeOccupant=function(loId){
  const lo=data.leaseOccupants.find(x=>x.id===loId);if(!lo)return;
  const l=getLease(lo.leaseId),t=getTenant(lo.occupantId);
  if(lo.role==='primary'&&liveLease(l)){showToast('Đây là người đại diện thanh toán. Hãy chuyển đại diện cho người khác trước.');return}
  if(!confirm(`${t?.name||'Người này'} rời khỏi hợp đồng từ hôm nay?`))return;
  lo.leftAt=today();
  if(t&&!data.leaseOccupants.some(x=>x.occupantId===t.id&&!x.leftAt)){t.active=false;t.moveOutDate=today();t.roomId=''}
  saveData();renderAdmin();openLeaseDetail(lo.leaseId);
  showToast('Đã ghi nhận rời đi');
}
window.makePrimary=function(loId){
  const lo=data.leaseOccupants.find(x=>x.id===loId);if(!lo||lo.leftAt)return;
  const l=getLease(lo.leaseId);if(!l)return;
  const t=getTenant(lo.occupantId);
  if(!confirm(`Chuyển người đại diện thanh toán sang ${t?.name||''}? Hóa đơn cũ vẫn giữ nguyên tên người cũ để đối chiếu.`))return;
  leaseOccupantsOf(l.id,false).forEach(x=>{if(x.role==='primary'&&!x.leftAt)x.role='member'});
  lo.role='primary';
  l.primaryTenantId=lo.occupantId; // hóa đơn đã phát hành KHÔNG bị sửa — lịch sử được giữ nguyên
  if(t){t.depositRequired=l.depositRequired;t.depositPaid=l.depositPaid}
  saveData();renderAdmin();openLeaseDetail(l.id);
  showToast('Đã chuyển người đại diện. Hóa đơn từ tháng sau sẽ đứng tên '+(t?.name||''));
}

/* ---------- Chuyển phòng có ngày hiệu lực ---------- */

window.openTransferForm=function(leaseId){
  const l=getLease(leaseId);if(!l)return;
  document.getElementById('transferLeaseId').value=l.id;
  const options=visibleRooms().filter(r=>r.id!==l.roomId&&!activeLeaseForRoom(r.id)&&!draftLeaseForRoom(r.id))
    .map(r=>{const p=getProperty(r.propertyId);return `<option value="${r.id}">${esc(p?.name||'')} · ${esc(r.name)} — ${money(r.price)}/tháng</option>`}).join('');
  if(!options){showToast('Không còn phòng trống để chuyển.');return}
  document.getElementById('transferRoom').innerHTML=options;
  document.getElementById('transferDate').value=today();
  document.getElementById('transferKeepRent').checked=true;
  const cur=getRoom(l.roomId);
  document.getElementById('transferNote').innerHTML=`Đang ở <strong>${esc(cur?.name||'')}</strong> với giá hợp đồng ${money(l.rentAmount)}/tháng.`;
  openModal('transferModal');
}
document.getElementById('transferForm').addEventListener('submit',e=>{
  e.preventDefault();
  const l=getLease(document.getElementById('transferLeaseId').value);if(!l)return;
  const newRoomId=document.getElementById('transferRoom').value;
  const eff=document.getElementById('transferDate').value||today();
  const newRoom=getRoom(newRoomId);if(!newRoom){showToast('Phòng mới không hợp lệ');return}
  const oldRoomId=l.roomId;
  const lastFrom=l.roomHistory.length?l.roomHistory[l.roomHistory.length-1].to:(l.moveInAt||l.startDate||'');
  l.roomHistory.push({roomId:oldRoomId,from:lastFrom,to:eff}); // giữ lịch sử phòng cũ
  l.roomId=newRoomId;l.propertyId=newRoom.propertyId;
  if(!document.getElementById('transferKeepRent').checked){
    l.renewals.push({type:'rent-change',at:eff,oldRent:l.rentAmount,newRent:Number(newRoom.price||0)});
    l.rentAmount=Number(newRoom.price||0);
  }
  leaseOccupantsOf(l.id).forEach(lo=>{const t=getTenant(lo.occupantId);if(t)t.roomId=newRoomId});
  reconcileRoomStatus(oldRoomId);reconcileRoomStatus(newRoomId);
  saveData();closeModal('transferModal');renderAdmin();renderPublic();
  openLeaseDetail(l.id);
  showToast(`Đã chuyển phòng từ ${eff}. Trạng thái hai phòng đã cập nhật.`);
});

/* ---------- Gia hạn ---------- */

window.openRenewForm=function(leaseId){
  const l=getLease(leaseId);if(!l)return;
  document.getElementById('renewLeaseId').value=l.id;
  document.getElementById('renewEnd').value='';
  document.getElementById('renewRent').value=l.rentAmount;
  document.getElementById('renewInfo').innerHTML=`Hạn hiện tại: <strong>${esc(l.endDate||'không thời hạn')}</strong> · Giá HĐ hiện tại: <strong>${money(l.rentAmount)}</strong>/tháng`;
  openModal('renewModal');
}
document.getElementById('renewForm').addEventListener('submit',e=>{
  e.preventDefault();
  const l=getLease(document.getElementById('renewLeaseId').value);if(!l)return;
  const newEnd=document.getElementById('renewEnd').value;
  if(!newEnd){showToast('Chọn ngày kết thúc mới');return}
  if(l.endDate&&newEnd<=l.endDate){showToast('Ngày kết thúc mới phải sau hạn hiện tại');return}
  const newRent=Number(document.getElementById('renewRent').value||l.rentAmount);
  l.renewals.push({type:'renew',at:today(),oldEnd:l.endDate||'',newEnd,oldRent:l.rentAmount,newRent});
  l.endDate=newEnd;l.rentAmount=newRent;
  if(l.status==='ending')l.status='active';
  saveData();closeModal('renewModal');renderAdmin();openLeaseDetail(l.id);
  showToast('Đã gia hạn đến '+newEnd);
});

/* ---------- Trả phòng / thanh lý ---------- */

window.openEndLease=function(leaseId){
  const l=getLease(leaseId);if(!l)return;
  document.getElementById('endLeaseId').value=l.id;
  document.getElementById('endDate2').value=today();
  document.getElementById('endReason').value='';
  document.getElementById('endDeduct').value=0;
  document.getElementById('endSettleNote').value='';
  const r=getRoom(l.roomId),t=getTenant(l.primaryTenantId);
  document.getElementById('endSummary').innerHTML=`<h4>${esc(r?.name||'')} · ${esc(t?.name||'')}</h4><p>Cọc đã nhận: <strong>${money(l.depositPaid)}</strong></p>`;
  document.getElementById('endHandover').innerHTML=handoverRowsHtml(l.roomId,'checkout',l.id);
  updateEndRefund();
  openModal('endLeaseModal');
}
window.updateEndRefund=function(){
  const l=getLease(document.getElementById('endLeaseId').value);if(!l)return;
  const deduct=Math.max(0,Number(document.getElementById('endDeduct').value||0));
  const refund=Math.max(0,Number(l.depositPaid||0)-deduct);
  document.getElementById('endRefundPreview').innerHTML=
    `Cọc đã nhận ${money(l.depositPaid)} − trừ ${money(deduct)} = <strong>hoàn khách ${money(refund)}</strong>`;
}
document.getElementById('endLeaseForm').addEventListener('submit',e=>{
  e.preventDefault();
  const l=getLease(document.getElementById('endLeaseId').value);if(!l)return;
  const out=document.getElementById('endDate2').value||today();
  const deduct=Math.max(0,Math.min(Number(document.getElementById('endDeduct').value||0),Number(l.depositPaid||0)));
  l.status='ended';l.moveOutAt=out;
  l.terminationReason=document.getElementById('endReason').value.trim();
  l.depositDeduct=deduct;l.depositRefund=Math.max(0,Number(l.depositPaid||0)-deduct);
  l.settlementNote=document.getElementById('endSettleNote').value.trim();
  // Sổ cọc: ghi trừ / hoàn khi thanh lý (tách khỏi doanh thu tiền phòng)
  if(deduct>0)addDepositEntry(l.id,'deduct',deduct,'',l.settlementNote||'Trừ cọc khi thanh lý',out);
  if(l.depositRefund>0)addDepositEntry(l.id,'refund',l.depositRefund,'cash','Hoàn cọc khi thanh lý',out);
  data.handoverItems.push(...collectHandover(document.getElementById('endHandover'),l.id,'checkout'));
  leaseOccupantsOf(l.id).forEach(lo=>{
    lo.leftAt=out;
    const t=getTenant(lo.occupantId);
    if(t&&!data.leaseOccupants.some(x=>x.occupantId===t.id&&!x.leftAt)){t.active=false;t.moveOutDate=out}
  });
  reconcileRoomStatus(l.roomId);
  saveData();closeModal('endLeaseModal');renderAdmin();renderPublic();
  showToast(`Đã thanh lý hợp đồng. Hoàn cọc ${money(l.depositRefund)} cho khách.`);
});

/* ---------- Tài sản theo phòng ---------- */

window.openRoomAssets=function(roomId){
  const r=getRoom(roomId);if(!r)return;
  document.getElementById('assetsRoomId').value=roomId;
  document.getElementById('assetsTitle').textContent='Tài sản phòng '+r.name;
  renderAssetRows();
  openModal('assetsModal');
}
function renderAssetRows(){
  const roomId=document.getElementById('assetsRoomId').value;
  const list=data.assets.filter(a=>a.roomId===roomId&&!a.archived);
  document.getElementById('assetsRows').innerHTML=(list.length?`<table class="data-table"><thead><tr><th>Tên</th><th>SL</th><th>Tình trạng</th><th>Ghi chú</th><th></th></tr></thead><tbody>`+
    list.map(a=>`<tr>
      <td><input class="inline-input" style="width:100%" value="${esc(a.name)}" data-evt="change" data-call="editAsset" data-a1="${a.id}" data-a2="name" data-a3="V"></td>
      <td><input class="inline-input" type="number" min="0" value="${a.quantity}" data-evt="change" data-call="editAsset" data-a1="${a.id}" data-a2="quantity" data-a3="V"></td>
      <td><input class="inline-input" style="width:100%" value="${esc(a.condition||'')}" data-evt="change" data-call="editAsset" data-a1="${a.id}" data-a2="condition" data-a3="V"></td>
      <td><input class="inline-input" style="width:100%" value="${esc(a.note||'')}" data-evt="change" data-call="editAsset" data-a1="${a.id}" data-a2="note" data-a3="V"></td>
      <td><button type="button" class="icon-btn danger" data-evt="click" data-call="deleteAsset" data-a1="${a.id}">Xóa</button></td>
    </tr>`).join('')+'</tbody></table>':'<div class="empty">Chưa có tài sản nào cho phòng này.</div>');
}
window.editAsset=function(id,field,value){
  const a=data.assets.find(x=>x.id===id);if(!a)return;
  a[field]=field==='quantity'?Math.max(0,Number(value||0)):String(value);
  saveData();
}
window.addAssetRow=function(){
  const roomId=document.getElementById('assetsRoomId').value;
  const name=document.getElementById('assetNewName').value.trim();
  if(!name){showToast('Nhập tên tài sản');return}
  data.assets.push({id:uid('as'),roomId,name,quantity:Math.max(1,Number(document.getElementById('assetNewQty').value||1)),
    condition:document.getElementById('assetNewCond').value.trim()||'Tốt',note:'',imageIds:[],archived:false,createdAt:new Date().toISOString()});
  document.getElementById('assetNewName').value='';document.getElementById('assetNewQty').value=1;document.getElementById('assetNewCond').value='';
  saveData();renderAssetRows();
}
window.deleteAsset=function(id){
  const used=data.handoverItems.some(h=>h.assetId===id);
  const a=data.assets.find(x=>x.id===id);if(!a)return;
  if(used){a.archived=true;showToast('Tài sản đã có biên bản bàn giao nên chỉ lưu trữ, không xóa hẳn.')}
  else data.assets=data.assets.filter(x=>x.id!==id);
  saveData();renderAssetRows();
}

/* ---------- Danh sách + chi tiết hợp đồng (timeline) ---------- */

function leaseCardHtml(l){
  const r=getRoom(l.roomId),p=getProperty(l.propertyId||r?.propertyId),t=getTenant(l.primaryTenantId);
  const others=leaseOccupantsOf(l.id).filter(x=>x.role!=='primary').length;
  const d=l.endDate?daysUntil(l.endDate):null;
  const warn=liveLease(l)&&d!==null&&d>=0&&d<=30?`<span class="lease-warn lv${d<=7?7:d<=15?15:30}">Còn ${d} ngày</span>`:'';
  const chip=`<span class="lease-chip lease-${l.status}">${leaseStatusLabel(l.status)}</span>`;
  const acts=[`<button class="icon-btn" data-evt="click" data-call="openLeaseDetail" data-a1="${l.id}">Chi tiết</button>`];
  if(l.status==='draft')acts.push(`<button class="icon-btn" data-evt="click" data-call="openCheckin" data-a1="${l.id}">Nhận phòng</button>`,`<button class="icon-btn" data-evt="click" data-call="openLeaseForm" data-a1="${l.id}">Sửa</button>`,`<button class="icon-btn danger" data-evt="click" data-call="cancelLease" data-a1="${l.id}">Hủy</button>`);
  if(liveLease(l))acts.push(`<button class="icon-btn" data-evt="click" data-call="openRenewForm" data-a1="${l.id}">Gia hạn</button>`,`<button class="icon-btn" data-evt="click" data-call="openTransferForm" data-a1="${l.id}">Chuyển phòng</button>`,`<button class="icon-btn danger" data-evt="click" data-call="openEndLease" data-a1="${l.id}">Trả phòng</button>`);
  return `<div class="lease-card" data-lease="${l.id}">
    <div class="lease-card-main" data-evt="click" data-call="openLeaseDetail" data-a1="${l.id}">
      <div><strong>${esc(p?.name||'')} · ${esc(r?.name||'?')}</strong> ${chip} ${warn}</div>
      <div class="lease-sub">👤 ${esc(t?.name||'—')}${others?` +${others} người ở cùng`:''} · ${money(l.rentAmount)}/tháng</div>
      <div class="lease-sub">${esc(l.startDate||'?')} → ${esc(l.endDate||'không thời hạn')} · Cọc ${money(l.depositPaid)}/${money(l.depositRequired)}</div>
    </div>
    <div class="table-actions">${acts.join('')}</div>
  </div>`;
}

function renderLeases(){
  const root=document.getElementById('view-leases');if(!root)return;
  const alerts=leaseAlerts();
  const alertHtml=alerts.expiring.length?`<div class="lease-alerts">
    <h4>⏰ Hợp đồng sắp hết hạn & phòng sắp trống</h4>
    ${alerts.expiring.map(x=>{const r=getRoom(x.lease.roomId),t=getTenant(x.lease.primaryTenantId);
      return `<button class="lease-alert lv${x.level}" data-evt="click" data-call="openLeaseDetail" data-a1="${x.lease.id}">
        <strong>${esc(r?.name||'')}</strong> · ${esc(t?.name||'')} — hết hạn ${esc(x.lease.endDate)} (còn ${x.days} ngày)
      </button>`}).join('')}
  </div>`:'';
  const st=ui('leases');const q=st.q.toLowerCase();
  const order={draft:0,active:1,ending:1,ended:2,cancelled:3};
  let list=[...data.leases];
  if(q)list=list.filter(l=>{const t=getTenant(l.primaryTenantId),r=getRoom(l.roomId);return [t?.name,t?.phone,r?.name].join(' ').toLowerCase().includes(q)});
  if(st.filter!=='all')list=list.filter(l=>st.filter==='live'?liveLease(l):l.status===st.filter);
  list.sort((a,b)=>(order[a.status]??9)-(order[b.status]??9)||String(b.createdAt||'').localeCompare(a.createdAt||''));
  const {slice,nav}=paginate(list,'leases',10);
  root.innerHTML=`<div class="panel"><div class="panel-head"><div><h3>Hợp đồng thuê</h3><p>Giữ chỗ → nháp → nhận phòng → đang hiệu lực → gia hạn/chuyển phòng → thanh lý</p></div>${can('create','leases')?`<button class="btn btn-primary" onclick="openLeaseForm()">${icon('plus',15)} Hợp đồng mới</button>`:''}</div>
    <div class="table-tools">
      <span class="tt-search">${icon('search',15)}<input value="${esc(st.q)}" placeholder="Tìm tên, SĐT, phòng…" aria-label="Tìm hợp đồng" oninput="uiSet('leases','q',this.value)"></span>
      <select aria-label="Lọc hợp đồng" onchange="uiSet('leases','filter',this.value)">
        <option value="all" ${st.filter==='all'?'selected':''}>Tất cả</option>
        <option value="live" ${st.filter==='live'?'selected':''}>Đang hiệu lực</option>
        <option value="draft" ${st.filter==='draft'?'selected':''}>Nháp / giữ chỗ</option>
        <option value="ended" ${st.filter==='ended'?'selected':''}>Đã thanh lý</option>
      </select>
    </div>
    ${alertHtml}
    ${slice.length?slice.map(leaseCardHtml).join(''):data.leases.length?emptyState('search','Không khớp bộ lọc','Đổi từ khóa hoặc chuyển bộ lọc về Tất cả.',''):emptyState('filetext','Chưa có hợp đồng nào','Hợp đồng tự tạo khi thêm người thuê, hoặc chuyển từ lead trong CRM để khỏi nhập lại thông tin.',`<button class="btn btn-light" onclick="switchAdminView('appointments')">Mở CRM khách</button>`)}
    ${nav}
  </div>`;
}

function timelineEvents(l){
  const ev=[];
  const push=(date,icon,title,sub)=>{if(date)ev.push({date:String(date).slice(0,10),icon,title,sub:sub||''})};
  push(l.createdAt,'📝','Tạo hợp đồng nháp','');
  if(Number(l.depositPaid)>0)push(l.signedAt||l.createdAt,'💰','Đặt cọc giữ chỗ',money(l.depositPaid)+' / yêu cầu '+money(l.depositRequired));
  push(l.signedAt,'✍️','Ký hợp đồng','');
  const hoIn=data.handoverItems.filter(h=>h.leaseId===l.id&&h.phase==='checkin');
  push(l.moveInAt,'🔑','Nhận phòng & bàn giao',hoIn.length?hoIn.length+' hạng mục tài sản đầu vào':'');
  leaseOccupantsOf(l.id,false).forEach(lo=>{
    const t=getTenant(lo.occupantId);
    if(lo.joinedAt&&lo.joinedAt!==(l.moveInAt||l.startDate))push(lo.joinedAt,'➕','Thêm người ở: '+(t?.name||''),lo.role==='primary'?'Đại diện thanh toán':'Ở cùng');
    if(lo.leftAt&&lo.leftAt!==l.moveOutAt)push(lo.leftAt,'➖','Rời đi: '+(t?.name||''),'');
  });
  l.roomHistory.forEach(h=>{const r=getRoom(h.roomId);push(h.to,'🔀','Chuyển khỏi phòng '+(r?.name||h.roomId),'Ở từ '+(h.from||'?')+' đến '+h.to)});
  l.renewals.forEach(rn=>{
    if(rn.type==='renew')push(rn.at,'🔁','Gia hạn đến '+rn.newEnd,rn.oldRent!==rn.newRent?money(rn.oldRent)+' → '+money(rn.newRent)+'/tháng':'');
    else push(rn.at,'💵','Điều chỉnh giá',money(rn.oldRent)+' → '+money(rn.newRent)+'/tháng');
  });
  data.invoices.filter(i=>i.leaseId===l.id||i.tenantId===l.primaryTenantId).forEach(i=>{
    push(i.createdAt,'🧾','Hóa đơn tháng '+i.month,money(i.total)+' · '+({paid:'Đã thanh toán',partial:'Trả một phần',unpaid:'Chưa thanh toán'}[effectiveInvoiceStatus(i)]||''));
    (i.payments||[]).forEach(p2=>push(p2.date||p2.at,'💳','Thu tiền HĐ '+i.month,money(p2.amount)+(p2.method?' · '+({cash:'Tiền mặt',bank:'Chuyển khoản',other:'Khác'}[p2.method]||p2.method):'')));
  });
  const hoOut=data.handoverItems.filter(h=>h.leaseId===l.id&&h.phase==='checkout');
  if(l.moveOutAt){
    push(l.moveOutAt,'📤','Trả phòng & bàn giao ra',hoOut.length?hoOut.length+' hạng mục kiểm tra đầu ra':'');
    push(l.moveOutAt,'🏁','Thanh lý hợp đồng',
      'Trừ cọc '+money(l.depositDeduct)+' · Hoàn khách '+money(l.depositRefund)+(l.terminationReason?' · Lý do: '+l.terminationReason:''));
  }
  ev.sort((a,b)=>a.date.localeCompare(b.date));
  return ev;
}

window.openLeaseDetail=function(id){
  const l=getLease(id);if(!l)return;
  const r=getRoom(l.roomId),p=getProperty(l.propertyId||r?.propertyId);
  const occ=leaseOccupantsOf(l.id,false);
  const occHtml=occ.map(lo=>{
    const t=getTenant(lo.occupantId);
    const gone=!!lo.leftAt;
    return `<div class="occ-row ${gone?'occ-gone':''}">
      <div><strong>${esc(t?.name||'?')}</strong> ${lo.role==='primary'?'<span class="badge badge-paid">Đại diện thanh toán</span>':''}${gone?`<span class="badge badge-unpaid">Đã rời ${esc(lo.leftAt)}</span>`:''}
      <br><span style="color:var(--muted)">${esc(t?.phone||'')}${lo.joinedAt?' · vào ở '+esc(lo.joinedAt):''}</span></div>
      ${!gone&&liveLease(l)?`<div class="table-actions">${lo.role!=='primary'?`<button class="icon-btn" data-evt="click" data-call="makePrimary" data-a1="${lo.id}">Làm đại diện</button><button class="icon-btn danger" data-evt="click" data-call="removeOccupant" data-a1="${lo.id}">Rời đi</button>`:''}</div>`:''}
    </div>`;
  }).join('');
  const acts=[];
  if(l.status==='draft')acts.push(`<button class="btn btn-primary" data-evt="click" data-call="closeModal" data-a1="leaseDetailModal');openCheckin('${l.id}">🔑 Nhận phòng</button>`,`<button class="btn btn-light" data-evt="click" data-call="signLease" data-a1="${l.id}');openLeaseDetail('${l.id}">✍️ Ký HĐ</button>`,`<button class="btn btn-light" data-evt="click" data-call="closeModal" data-a1="leaseDetailModal');openLeaseForm('${l.id}">Sửa nháp</button>`);
  if(liveLease(l))acts.push(`<button class="btn btn-light" data-evt="click" data-call="closeModal" data-a1="leaseDetailModal');openOccupantForm('${l.id}">➕ Thêm người ở</button>`,
    `<button class="btn btn-light" data-evt="click" data-call="closeModal" data-a1="leaseDetailModal');openRenewForm('${l.id}">🔁 Gia hạn</button>`,
    `<button class="btn btn-light" data-evt="click" data-call="closeModal" data-a1="leaseDetailModal');openTransferForm('${l.id}">🔀 Chuyển phòng</button>`,
    `<button class="btn btn-danger" data-evt="click" data-call="closeModal" data-a1="leaseDetailModal');openEndLease('${l.id}">📤 Trả phòng / Thanh lý</button>`);
  document.getElementById('leaseDetailTitle').textContent=`Hợp đồng · ${p?.name||''} ${r?.name||''}`;
  document.getElementById('leaseDetailBody').innerHTML=`
    <div class="lease-head-grid">
      <div class="kv"><span>Trạng thái</span><strong><span class="lease-chip lease-${l.status}">${leaseStatusLabel(l.status)}</span></strong></div>
      <div class="kv"><span>Thời hạn</span><strong>${esc(l.startDate||'?')} → ${esc(l.endDate||'không thời hạn')}</strong></div>
      <div class="kv"><span>Giá hợp đồng (đã chốt)</span><strong>${money(l.rentAmount)}/tháng</strong></div>
      <div class="kv"><span>Cọc</span><strong>${money(l.depositPaid)} / ${money(l.depositRequired)}</strong></div>
      <div class="kv"><span>Ngày thu hàng tháng</span><strong>Ngày ${l.billingDay}</strong></div>
      ${l.status==='ended'?`<div class="kv"><span>Thanh lý</span><strong>Trừ ${money(l.depositDeduct)} · Hoàn ${money(l.depositRefund)}</strong></div>`:''}
    </div>
    ${l.note?`<p class="muted-text">📝 ${esc(l.note)}</p>`:''}
    ${l.settlementNote?`<p class="muted-text">🏁 ${esc(l.settlementNote)}</p>`:''}
    <h4 class="lease-section-title">Người ở (${leaseOccupantsOf(l.id).length} hiện tại)</h4>
    ${occHtml||'<div class="empty">Chưa gắn người ở.</div>'}
    <h4 class="lease-section-title">Dịch vụ áp dụng</h4>
    ${leaseServicesOf(l.id,monthNow()).map(ls=>{const sv=getService(ls.serviceId);if(!sv)return'';
      const price=Number(ls.priceOverride)>0?ls.priceOverride:servicePriceForMonth(sv,monthNow());
      return `<div class="occ-row"><div><strong>${esc(sv.name)}</strong> · ${calcTypeLabel(sv.calcType)} · ${money(price)}${sv.unit?'/'+esc(sv.unit):''}${sv.calcType==='perUnit'?` × ${ls.quantity}`:''}${ls.discountPercent?` · giảm ${ls.discountPercent}%`:''}<br><span style="color:var(--muted)">Từ ${esc(ls.effectiveFrom||'?')}</span></div>${liveLease(l)?`<div class="table-actions"><button class="icon-btn danger" data-evt="click" data-call="endLeaseService" data-a1="${ls.id}">Ngừng</button></div>`:''}</div>`}).join('')||'<div class="empty">Chưa gắn dịch vụ nào.</div>'}
    ${liveLease(l)?`<div class="table-actions" style="margin-top:6px"><button class="icon-btn" data-evt="click" data-call="closeModal" data-a1="leaseDetailModal');openLeaseServiceForm('${l.id}">+ Gắn dịch vụ</button></div>`:''}
    <h4 class="lease-section-title">Sổ cọc (tách khỏi doanh thu)</h4>
    ${(()=>{const t2=depositTotals(l.id);return `<div class="kv"><span>Đã thu ${money(t2.collect)} · Đã trừ ${money(t2.deduct)} · Đã hoàn ${money(t2.refund)}</span><strong>Đang giữ ${money(t2.held)}</strong></div>`})()}
    ${depositEntries(l.id).map(x=>`<div class="rem-log">${({collect:'💰 Thu cọc',refund:'↩ Hoàn cọc',deduct:'✂ Trừ cọc'})[x.type]} ${money(x.amount)} · ${esc(x.at)}${x.note?` · ${esc(x.note)}`:''}</div>`).join('')||'<div class="empty">Chưa có giao dịch cọc.</div>'}
    ${liveLease(l)?`<div class="table-actions" style="margin-top:6px"><button class="icon-btn" data-evt="click" data-call="closeModal" data-a1="leaseDetailModal');openDepositForm('${l.id}" data-a2="collect">+ Thu cọc</button><button class="icon-btn" data-evt="click" data-call="closeModal" data-a1="leaseDetailModal');openDepositForm('${l.id}" data-a2="refund">Hoàn cọc</button></div>`:''}
    <h4 class="lease-section-title">Dòng thời gian</h4>
    <div class="timeline">${timelineEvents(l).map(e2=>`
      <div class="tl-item"><div class="tl-dot">${e2.icon}</div>
        <div class="tl-body"><div class="tl-date">${esc(e2.date)}</div>
        <div class="tl-title">${esc(e2.title)}</div>${e2.sub?`<div class="tl-sub">${esc(e2.sub)}</div>`:''}</div></div>`).join('')||'<div class="empty">Chưa có sự kiện.</div>'}
    </div>
    <div class="lease-detail-actions">${acts.join('')}</div>`;
  openModal('leaseDetailModal');
}

function renderSettings(){
  const cfg=Sync.cfg||{},connected=Sync.isOn();
  const roleText=Sync.isAdmin()?'Quản lý (đọc & ghi)':connected?'Chỉ xem':'Chưa kết nối';
  const last=Sync.state?.lastOk?new Date(Sync.state.lastOk).toLocaleString('vi-VN'):'chưa lần nào';
  const deviceBtns=(connected&&Sync.isAdmin())?`
      <button class="btn btn-light" onclick="logoutThisDevice()">Đăng xuất thiết bị này</button>
      <button class="btn btn-danger" onclick="logoutAllDevices()">Đăng xuất tất cả thiết bị</button>`:'';
  document.getElementById('view-settings').innerHTML=`<div class="settings-grid">
  <div class="conn-card" style="grid-column:1/-1">
    ${Sync.embedded()?`
    <h3>Đồng bộ Google Sheets</h3>
    <p class="muted-text">Website này chạy thẳng trên Google của anh nên đã nối sẵn với bảng dữ liệu — không cần cài thêm gì. Gửi đúng đường dẫn này cho khách xem phòng và cho cư dân đăng nhập.</p>
    <label>Đổi mật khẩu quản lý</label>
    <input id="cfgNewPass" type="password" placeholder="Mật khẩu mới: ít nhất 10 ký tự, nên có cả chữ và số" autocomplete="new-password">
    <div class="conn-actions">
      <button class="btn btn-primary" id="changePassBtn" onclick="changeAdminPassword()">Lưu mật khẩu mới</button>
      <button class="btn btn-light" onclick="Sync.cycle(true)">Đồng bộ ngay</button>${deviceBtns}
    </div>`:`
    <h3>Kết nối Google Sheets</h3>
    <p class="muted-text">Để nguyên <b>/api/sheets</b> nếu chạy trên Vercel (đường dẫn Apps Script khai ở biến môi trường APPS_SCRIPT_URL). Hosting khác thì dán đường dẫn /exec đầy đủ.</p>
    <label>Đường dẫn máy chủ</label>
    <input id="cfgApiUrl" placeholder="/api/sheets" value="${esc(cfg.apiUrl||'')}">
    <label>Mật khẩu quản lý (để trống nếu chỉ xem)</label>
    <input id="cfgWriteKey" type="password" placeholder="Mật khẩu quản lý" autocomplete="current-password">
    <div class="conn-actions">
      <button class="btn btn-primary" id="connPullBtn" onclick="connectSheets('pull')">Kết nối & lấy dữ liệu từ Sheets</button>
      <button class="btn btn-light" id="connPushBtn" onclick="connectSheets('push')">Kết nối & đẩy dữ liệu máy này lên</button>
      <button class="btn btn-light" onclick="Sync.cycle(true)">Đồng bộ ngay</button>
    </div>
    ${Sync.isAdmin()?`
    <label>Đổi mật khẩu quản lý</label>
    <input id="cfgNewPass" type="password" placeholder="Mật khẩu mới: ít nhất 10 ký tự, nên có cả chữ và số" autocomplete="new-password">
    <div class="conn-actions">
      <button class="btn btn-primary" id="changePassBtn" onclick="changeAdminPassword()">Lưu mật khẩu mới</button>${deviceBtns}
    </div>`:''}`}
    <div class="conn-state">Trạng thái: <b>${roleText}</b> · Đồng bộ gần nhất: <b>${last}</b>${Sync.lastError?` · Lỗi: <b>${esc(Sync.lastError)}</b>`:''}</div>
  </div>
  <div class="settings-card"><h3>Thương hiệu & thông tin quản lý</h3>
    <label style="display:block;font-size:12.5px;color:var(--muted);margin:10px 0 4px">Tên thương hiệu (hiện trên trang khách)</label>
    <input id="setBrandName" value="${esc(data.settings.brandName||'Huy Rooms')}" style="width:100%;padding:11px;border:1px solid var(--line);border-radius:11px;font:inherit">
    <label style="display:block;font-size:12.5px;color:var(--muted);margin:10px 0 4px">Tên hiển thị khi nhắc thu tiền</label>
    <input id="setManagerName" value="${esc(data.settings.managerName||'')}" style="width:100%;padding:11px;border:1px solid var(--line);border-radius:11px;font:inherit">
    <label style="display:block;font-size:12.5px;color:var(--muted);margin:10px 0 4px">Số điện thoại / hotline (dùng cho nút Gọi ở trang khách)</label>
    <input id="setManagerPhone" value="${esc(data.settings.managerPhone||'')}" style="width:100%;padding:11px;border:1px solid var(--line);border-radius:11px;font:inherit">
    <label style="display:block;font-size:12.5px;color:var(--muted);margin:10px 0 4px">Số ngày tới hạn mặc định</label>
    <input id="setDueDay" type="number" min="1" max="28" value="${Number(data.settings.defaultDueDay||5)}" style="width:100%;padding:11px;border:1px solid var(--line);border-radius:11px;font:inherit">
    <label style="display:block;font-size:12.5px;color:var(--muted);margin:10px 0 4px">Giờ nhận khách xem phòng (từ – đến)</label>
    <div style="display:flex;gap:8px"><input id="setWorkStart" type="time" value="${esc(data.settings.workStart||'08:00')}" style="width:100%;padding:11px;border:1px solid var(--line);border-radius:11px;font:inherit"><input id="setWorkEnd" type="time" value="${esc(data.settings.workEnd||'20:00')}" style="width:100%;padding:11px;border:1px solid var(--line);border-radius:11px;font:inherit"></div>
    <label style="display:block;font-size:12.5px;color:var(--muted);margin:10px 0 4px">Số Zalo nhận tin khách (bỏ trống = dùng hotline)</label>
    <input id="setZaloPhone" value="${esc(data.settings.zaloPhone||'')}" placeholder="09xxxxxxxx" style="width:100%;padding:11px;border:1px solid var(--line);border-radius:11px;font:inherit">
    <label style="display:block;font-size:12.5px;color:var(--muted);margin:10px 0 4px">Ngân hàng (mã VietQR, ví dụ: VCB, TCB, MB, ACB, BIDV…)</label>
    <input id="setBankCode" value="${esc(data.settings.bankCode||'')}" placeholder="VCB" style="width:100%;padding:11px;border:1px solid var(--line);border-radius:11px;font:inherit">
    <label style="display:block;font-size:12.5px;color:var(--muted);margin:10px 0 4px">Số tài khoản nhận tiền</label>
    <input id="setBankAccount" value="${esc(data.settings.bankAccount||'')}" placeholder="0123456789" style="width:100%;padding:11px;border:1px solid var(--line);border-radius:11px;font:inherit">
    <label style="display:block;font-size:12.5px;color:var(--muted);margin:10px 0 4px">Tên chủ tài khoản (in trên hóa đơn)</label>
    <input id="setBankName" value="${esc(data.settings.bankAccountName||'')}" placeholder="VAN VIET DUC HUY" style="width:100%;padding:11px;border:1px solid var(--line);border-radius:11px;font:inherit">
    <p class="muted-text" style="margin-top:6px">Điền đủ 2 ô ngân hàng + số tài khoản thì mỗi hóa đơn PDF sẽ tự có mã VietQR đúng số tiền và nội dung chuyển khoản.</p>
    <button class="btn btn-primary" style="margin-top:12px" onclick="saveManagerSettings()">Lưu thông tin</button>
  </div>
  <div class="settings-card"><h3>Nhắc thanh toán qua Zalo</h3><p>Mỗi hóa đơn có nút "Nhắc Zalo": hệ thống soạn sẵn tiền phòng, điện, nước, cọc, số còn lại và hạn thanh toán để anh sao chép gửi khách.</p><div class="code-note">Gửi Zalo tự động cần Zalo Official Account + backend riêng. Không đặt access token Zalo trong file web công khai.</div></div>
  <div class="settings-card"><h3>Sao lưu dữ liệu</h3><p>Tải căn trọ, phòng, người thuê, điện nước, hóa đơn và lịch hẹn về máy dạng JSON.</p><button class="btn btn-light" onclick="exportData()">Tải file sao lưu</button></div>
  <div class="settings-card"><h3>Khôi phục dữ liệu</h3><p>Nhập lại file JSON đã sao lưu. Hệ thống kiểm tra cấu trúc, cho xem số bản ghi và tự tải một bản sao lưu dữ liệu hiện tại trước khi áp dụng.</p><input type="file" id="importFile" accept="application/json" style="margin:8px 0 12px"><button class="btn btn-light" onclick="importData()">Nhập dữ liệu</button>
  <div style="margin-top:12px"><small style="color:var(--muted)">BẢN TỰ LƯU TRÊN MÁY NÀY (mỗi ngày một bản, giữ 7 ngày)</small>
  ${autoBackups().length?autoBackups().slice().reverse().map(b=>`<div class="tk-row"><div class="tk-main"><strong>${esc(b.date)}</strong><small>Tự lưu lúc ${esc(String(b.at).slice(11,16))}</small></div><button class="icon-btn" data-evt="click" data-call="restoreAutoBackup" data-a1="${esc(b.date)}">Khôi phục</button></div>`).join(''):'<p class="muted-text" style="margin:6px 0 0">Chưa có — bản đầu tiên tự tạo sau ~20 giây dùng ứng dụng.</p>'}
  </div></div>
  <div class="settings-card"><h3>Xuất danh sách phòng CSV</h3><p>Mở bằng Excel để kiểm tra giá, tình trạng phòng và đơn giá điện nước.</p><button class="btn btn-light" onclick="exportRoomsCSV()">Xuất CSV</button></div>
  ${DEMO_MODE?`<div class="settings-card"><h3>Khôi phục dữ liệu mẫu (chế độ demo)</h3><p>Xóa dữ liệu trên máy này và nạp lại bản demo. Nếu đang kết nối Sheets, thao tác này cũng ghi đè dữ liệu chung — cân nhắc trước khi dùng.</p><button class="btn btn-danger" onclick="resetDemo()">Khôi phục bản demo</button></div>`:''}
  ${currentRole()==='owner'?staffCardHtml():''}
  ${['owner','manager'].includes(currentRole())?auditCardHtml():''}
  <div class="settings-card"><h3>Thoát quyền quản lý</h3><p>Máy này sẽ chỉ còn quyền xem phòng như khách.</p><button class="btn btn-danger" onclick="forgetAdminKey()">Thoát quyền quản lý</button></div>
</div>`}
/* ---------- v6: NHÂN SỰ & PHÂN QUYỀN (chỉ chủ nhà) ---------- */
const ROLE_LABEL={owner:'Chủ nhà',manager:'Quản lý',accountant:'Kế toán',staff:'Nhân viên'};
function staffCardHtml(){
  const list=data.staffUsers.filter(u=>!u.deleted);
  return `<div class="settings-card" style="grid-column:1/-1"><h3>${icon('shield',17)} Nhân sự & phân quyền</h3>
  <p>Nhân viên đăng nhập bằng <strong>tài khoản + mật khẩu riêng</strong>. Máy chủ chặn ghi ngoài phạm vi vai trò; giao diện ẩn thêm các nút không được dùng. Vai trò: Quản lý (mọi việc trừ nhân sự) · Kế toán (tiền: hóa đơn, sổ thu, sổ cọc, nhắc nợ, dịch vụ) · Nhân viên (lịch hẹn, sự cố, điện nước).</p>
  ${list.length?`<div class="table-wrap"><table class="data-table"><thead><tr><th>Tên</th><th>Tài khoản</th><th>Vai trò</th><th>Phạm vi căn</th><th>Trạng thái</th><th></th></tr></thead><tbody>
    ${list.map(u=>`<tr><td><strong>${esc(u.name)}</strong></td><td>${esc(u.username)}</td><td>${ROLE_LABEL[u.role]||'Không xác định'}</td><td>${(u.propertyIds||[]).length?(u.propertyIds||[]).map(id=>esc(getProperty(id)?.name||'?')).join(', '):'Tất cả căn'}</td><td>${u.active?'<span class="badge badge-paid">Hoạt động</span>':'<span class="badge badge-unpaid">Đã khóa</span>'}</td>
    <td><div class="table-actions"><button class="icon-btn" data-evt="click" data-call="openStaffForm" data-a1="${u.id}">Sửa</button><button class="icon-btn" data-evt="click" data-call="resetStaffPass" data-a1="${u.id}">${icon('key',14)} Mật khẩu</button><button class="icon-btn danger" data-evt="click" data-call="toggleStaff" data-a1="${u.id}">${u.active?'Khóa':'Mở khóa'}</button></div></td></tr>`).join('')}
  </tbody></table></div>`:emptyState('users','Chưa có nhân viên','Thêm nhân viên đầu tiên rồi bấm "Mật khẩu" để cấp mật khẩu đăng nhập.','')}
  <button class="btn btn-primary" style="margin-top:10px" onclick="openStaffForm()">${icon('plus',15)} Thêm nhân viên</button></div>`;
}
window.openStaffForm=function(id){
  const u=id?data.staffUsers.find(x=>x.id===id):null;
  document.getElementById('staffId').value=u?.id||'';
  document.getElementById('staffName').value=u?.name||'';
  document.getElementById('staffUsername').value=u?.username||'';
  document.getElementById('staffRole').value=u?.role||'staff';
  const box=document.getElementById('staffProps');
  box.innerHTML=visibleProperties().map(p=>`<label class="check-line"><input type="checkbox" value="${p.id}" ${(u?.propertyIds||[]).includes(p.id)?'checked':''}> ${esc(p.name)}</label>`).join('')||'<p class="muted-text">Chưa có căn trọ.</p>';
  openModal('staffModal');
}
document.getElementById('staffForm').addEventListener('submit',e=>{
  e.preventDefault();
  const id=document.getElementById('staffId').value;
  const username=document.getElementById('staffUsername').value.trim().toLowerCase().replace(/[^a-z0-9._-]/g,'');
  if(!username){showToast('Tài khoản chỉ gồm chữ thường, số, dấu chấm/gạch.');return}
  if(data.staffUsers.some(u=>u.id!==id&&u.username===username&&!u.deleted)){showToast('Tài khoản này đã tồn tại.');return}
  const item={id:id||uid('su'),name:document.getElementById('staffName').value.trim(),username,
    role:document.getElementById('staffRole').value,
    propertyIds:[...document.querySelectorAll('#staffProps input:checked')].map(x=>x.value),
    active:id?data.staffUsers.find(x=>x.id===id).active:true,
    note:'',createdAt:id?data.staffUsers.find(x=>x.id===id).createdAt:new Date().toISOString()};
  if(id)Object.assign(data.staffUsers.find(x=>x.id===id),item);else data.staffUsers.push(item);
  auditLocal(id?'update':'create','staffUsers',item.id,null,{role:item.role,active:item.active});
  saveData();closeModal('staffModal');renderSettings();
  showToast(id?'Đã cập nhật nhân viên':'Đã thêm nhân viên — bấm "Mật khẩu" để cấp mật khẩu đăng nhập');
});
window.toggleStaff=function(id){
  const u=data.staffUsers.find(x=>x.id===id);if(!u)return;
  u.active=!u.active;auditLocal('update','staffUsers',id,{active:!u.active},{active:u.active});
  saveData();renderSettings();showToast(u.active?'Đã mở khóa tài khoản':'Đã khóa tài khoản — nhân viên không đăng nhập được nữa');
}
window.resetStaffPass=async function(id){
  const u=data.staffUsers.find(x=>x.id===id);if(!u)return;
  if(!Sync.isOn()){showToast('Cần kết nối máy chủ để cấp mật khẩu nhân viên.');return}
  if(Sync.hasPending&&Sync.hasPending()){showToast('Đang có thay đổi chưa đồng bộ — chờ đồng bộ xong rồi cấp mật khẩu.');return}
  if(!confirm(`Cấp mật khẩu mới cho ${u.name} (${u.username})? Mật khẩu cũ sẽ hết hiệu lực.`))return;
  try{
    const res=await Sync.setStaffPass(id,'');
    alert(`Mật khẩu của ${res.username}: ${res.password}

Chỉ hiển thị MỘT LẦN — gửi ngay cho nhân viên và nhắc họ không chia sẻ.`);
  }catch(err){showToast('Chưa cấp được mật khẩu: '+(err.message||err))}
}
/* ---------- v6: NHẬT KÝ THAO TÁC ---------- */
function auditCardHtml(){
  const st=ui('audit');const q=(st.q||'').toLowerCase();
  let list=[...(data.auditLog||[])].sort((a,b)=>String(b.at).localeCompare(String(a.at)));
  if(q)list=list.filter(x=>[x.actor,x.action,x.col,x.recordId].join(' ').toLowerCase().includes(q));
  list=list.slice(0,100);
  const COL_VI={invoices:'Hóa đơn',payments:'Sổ thu',depositLedger:'Sổ cọc',leases:'Hợp đồng',rooms:'Phòng',tenants:'Người thuê',utilityReadings:'Chỉ số',serviceDefinitions:'Dịch vụ',staffUsers:'Nhân sự',settings:'Cài đặt'};
  const ACT_VI={create:'Tạo',update:'Sửa',delete:'Xóa',login:'Đăng nhập',setPass:'Cấp mật khẩu'};
  const diffHtml=x=>{
    if(!x.before&&!x.after)return'';
    const keys=[...new Set([...Object.keys(x.before||{}),...Object.keys(x.after||{})])];
    return `<div class="audit-diff">${keys.map(k=>{
      const b=x.before?.[k],a=x.after?.[k];
      if(JSON.stringify(b)===JSON.stringify(a))return'';
      return `<span><em>${esc(k)}</em>: ${b===undefined?'—':esc(String(b))} → <strong>${a===undefined?'—':esc(String(a))}</strong></span>`;
    }).filter(Boolean).join('')}</div>`;
  };
  return `<div class="settings-card" style="grid-column:1/-1"><h3>${icon('book',17)} Nhật ký thao tác</h3>
  <p>Ai làm gì, lúc nào, trên bản ghi nào — dữ liệu quan trọng có trước/sau. Máy chủ tự ghi khi online; bản chạy máy ghi tạm tại đây.</p>
  <div class="table-tools"><span class="tt-search">${icon('search',15)}<input value="${esc(st.q||'')}" placeholder="Lọc theo người, hành động, bảng…" aria-label="Lọc nhật ký" oninput="setUi('audit',{q:this.value});renderSettings()"></span></div>
  ${list.length?list.map(x=>`<div class="audit-row"><div class="audit-main"><strong>${esc(x.actor)} · ${ACT_VI[x.action]||esc(x.action)} ${COL_VI[x.col]||esc(x.col)}</strong><small>${esc(String(x.at).replace('T',' ').slice(0,19))}${x.recordId?' · '+esc(x.recordId):''} · vai trò ${ROLE_LABEL[x.role]||'Không xác định'}</small>${diffHtml(x)}</div></div>`).join('')
  :emptyState('book','Chưa có nhật ký','Nhật ký sẽ tự xuất hiện khi có thao tác lên dữ liệu quan trọng (hóa đơn, sổ thu, hợp đồng, phòng…).','')}
  </div>`;
}
window.saveManagerSettings=function(){
  data.settings.brandName=document.getElementById('setBrandName').value.trim()||'Huy Rooms';
  data.settings.managerName=document.getElementById('setManagerName').value.trim();
  data.settings.managerPhone=document.getElementById('setManagerPhone').value.trim();
  data.settings.defaultDueDay=Number(document.getElementById('setDueDay').value||5);
  data.settings.workStart=document.getElementById('setWorkStart').value||'08:00';
  data.settings.workEnd=document.getElementById('setWorkEnd').value||'20:00';
  data.settings.zaloPhone=document.getElementById('setZaloPhone').value.replace(/\D/g,'');
  data.settings.bankCode=document.getElementById('setBankCode').value.trim().toUpperCase();
  data.settings.bankAccount=document.getElementById('setBankAccount').value.replace(/\D/g,'');
  data.settings.bankAccountName=document.getElementById('setBankName').value.trim().toUpperCase();
  saveData();renderAdmin();applyBranding();showToast('Đã lưu thông tin quản lý');
}
window.logoutThisDevice=async function(){
  if(!confirm('Đăng xuất quyền quản lý trên thiết bị này?'))return;
  await Sync.logoutDevice();showPublic();showToast('Đã đăng xuất thiết bị này');
}
window.logoutAllDevices=async function(){
  if(!confirm('Đăng xuất TẤT CẢ thiết bị đang có quyền quản lý? Mọi thiết bị (kể cả máy này) sẽ phải đăng nhập lại.'))return;
  try{await Sync.logoutAll();showPublic();showToast('Đã đăng xuất tất cả thiết bị')}
  catch(err){showToast('Chưa đăng xuất được: '+(err.message||err))}
}
window.connectSheets=async function(mode){
  const apiUrl=document.getElementById('cfgApiUrl').value.trim();
  const pass=document.getElementById('cfgWriteKey').value.trim();
  if(!apiUrl){showToast('Chưa nhập đường dẫn Apps Script');return}
  if(mode==='push'&&!confirm('Đẩy toàn bộ dữ liệu trên máy này lên Google Sheets? Dữ liệu trùng mã trên Sheets sẽ bị ghi đè.'))return;
  if(mode==='pull'&&!confirm('Lấy dữ liệu từ Google Sheets? Dữ liệu đang lưu trên máy này sẽ được thay bằng dữ liệu trên Sheets.'))return;
  const btn=document.getElementById(mode==='pull'?'connPullBtn':'connPushBtn');
  setBtnBusy(btn,true,'Đang kết nối…');
  try{
    Sync.saveCfg({apiUrl});
    if(pass)await Sync.adminLogin(pass);
    const res=await Sync.connect({apiUrl,mode});
    renderAdmin();renderPublic();
    showToast(res.mode==='pull'?'Đã lấy dữ liệu từ Google Sheets':'Đã đẩy dữ liệu lên Google Sheets');
  }catch(err){showToast('Kết nối lỗi: '+(err.message||err))}
  finally{setBtnBusy(btn,false)}
}
window.changeAdminPassword=async function(){
  const np=document.getElementById('cfgNewPass').value.trim();
  if(np.length<10){showToast('Mật khẩu cần ít nhất 10 ký tự (nên có cả chữ và số)');return}
  if(!(/[A-Za-z]/.test(np)&&/\d/.test(np))&&!confirm('Mật khẩu nên có cả chữ và số cho an toàn. Vẫn dùng mật khẩu này?'))return;
  const btn=document.getElementById('changePassBtn');setBtnBusy(btn,true,'Đang đổi…');
  try{
    await Sync.changePassword(np); // máy chủ vô hiệu hóa mọi token cũ và cấp token mới cho phiên này
    document.getElementById('cfgNewPass').value='';
    showToast('Đã đổi mật khẩu. Các thiết bị khác phải đăng nhập lại.');
    renderSettings();
  }catch(err){showToast('Không đổi được: '+(err.message||err))}
  finally{setBtnBusy(btn,false)}
}
window.forgetAdminKey=async function(){
  if(!confirm('Thoát quyền quản lý trên máy này? Dữ liệu quản trị (người thuê, hóa đơn, hợp đồng, sổ thu…) sẽ bị XÓA khỏi máy; chỉ giữ thông tin công khai về căn/phòng.'))return;
  try{if(Sync.isOn()&&Sync.cfg.token)await Sync.logoutDevice()}catch(e){}
  Sync.disconnect();
  purgeAdminData();       // v4.1: không để dữ liệu nhạy cảm nằm lại localStorage/memory
  showPublic();showToast('Đã thoát quyền quản lý và xóa dữ liệu quản trị khỏi máy này');
}
/** Xóa dữ liệu quản trị nhạy cảm sau logout — giữ đúng phần công khai của trang khách. */
function purgeAdminData(){
  const SENSITIVE=['tenants','invoices','leases','leaseOccupants','accounts','payments','depositLedger',
    'reminders','maintenanceTickets','notifications','staffUsers','auditLog','utilityReadings',
    'appointments','assets','handoverItems','serviceDefinitions','leaseServices'];
  SENSITIVE.forEach(k=>{data[k]=[]});
  data.rooms.forEach(r=>{r.note=''});
  try{localStorage.removeItem(AUTOBK_KEY)}catch(e){}          // bản tự lưu chứa dữ liệu quản trị
  try{localStorage.removeItem(UI_KEY)}catch(e){}
  try{localStorage.removeItem('huyrooms_admin_v3')}catch(e){}
  if(Sync.baseline)Sync.baseline={};
  if(Sync.baseStamp)Sync.baseStamp={};
  saveData();
}
window.exportData=function(name){const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});downloadBlob(blob,typeof name==='string'&&name?name:'huy-rooms-backup-v4.1.json')}
function validateImport(x){
  if(!x||typeof x!=='object'||Array.isArray(x))return{error:'File không đúng định dạng sao lưu Huy Rooms'};
  const cols=['properties','rooms','tenants','utilityReadings','invoices','appointments'];
  const counts=[];
  for(const c of cols){
    const arr=x[c];
    if(arr===undefined)continue;
    if(!Array.isArray(arr))return{error:'Trường "'+c+'" trong file phải là danh sách'};
    for(const it of arr){if(!it||typeof it!=='object'||!it.id)return{error:'Có bản ghi thiếu mã (id) trong "'+c+'"'}}
    counts.push(arr.length+' '+({properties:'căn trọ',rooms:'phòng',tenants:'người thuê',utilityReadings:'chỉ số điện nước',invoices:'hóa đơn',appointments:'lịch hẹn'})[c]);
  }
  if(!counts.length)return{error:'File không có dữ liệu nào để nhập'};
  return{summary:counts.join(', ')};
}
window.importData=function(){const f=document.getElementById('importFile')?.files?.[0];if(!f){showToast('Chọn file JSON trước.');return}
  const reader=new FileReader();
  reader.onload=()=>{
    let parsed;
    try{parsed=JSON.parse(reader.result)}catch(e){showToast('File dữ liệu không hợp lệ (không đọc được JSON)');return}
    const check=validateImport(parsed);
    if(check.error){showToast('Không nhập được: '+check.error);return}
    if(!confirm('Sẽ nhập: '+check.summary+'.\nDữ liệu hiện tại sẽ được tải về máy làm bản sao lưu trước khi thay thế. Tiếp tục?'))return;
    exportData('huy-rooms-truoc-khi-nhap-'+today()+'.json'); // sao lưu trước khi áp dụng
    data=migrateData(parsed);saveData();renderAdmin();renderPublic();showToast('Đã khôi phục dữ liệu từ file');
  };
  reader.readAsText(f)}
window.exportRoomsCSV=function(){const header=['Can tro','Dia chi','Phong','Loai','Dien tich','Gia thang','Tien coc','Trang thai','Gia dien','Cach tinh nuoc','Gia nuoc','Nuoc co dinh'];const rows=data.rooms.map(r=>{const p=getProperty(r.propertyId);return[p?.name||'',p?.address||'',r.name,r.type,r.area,r.price,r.deposit,statusLabel(r.status),r.electricRate,r.waterMode,r.waterRate,r.waterFixed]});const csv='\ufeff'+[header,...rows].map(row=>row.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(',')).join('\n');downloadBlob(new Blob([csv],{type:'text/csv;charset=utf-8'}),'danh-sach-phong.csv')}
function downloadBlob(blob,name){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
window.resetDemo=function(){
  if(!DEMO_MODE){showToast('Chức năng dữ liệu mẫu đã tắt trên bản dùng thật.');return}
  if(!confirm('Khôi phục dữ liệu mẫu và xóa các thay đổi nghiệp vụ hiện tại?'))return;
  data=migrateData(structuredClone(demoData));saveData();renderAdmin();renderPublic();showToast('Đã khôi phục dữ liệu mẫu')}

// ---------- Form handlers ----------
document.querySelectorAll('[data-close-modal]').forEach(el=>el.addEventListener('click',()=>closeModal(el.dataset.closeModal)));
document.getElementById('bookingForm').addEventListener('submit',async e=>{e.preventDefault();
  const btn=document.getElementById('bookingSubmit');
  const payload={
    roomId:document.getElementById('bookingRoomId').value,
    customerName:document.getElementById('customerName').value.trim().replace(/\s+/g,' '),
    customerPhone:document.getElementById('customerPhone').value.trim(),
    date:document.getElementById('appointmentDate').value,
    time:document.getElementById('appointmentTime').value,
    note:document.getElementById('customerNote').value.trim().slice(0,500),
    website:document.getElementById('bookingWebsite')?.value||'',
    consent:document.getElementById('bookingConsent')?.checked?1:0,
    source:'website'
  };
  if(!payload.consent){showToast('Vui lòng tích đồng ý với chính sách bảo mật trước khi gửi.');return}
  if(payload.customerName.length<2||payload.customerName.length>80){showToast('Vui lòng nhập họ tên (2–80 ký tự).');return}
  const phone=normalizePhone(payload.customerPhone);
  if(!/^0\d{9}$/.test(phone)&&!/^84\d{9}$/.test(phone)){showToast('Số điện thoại chưa đúng. Ví dụ: 0905123456');return}
  if(!payload.date||payload.date<today()){showToast('Ngày xem phòng không được ở quá khứ.');return}
  if(Sync.isOn()){
    setBtnBusy(btn,true,'Đang gửi…');
    try{
      await Sync.book(payload);
      e.target.reset();closeModal('bookingModal');
      showToast('Đã gửi yêu cầu. Quản lý sẽ liên hệ xác nhận.');
    }catch(err){
      // Giữ nguyên form để khách sửa lại, không đóng khi chưa gửi thành công
      showToast('Chưa gửi được lịch hẹn: '+(err.message||err));
    }finally{setBtnBusy(btn,false)}
    return;
  }
  // Bản chạy hoàn toàn trên máy (không máy chủ)
  const alive=a=>!['cancelled','lost'].includes(a.status);
  const dup=data.appointments.some(a=>alive(a)&&a.roomId===payload.roomId&&normalizePhone(a.customerPhone)===phone&&a.date===payload.date&&a.time===payload.time);
  if(dup){showToast('Bạn đã đặt đúng khung giờ này rồi. Quản lý sẽ sớm liên hệ xác nhận.');return}
  const clash=data.appointments.some(a=>alive(a)&&a.roomId===payload.roomId&&a.date===payload.date&&a.time===payload.time);
  if(clash){showToast('Khung giờ này đã có khách khác hẹn xem. Vui lòng chọn giờ khác.');refreshBookingSlots();return}
  data.appointments.unshift({id:uid('a'),roomId:payload.roomId,customerName:payload.customerName,customerPhone:phone,date:payload.date,time:payload.time,note:payload.note,status:'new',createdAt:new Date().toISOString(),source:'website',careLog:[],reserveAmount:0,reserveUntil:'',convertedLeaseId:''});
  saveData();e.target.reset();closeModal('bookingModal');renderAdmin();
  showToast('Đã gửi yêu cầu. Quản lý sẽ liên hệ xác nhận.')});

document.getElementById('propertyImages').addEventListener('change',e=>{propertyImageState.newFiles.push(...[...e.target.files]);renderImageEditor('property')});
document.getElementById('roomImages').addEventListener('change',e=>{roomImageState.newFiles.push(...[...e.target.files]);renderImageEditor('room')});
document.getElementById('propertyForm').addEventListener('submit',async e=>{e.preventDefault();const btn=document.getElementById('propertySubmit');setBtnBusy(btn,true,'Đang lưu…');let imageIds;const id=document.getElementById('propertyId').value;try{imageIds=await commitImageState(propertyImageState,'property',id||'')}catch(err){setBtnBusy(btn,false);showToast('Chưa lưu được ảnh căn trọ: '+(err.message||err));return}setBtnBusy(btn,false);const item={id:id||uid('p'),name:document.getElementById('propertyName').value.trim(),area:document.getElementById('propertyArea').value.trim(),address:document.getElementById('propertyAddress').value.trim(),description:document.getElementById('propertyDescription').value.trim(),phone:document.getElementById('propertyPhone').value.trim(),imageIds};
{let slug=slugifyVN(document.getElementById('propertySlug')?.value)||slugifyVN(item.name)||('can-'+item.id);
 let base=slug,n=1;while(data.properties.some(p0=>p0.id!==item.id&&p0.slug===slug)||data.rooms.some(r0=>r0.slug===slug))slug=base+'-'+(++n);
 item.slug=slug}if(id)Object.assign(getProperty(id),item);else data.properties.push(item);saveData();closeModal('propertyModal');renderAdmin();renderPublic();showToast(id?'Đã cập nhật căn trọ và ảnh':'Đã thêm căn trọ')});
document.getElementById('roomForm').addEventListener('submit',async e=>{e.preventDefault();const btn=document.getElementById('roomSubmit');setBtnBusy(btn,true,'Đang lưu…');let imageIds;const id=document.getElementById('roomId').value;try{imageIds=await commitImageState(roomImageState,'room',id||'')}catch(err){setBtnBusy(btn,false);showToast('Chưa lưu được ảnh phòng: '+(err.message||err));return}setBtnBusy(btn,false);const item={id:id||uid('r'),propertyId:document.getElementById('roomProperty').value,name:document.getElementById('roomName').value.trim(),price:Number(document.getElementById('roomPrice').value||0),deposit:Number(document.getElementById('roomDeposit').value||0),area:Number(document.getElementById('roomArea').value||0),capacity:Number(document.getElementById('roomCapacity').value||1),type:document.getElementById('roomType').value,status:document.getElementById('roomStatus').value,electricRate:Number(document.getElementById('roomElectricRate').value||0),waterMode:document.getElementById('roomWaterMode').value,waterRate:Number(document.getElementById('roomWaterRate').value||0),waterFixed:Number(document.getElementById('roomWaterFixed').value||0),amenities:document.getElementById('roomAmenities').value.split(',').map(x=>x.trim()).filter(Boolean),note:document.getElementById('roomNote').value.trim(),imageIds,
availableFrom:document.getElementById('roomAvailableFrom').value||'',
policies:document.getElementById('roomPolicies').value.trim()};
{let slug=slugifyVN(document.getElementById('roomSlug').value)||slugifyVN((getProperty(item.propertyId)?.name||'')+' '+item.name)||('phong-'+item.id);
 let base=slug,n=1;while(data.rooms.some(r0=>r0.id!==item.id&&r0.slug===slug)||data.properties.some(p0=>p0.slug===slug))slug=base+'-'+(++n);
 item.slug=slug}
if(id)Object.assign(getRoom(id),item);else data.rooms.push(item);if(item.status!=='maintenance')reconcileRoomStatus(item.id);saveData();closeModal('roomModal');renderAdmin();renderPublic();showToast(id?'Đã cập nhật phòng và ảnh':'Đã thêm phòng')});
document.getElementById('tenantRoom').addEventListener('change',()=>{const r=getRoom(document.getElementById('tenantRoom').value);if(!document.getElementById('tenantId').value)document.getElementById('tenantDepositRequired').value=r?.deposit||0});
document.getElementById('tenantForm').addEventListener('submit',async e=>{
  e.preventDefault();
  const btn=document.getElementById('tenantSubmit');
  const id=document.getElementById('tenantId').value,roomId=document.getElementById('tenantRoom').value;
  const name=document.getElementById('tenantName').value.trim();
  if(name.length<2){showToast('Họ tên cần ít nhất 2 ký tự');return}
  const phone=normalizePhone(document.getElementById('tenantPhone').value);
  if(!/^0\d{9}$/.test(phone)){showToast('Số điện thoại chưa đúng (10 số, bắt đầu bằng 0)');return}
  const active=document.getElementById('tenantActive').value==='true';
  const existingActive=activeTenantForRoom(roomId);
  if(existingActive&&existingActive.id!==id&&active){showToast('Phòng này đang có người thuê hoạt động. Hãy kết thúc người thuê cũ trước.');return}
  const prev=id?getTenant(id):null;
  const oldRoomId=prev?.roomId;
  const wasActive=prev?prev.active:false;
  const item={id:id||uid('t'),name,phone,roomId,
    moveInDate:document.getElementById('tenantMoveIn').value,
    active,
    moveOutDate:active?'':(prev?.moveOutDate||today()),
    depositRequired:Number(document.getElementById('tenantDepositRequired').value||0),
    depositPaid:Number(document.getElementById('tenantDepositPaid').value||0),
    note:document.getElementById('tenantNote').value.trim()};
  if(prev&&wasActive&&!active&&!item.moveOutDate)item.moveOutDate=today();
  if(id)Object.assign(getTenant(id),item);else data.tenants.push(item);
  // Đồng bộ hợp đồng đang gắn với người này (form người thuê là lối tắt của nghiệp vụ hợp đồng)
  const lease0=leaseForOccupant(item.id);
  if(lease0&&liveLease(lease0)&&lease0.primaryTenantId===item.id){
    lease0.depositRequired=item.depositRequired;lease0.depositPaid=item.depositPaid;
    if(!active){
      lease0.status='ended';lease0.moveOutAt=item.moveOutDate||today();
      leaseOccupantsOf(lease0.id).forEach(lo=>{lo.leftAt=lease0.moveOutAt});
    }else if(lease0.roomId!==roomId){
      // Chuyển phòng nhanh qua form người thuê: hiệu lực hôm nay, giữ lịch sử phòng cũ trên hợp đồng
      const lastFrom=lease0.roomHistory.length?lease0.roomHistory[lease0.roomHistory.length-1].to:(lease0.moveInAt||lease0.startDate||'');
      lease0.roomHistory.push({roomId:lease0.roomId,from:lastFrom,to:today()});
      lease0.roomId=roomId;lease0.propertyId=getRoom(roomId)?.propertyId||lease0.propertyId;
      leaseOccupantsOf(lease0.id).forEach(lo=>{const o=getTenant(lo.occupantId);if(o&&o.id!==item.id)o.roomId=roomId});
    }
  }
  // Người thuê hoạt động luôn có hợp đồng tương ứng (giá thuê chốt tại thời điểm tạo)
  if(item.active)ensureLeaseForTenant(getTenant(item.id));
  // Tính lại trạng thái cả phòng cũ lẫn phòng mới (khi chuyển phòng / trả phòng)
  reconcileRoomStatus(roomId);
  if(oldRoomId&&oldRoomId!==roomId)reconcileRoomStatus(oldRoomId);
  saveData();
  if(!id){
    // Người thuê mới: tạo mã PIN 6 số, chỉ hiển thị một lần
    if(Sync.isOn()&&Sync.isAdmin()){
      setBtnBusy(btn,true,'Đang tạo mã PIN…');
      try{
        await Sync.cycle(); // đẩy người thuê mới lên máy chủ trước
        let res;
        try{res=await Sync.setTenantPin(item.id)}
        catch(err1){await new Promise(r2=>setTimeout(r2,1500));await Sync.cycle();res=await Sync.setTenantPin(item.id)}
        const t2=getTenant(item.id);if(t2)t2.hasPin=true;saveLocal();
        setBtnBusy(btn,false);
        closeModal('tenantModal');renderAdmin();renderPublic();
        showPinModal(item,res.pin);
        return;
      }catch(err){
        setBtnBusy(btn,false);
        closeModal('tenantModal');renderAdmin();renderPublic();
        showToast('Đã lưu người thuê nhưng chưa tạo được PIN: '+(err.message||err)+'. Hãy bấm "Đặt lại PIN" trong danh sách.');
        return;
      }
    }
    // Bản chạy hoàn toàn trên máy: PIN lưu cục bộ
    const pin=String(Math.floor(100000+Math.random()*900000));
    const t3=getTenant(item.id);if(t3)t3.pin=pin;saveData();
    closeModal('tenantModal');renderAdmin();renderPublic();
    showPinModal(item,pin);
    return;
  }
  closeModal('tenantModal');renderAdmin();renderPublic();
  showToast('Đã cập nhật người thuê');
});
['utilityRoom','utilityMonth'].forEach(id=>document.getElementById(id).addEventListener('change',()=>smartPrefillUtility(true)));
['electricStart','electricEnd','electricRate','waterMode','waterStart','waterEnd','waterRate','waterFixed'].forEach(id=>document.getElementById(id).addEventListener('input',calcUtilityFromForm));
document.getElementById('waterMode').addEventListener('change',calcUtilityFromForm);
document.getElementById('utilityForm').addEventListener('submit',e=>{e.preventDefault();const id=document.getElementById('utilityId').value,roomId=document.getElementById('utilityRoom').value,month=document.getElementById('utilityMonth').value;const es=Number(document.getElementById('electricStart').value||0),ee=Number(document.getElementById('electricEnd').value||0),ws=Number(document.getElementById('waterStart').value||0),we=Number(document.getElementById('waterEnd').value||0),wm=document.getElementById('waterMode').value;if(ee<es){showToast('Chỉ số điện cuối kỳ phải lớn hơn hoặc bằng đầu kỳ.');return}if(wm==='meter'&&we<ws){showToast('Chỉ số nước cuối kỳ phải lớn hơn hoặc bằng đầu kỳ.');return}const calc=calcUtilityFromForm();
  // Mỗi phòng + tháng chỉ có đúng 1 bản ghi
  const existingSame=data.utilityReadings.find(u=>u.roomId===roomId&&u.month===month&&u.id!==id);
  if(existingSame){loadReadingIntoForm(existingSame);showToast('Phòng này đã có chỉ số trong tháng — đã mở bản ghi đó để sửa, không tạo bản thứ hai.');return}
  if(id&&readingLockedByPaidInvoice(id)&&!confirm('Chỉ số này gắn với hóa đơn ĐÃ THANH TOÁN. Xác nhận lưu thay đổi?'))return;const item={id:id||uid('u'),roomId,month,electricStart:es,electricEnd:ee,electricRate:Number(document.getElementById('electricRate').value||0),electricUnits:calc.electricUnits,electricAmount:calc.electricAmount,waterMode:wm,waterStart:ws,waterEnd:we,waterRate:Number(document.getElementById('waterRate').value||0),waterFixed:Number(document.getElementById('waterFixed').value||0),waterUnits:calc.waterUnits,waterAmount:calc.waterAmount,otherFee:Number(document.getElementById('utilityOtherFee').value||0),note:document.getElementById('utilityNote').value.trim(),createdAt:new Date().toISOString()};if(id)Object.assign(getReading(id),item);else data.utilityReadings.push(item);saveData();closeModal('utilityModal');renderAdmin();showToast(`Đã lưu: điện ${money(item.electricAmount)}, nước ${money(item.waterAmount)}`)});
['invoiceRent','invoiceElectric','invoiceWater','invoiceOther','invoiceIncludeDeposit'].forEach(id=>document.getElementById(id).addEventListener('input',calcInvoicePreview));document.getElementById('invoiceIncludeDeposit').addEventListener('change',calcInvoicePreview);
document.getElementById('invoiceRoom').addEventListener('change',refreshInvoiceForm);
document.getElementById('invoiceMonth').addEventListener('change',refreshInvoiceForm);
document.getElementById('invoiceForm').addEventListener('submit',e=>{e.preventDefault();
  const roomId=document.getElementById('invoiceRoom').value,month=document.getElementById('invoiceMonth').value,t=activeTenantForRoom(roomId);
  if(!t){showToast('Phòng chưa có người thuê đang hoạt động.');return}
  const calc=calcInvoicePreview();
  // Hóa đơn duy nhất theo người thuê + phòng + tháng: không ghi đè hóa đơn của người thuê cũ
  let item=data.invoices.find(i=>i.tenantId===t.id&&i.roomId===roomId&&i.month===month);
  if(item&&item.status==='paid'&&!confirm('Hóa đơn này đã thanh toán. Bạn vẫn muốn cập nhật lại?'))return;
  const values={tenantId:t.id,roomId,leaseId:document.getElementById('invoiceLeaseId').value||activeLeaseForRoom(roomId)?.id||'',readingId:document.getElementById('invoiceReadingId').value||'',month,
    dueDate:document.getElementById('invoiceDueDate').value,
    rent:Number(document.getElementById('invoiceRent').value||0),
    electric:Number(document.getElementById('invoiceElectric').value||0),
    water:Number(document.getElementById('invoiceWater').value||0),
    other:Number(document.getElementById('invoiceOther').value||0),
    depositAmount:calc.depositAmount,total:calc.total,
    createdAt:item?.createdAt||new Date().toISOString()};
  if(item){
    const wasApplied=!!item.depositApplied,oldDeposit=Number(item.depositAmount||0);
    Object.assign(item,values);
    item.amountPaid=Math.min(item.amountPaid||0,item.total);
    item.status=item.amountPaid>=item.total&&item.total>0?'paid':item.amountPaid>0?'partial':'unpaid';
    // Giữ nhất quán tiền cọc: hóa đơn chưa thanh toán đủ thì không được coi là đã áp cọc
    if(wasApplied&&item.status!=='paid'){
      const t2=getTenant(item.tenantId);
      if(t2)t2.depositPaid=Math.max(0,t2.depositPaid-oldDeposit);
      item.depositApplied=false;
    }
  }else{
    item={id:uid('i'),...values,amountPaid:0,status:'unpaid',depositApplied:false,payments:[],
      code:genInvoiceCode(month,getRoom(roomId)),serviceLines:[],adjustAmount:0,adjustNote:'',issuedAt:new Date().toISOString()};
    data.invoices.push(item);
    notifyTenant(item.tenantId,'invoice_new','Hóa đơn tháng '+month,'Hóa đơn '+(item.code||'')+' đã phát hành: '+money(item.total)+', hạn '+(item.dueDate||'')+'.',item.id);
  }
  saveData();closeModal('invoiceModal');renderAdmin();
  if(!residentSession&&currentResidentId===t.id)renderResident();
  showToast('Đã tạo/cập nhật hóa đơn')});

// Drag & drop ảnh
document.querySelectorAll('.upload-zone').forEach(zone=>{const input=zone.querySelector('input[type=file]');['dragenter','dragover'].forEach(evt=>zone.addEventListener(evt,e=>{e.preventDefault();zone.style.borderColor='#B58A52'}));['dragleave','drop'].forEach(evt=>zone.addEventListener(evt,e=>{e.preventDefault();zone.style.borderColor=''}));zone.addEventListener('drop',e=>{const files=[...e.dataTransfer.files].filter(f=>f.type.startsWith('image/'));if(!files.length)return;if(input.id==='propertyImages')propertyImageState.newFiles.push(...files);else roomImageState.newFiles.push(...files);renderImageEditor(input.id==='propertyImages'?'property':'room')})});

// ---------- Login events ----------
['adminBtn'].forEach(id=>document.getElementById(id).addEventListener('click',()=>openModal('loginModal')));
['residentBtn','heroResidentBtn'].forEach(id=>document.getElementById(id).addEventListener('click',()=>openModal('residentLoginModal')));
document.getElementById('loginForm').addEventListener('submit',async e=>{
  e.preventDefault();
  const field=document.getElementById('adminPassword'),value=field.value.trim();
  if(Sync.isOn()){
    showToast('Đang kiểm tra mật khẩu…');
    try{
      const user=document.getElementById('adminUser')?.value.trim()||'';
      const res=await Sync.adminLogin(value,user);
      field.value='';closeModal('loginModal');showAdmin();
      if(res.staff&&res.staff.role!=='owner')showToast(`Xin chào ${res.staff.name} — vai trò ${({manager:'Quản lý',accountant:'Kế toán',staff:'Nhân viên'})[res.staff.role]||res.staff.role}`);
      await Sync.fullPull();renderAdmin();renderPublic();
      showToast(res.mustChangePassword?'Đã vào quản lý — nên đổi mật khẩu trong Cài đặt':'Đã mở quyền quản lý trên máy này');
    }catch(err){showToast(err.message||'Mật khẩu chưa đúng')}
    return;
  }
  if(value===ADMIN_PASSWORD){field.value='';closeModal('loginModal');showAdmin()}
  else showToast('Mật khẩu chưa đúng. Bản chưa kết nối dùng: 123456')});
document.getElementById('residentLoginForm').addEventListener('submit',async e=>{
  e.preventDefault();
  const btn=e.target.querySelector('button[type=submit]');
  const phone=normalizePhone(document.getElementById('residentPhone').value),pin=document.getElementById('residentPin').value.trim();
  if(Sync.isOn()){
    // Khi có máy chủ: LUÔN xác thực qua API, không tin dữ liệu trên máy
    setBtnBusy(btn,true,'Đang kiểm tra…');
    try{
      const res=await Sync.residentLogin(phone,pin);
      // Phiên cư dân tách riêng, chỉ chứa dữ liệu máy chủ trả cho đúng cư dân này
      saveResidentSession({tenant:res.tenant,room:res.room,property:res.property,
        lease:res.lease||null,coOccupants:res.coOccupants||[],
        invoices:res.invoices||[],readings:res.readings||[],payments:res.payments||[],
        tickets:res.tickets||[],notifications:res.notifications||[],
        handoverItems:res.handoverItems||[],assets:res.assets||[],depositLedger:res.depositLedger||[],
        settings:res.settings||{},phone,sessionKey:res.sessionKey||'',ts:Date.now()});
      closeModal('residentLoginModal');e.target.reset();showResident();
    }catch(err){showToast(err.message||'Số điện thoại hoặc mã PIN không đúng.')}
    finally{setBtnBusy(btn,false)}
    return;
  }
  // Bản chạy hoàn toàn trên máy (không máy chủ)
  const acc=data.accounts.find(a=>a.active&&String(a.phone||'').replace(/\D/g,'')===phone&&a.pin&&String(a.pin)===pin);
  const local=acc?getTenant(acc.occupantId):data.tenants.find(x=>normalizePhone(x.phone)===phone&&x.pin&&String(x.pin)===pin&&x.active);
  if(local&&local.active){closeModal('residentLoginModal');e.target.reset();showResident(local.id);return}
  showToast('Số điện thoại hoặc mã PIN không đúng.')});
window.clearResidentDevice=function(){
  // Xóa dữ liệu cư dân đã lưu trên thiết bị này; KHÔNG đụng gì tới dữ liệu trên máy chủ
  saveResidentSession(null);currentResidentId=null;
  showPublic();showToast('Đã xóa dữ liệu cư dân trên thiết bị này');
}
document.getElementById('residentLogout').addEventListener('click',()=>{
  // Đăng xuất chỉ xóa phiên cư dân trên thiết bị, không xóa người thuê trong dữ liệu quản trị
  saveResidentSession(null);currentResidentId=null;showPublic();
});document.getElementById('backPublic').addEventListener('click',showPublic);
document.getElementById('quickAddProperty').addEventListener('click',()=>openPropertyForm());document.getElementById('quickAddRoom').addEventListener('click',()=>openRoomForm());document.getElementById('quickAddTenant').addEventListener('click',()=>openTenantForm());

// ---------- Public filters ----------
['searchInput','areaFilter','statusFilter','priceFilter','typeFilter','minAreaFilter','capacityFilter','moveInFilter'].forEach(id=>{const el=document.getElementById(id);if(!el)return;el.addEventListener(id==='searchInput'?'input':'change',()=>{
  publicFilters.q=document.getElementById('searchInput').value;
  publicFilters.area=document.getElementById('areaFilter').value;
  publicFilters.status=document.getElementById('statusFilter').value;
  publicFilters.maxPrice=Number(document.getElementById('priceFilter').value);
  publicFilters.type=document.getElementById('typeFilter')?.value||'all';
  publicFilters.minArea=Number(document.getElementById('minAreaFilter')?.value||0);
  publicFilters.capacity=Number(document.getElementById('capacityFilter')?.value||0);
  publicFilters.moveIn=document.getElementById('moveInFilter')?.value||'';
  renderPublic()})});

/* v6: bơm icon SVG vào các nút có data-ic + nối tìm nhanh */
function hydrateIcons(root){
  (root||document).querySelectorAll('[data-ic]').forEach(el=>{
    const name=el.getAttribute('data-ic');
    if(el.querySelector('svg'))return;
    el.insertAdjacentHTML('afterbegin',icon(name,el.classList.contains('side-link')?18:17));
  });
}
hydrateIcons();
document.getElementById('globalSearchBtn')?.addEventListener('click',openPalette);
document.getElementById('palInput')?.addEventListener('input',e=>{palSel=0;palIndex=buildPalIndex(e.target.value);renderPalette()});


/* ---------- Sao lưu tự động cục bộ (mỗi ngày 1 bản, giữ 7) ---------- */
const AUTOBK_KEY='huyrooms_autobackup_v1';
function autoBackupTick(){
  try{
    const ring=JSON.parse(localStorage.getItem(AUTOBK_KEY)||'[]');
    const todayStr=today();
    if(ring.some(b=>b.date===todayStr))return;
    ring.push({date:todayStr,at:new Date().toISOString(),json:JSON.stringify(data)});
    while(ring.length>7)ring.shift();
    localStorage.setItem(AUTOBK_KEY,JSON.stringify(ring));
  }catch(e){/* localStorage đầy → bỏ qua, người dùng vẫn có nút tải file */}
}
function autoBackups(){try{return JSON.parse(localStorage.getItem(AUTOBK_KEY)||'[]')}catch(e){return[]}}
window.restoreAutoBackup=function(dateStr){
  const b=autoBackups().find(x=>x.date===dateStr);if(!b)return;
  let parsed;try{parsed=JSON.parse(b.json)}catch(e){showToast('Bản sao lưu này bị hỏng.');return}
  const check=validateImport(parsed);
  if(check.error){showToast('Bản sao lưu không hợp lệ: '+check.error);return}
  if(!confirm(`Khôi phục dữ liệu về bản tự lưu ngày ${dateStr}?\nSẽ nhập: ${check.summary}.\nDữ liệu hiện tại được tải về máy trước khi thay.`))return;
  exportData('huy-rooms-truoc-khi-khoi-phuc-'+today()+'.json');
  data=migrateData(parsed);saveData();renderAdmin();renderPublic();
  showToast('Đã khôi phục về bản '+dateStr);
}
setInterval(autoBackupTick,10*60*1000);
setTimeout(autoBackupTick,20*1000);


/* ==================================================================
   HARDENING — event delegation: nút trong bảng dùng data-act/data-id,
   KHÔNG nhét ID từ Sheet vào chuỗi inline handler.
   ================================================================== */
const ACT_MAP={
  recordPayment:id=>recordPayment(id),
  payHistory:id=>openPayHistory(id),
  invoicePdf:id=>openInvoicePdf(id),
  reminder:id=>openReminder(id),
  deleteInvoice:id=>deleteInvoice(id),
  tenantEdit:id=>openTenantForm(id),
  tenantPin:id=>resetTenantPin(id),
  tenantDelete:id=>deleteTenant(id),
  leaseDetail:id=>openLeaseDetail(id),
  leadCare:id=>leadAddCare(id),
  leadReschedule:id=>leadReschedule(id),
  leadReserve:id=>leadReserve(id),
  leadConvert:id=>convertLeadToLease(id),
  leadRelease:id=>releaseExpiredHold(id),
  leadDelete:id=>deleteAppointment(id)
};
document.getElementById('adminApp')?.addEventListener('click',e=>{
  const btn=e.target.closest('[data-act]');
  if(!btn)return;
  const fn=ACT_MAP[btn.dataset.act];
  if(fn)fn(btn.dataset.id||'');
});
document.getElementById('adminApp')?.addEventListener('change',e=>{
  const el=e.target.closest('[data-chg]');
  if(!el)return;
  if(el.dataset.chg==='leadStatus')leadSetStatus(el.dataset.id,el.value);
  if(el.dataset.chg==='leadSource')leadSetSource(el.dataset.id,el.value);
});


/* ==================================================================
   v4.1 — DISPATCHER SỰ KIỆN CHUNG: handler động dùng data-call + data-aN,
   KHÔNG còn dữ liệu nội suy trong chuỗi JavaScript inline.
   Tên hàm nằm trong WHITELIST cố định; data-aN chỉ là THAM SỐ chuỗi.
   ================================================================== */
const CALL_WHITELIST=new Set(["archiveService", "attachMeterPhoto", "bulkAdjust", "cancelLease", "closeModal", "copyInvoiceText", "deleteAsset", "deleteNotice", "deleteProperty", "deleteReading", "deleteRoom", "doReverse", "editAsset", "endLeaseService", "makePrimary", "meterInput", "openBooking", "openCheckin", "openEndLease", "openGallery", "openInvoiceForm", "openInvoicePdf", "openLeaseDetail", "openLeaseForm", "openMeterPhotos", "openPropertyForm", "openReceiptPdf", "openReminder", "openRenewForm", "openResidentInvoice", "openResidentMeterPhotos", "openRoomAssets", "openRoomForm", "openServiceForm", "openStaffForm", "openTicketDetail", "openTransferForm", "openUtilityForm", "palRun", "quickRoomMoney", "quickRoomStatus", "recordPayment", "removeOccupant", "resetStaffPass", "restoreAutoBackup", "restoreProperty", "restoreRoom", "rsRemoveFile", "setResidentTab", "signLease", "ticketAction", "toggleAmenityFilter", "toggleStaff", "uiSet", "unlockReading"]);
function dispatchDataCall(el,evtType){
  const fn=el.dataset.call;
  if(!fn||!CALL_WHITELIST.has(fn))return;
  const f=window[fn]||((typeof globalThis!=='undefined')&&globalThis[fn]);
  if(typeof f!=='function')return;
  const args=[];
  for(let i=1;i<=6;i++){
    if(!(('a'+i) in el.dataset))break;
    let v=el.dataset['a'+i];
    if(v==='\x01V')v=el.value;
    else if(v==='\x01C')v=el.checked;
    else if(/^-?\d+$/.test(v))v=Number(v);
    args.push(v);
  }
  f(...args);
}
document.addEventListener('click',e=>{
  const el=e.target.closest('[data-call][data-evt="click"]');
  if(el)dispatchDataCall(el,'click');
});
document.addEventListener('change',e=>{
  const el=e.target.closest('[data-call][data-evt="change"]');
  if(el)dispatchDataCall(el,'change');
});
document.addEventListener('input',e=>{
  const el=e.target.closest('[data-call][data-evt="input"]');
  if(el)dispatchDataCall(el,'input');
});

window.addEventListener('role-verified',()=>{renderAdmin()});
if(Sync.verifyRole)setTimeout(()=>{Sync.verifyRole()},400);
window.addEventListener('server-conflict',e=>{
  const list=(e.detail||[]).slice(0,3).map(x=>`${x.collection} ${x.id}`).join(', ');
  showToast(`⚠ Máy chủ TỪ CHỐI ghi đè: ${list}${(e.detail||[]).length>3?'…':''} — bản ghi đã được thiết bị khác sửa trước. Bản máy chủ được giữ; xem lại rồi sửa tiếp nếu cần.`);
  (e.detail||[]).forEach(x=>auditLocalConflict({col:x.collection,colName:x.collection,id:x.id,local:{expectedUpdatedAt:x.expectedUpdatedAt},remote:x.serverRecord||{}}));
  renderAdmin();
});
window.addEventListener('sync-rejected',e=>{
  const list=(e.detail||[]).slice(0,3).map(x=>`${x.collection} ${x.id}: ${x.reason}`).join(' · ');
  showToast(`Máy chủ từ chối lưu: ${list}${(e.detail||[]).length>3?'…':''}. Dữ liệu được đồng bộ lại theo bản máy chủ.`);
});
window.addEventListener('sync-scope-skipped',e=>{
  showToast(`${(e.detail||[]).length} thay đổi bị bỏ qua vì thuộc căn bạn không được giao. Nhờ chủ nhà/quản lý căn đó xử lý.`);
});
window.addEventListener('sync-conflict',e=>{
  const list=(e.detail||[]).slice(0,4).map(x=>`${x.colName} ${x.id}`).join(', ');
  const more=(e.detail||[]).length>4?` và ${e.detail.length-4} bản ghi khác`:'';
  showToast(`⚠ XUNG ĐỘT DỮ LIỆU TÀI CHÍNH: ${list}${more} vừa được sửa trên thiết bị khác trong lúc máy này cũng sửa. Bản trên máy chủ được giữ; mở Nhật ký để đối chiếu trước khi thao tác tiếp.`);
  (e.detail||[]).forEach(x=>auditLocalConflict(x));
});
function auditLocalConflict(x){
  data.auditLog=Array.isArray(data.auditLog)?data.auditLog:[];
  data.auditLog.push({id:uid('au'),at:new Date().toISOString(),actor:'Hệ thống (máy này)',role:'system',
    action:'conflict',col:x.col,recordId:x.id,
    before:{may_nay:JSON.stringify(x.local).slice(0,300)},after:{may_chu:JSON.stringify(x.remote).slice(0,300)},note:'Hai thiết bị sửa cùng lúc'});
  if(data.auditLog.length>500)data.auditLog=data.auditLog.slice(-500);
}
window.addEventListener('sync-skipped',e=>{
  const COL_VI={rooms:'Phòng',leases:'Hợp đồng',tenants:'Người thuê',invoices:'Hóa đơn',payments:'Sổ thu',settings:'Cài đặt',properties:'Căn trọ',staffUsers:'Nhân sự'};
  const names=(e.detail||[]).map(c=>COL_VI[c]||c).join(', ');
  showToast(`Vai trò của bạn không được sửa: ${names}. Thay đổi đó KHÔNG được lưu lên máy chủ — nhờ chủ nhà/quản lý thao tác giúp.`);
});
window.addEventListener('hashchange',()=>{if(!document.getElementById('publicApp').classList.contains('hidden'))renderPublic()});
document.getElementById('resetFilters').addEventListener('click',()=>{publicFilters={q:'',area:'all',status:'all',maxPrice:999999999,minArea:0,type:'all',capacity:0,amenities:[],moveIn:''};document.getElementById('searchInput').value='';document.getElementById('statusFilter').value='all';document.getElementById('priceFilter').value='999999999';['typeFilter','minAreaFilter','capacityFilter','moveInFilter'].forEach(id=>{const el=document.getElementById(id);if(el)el.value=el.tagName==='SELECT'?(id==='typeFilter'?'all':'0'):''});renderPublic()});
document.getElementById('heroSearchBtn').addEventListener('click',()=>{publicFilters.area=document.getElementById('heroAreaFilter').value;publicFilters.maxPrice=Number(document.getElementById('heroPriceFilter').value);publicFilters.status='available';document.getElementById('statusFilter').value='available';document.getElementById('priceFilter').value=String(publicFilters.maxPrice);renderPublic();document.getElementById('properties').scrollIntoView({behavior:'smooth'})});

// ---------- Giao diện điện thoại ----------
function syncTabbar(){
  const active=document.querySelector('.side-link.active')?.dataset.view||'dashboard';
  document.querySelectorAll('.mobile-tabbar button[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===active));
  const moreBtn=document.getElementById('moreTabBtn');
  const newAppts=data.appointments.filter(a=>a.status==='new').length;
  if(moreBtn){
    moreBtn.classList.toggle('active',['leases','tenants','appointments','settings'].includes(active));
    moreBtn.querySelector('.tab-badge')?.remove();
    if(newAppts)moreBtn.insertAdjacentHTML('afterbegin',`<span class="tab-badge" aria-label="${newAppts} lịch hẹn mới">${newAppts}</span>`);
  }
  const badge=document.getElementById('moreApptBadge');
  if(badge){badge.textContent=newAppts?newAppts+' mới':'';badge.classList.toggle('hidden',!newAppts)}
}
document.querySelectorAll('.mobile-tabbar button[data-view]').forEach(b=>b.addEventListener('click',()=>switchAdminView(b.dataset.view)));
document.getElementById('moreTabBtn')?.addEventListener('click',()=>{syncTabbar();document.getElementById('moreSheet').classList.add('show')});
document.getElementById('moreSheet')?.addEventListener('click',e=>{
  const act=e.target.closest('button')?.dataset?.more;
  if(!act){if(e.target.id==='moreSheet')e.currentTarget.classList.remove('show');return}
  e.currentTarget.classList.remove('show');
  if(act==='public')showPublic();
  else if(act==='search')openPalette();
  else if(act!=='close')switchAdminView(act);
});
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
    hint.innerHTML='Nhập <strong>mật khẩu quản lý</strong>. Lần đầu là <strong>123456</strong> — vào Cài đặt đổi ngay (tối thiểu 10 ký tự, nên có cả chữ và số).';
    field.placeholder='Nhập mật khẩu quản lý';
    label.childNodes[0].nodeValue='Mật khẩu quản lý';
  }else{
    hint.innerHTML='Chưa kết nối Google Sheets — dùng mật khẩu <strong>123456</strong> để mở bản trên máy này.';
  }
}
Sync.attach({
  getData:()=>data,
  saveLocal:saveLocal,
  rerender:()=>{renderAdmin();renderPublic();if(currentResidentId&&!residentSession)renderResident()},
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
residentSession=loadResidentSession();
if(residentSession)showResident();
Sync.start();

if('serviceWorker' in navigator&&location.protocol==='https:'&&!Sync.embedded()){
  navigator.serviceWorker.register('sw.js').catch(()=>{});
}

window.rsRemoveFile=function(i){rsTicketFiles.splice(Number(i),1);renderRsTicketFiles()}
