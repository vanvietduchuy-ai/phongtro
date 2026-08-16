// v4.7.1 — Máy chủ từ chối bản ghi mới KHÔNG được xóa mất dữ liệu trên máy
const { JSDOM } = require('jsdom');
const fs = require('fs'); const vm = require('vm');
const path = process.argv[2] || '/home/claude/v47fix/';
let pass=0,fail=0;const ok=(c,m)=>{if(c)pass++;else{fail++;console.log('  FAIL:',m)}};

const html = fs.readFileSync(path+'index.html','utf8').replace(/<link[^>]*>/g,'').replace(/<script src="[^"]*"><\/script>/g,'');
const dom = new JSDOM(html,{url:'https://x.test/',runScripts:'outside-only',pretendToBeVisual:true});
const w = dom.window;
w.confirm=()=>true;w.alert=()=>{};w.prompt=()=>'';w.structuredClone=global.structuredClone;
w.indexedDB={open(){const r={};setTimeout(()=>{r.result={objectStoreNames:{contains:()=>true},transaction:()=>({objectStore:()=>({put(){},get(){const g={};setTimeout(()=>g.onsuccess&&g.onsuccess(),0);return g},delete(){}})})};r.onsuccess&&r.onsuccess()},0);return r}};
w.matchMedia=()=>({matches:false});w.scrollTo=()=>{};w.URL.createObjectURL=()=>'blob:x';

// Máy chủ GIẢ LẬP: từ chối mọi hợp đồng thứ 2 trên cùng phòng, trả "bản ghi rỗng đã xóa"
// (đúng cách máy chủ Supabase 4.7 đang làm)
let pushes=0, serverLeases={};
w.fetch=(u,o)=>{
  const req=JSON.parse(o.body);
  if(req.action!=='sync') return Promise.resolve({json:()=>Promise.resolve({ok:true,role:'admin',serverTime:Date.now(),changes:{}})});
  pushes++;
  const rejected=[];
  (req.changes?.leases||[]).forEach(l=>{
    if(l.deleted) return;
    const clash=Object.values(serverLeases).find(x=>x.roomId===l.roomId&&x.id!==l.id&&['draft','active','ending'].includes(x.status));
    if(clash&&['draft','active','ending'].includes(l.status)){
      rejected.push({collection:'leases',id:l.id,reason:'Phòng đã có hợp đồng đang mở khác',
        serverRecord:{id:l.id,deleted:true,updatedAt:Date.now()}});   // ← tombstone GIẢ
    }else serverLeases[l.id]={...l};
  });
  return Promise.resolve({json:()=>Promise.resolve({ok:true,role:'admin',serverTime:Date.now(),changes:{},
    rejected:rejected.length?rejected:undefined})});
};
const ctx=dom.getInternalVMContext();
vm.runInContext("window.HUY_CONFIG={apiUrl:'/api/sheets'};",ctx);
for(const f of ['config.js','sync.js','realtime.js','p2.js','app.js']){
  try{vm.runInContext(fs.readFileSync(path+f,'utf8'),ctx)}catch(e){}
}
const run=c=>vm.runInContext(c,ctx);

(async()=>{
  run(`Sync.saveCfg({apiUrl:'/api/sheets',token:'tok'});
data=migrateData({properties:[{id:'p1',name:'Daily Home',area:'ĐN',address:'28/1',imageIds:[],slug:'dh'}],
rooms:[{id:'dh101',propertyId:'p1',name:'P101',price:3800000,deposit:1000000,status:'occupied',type:'Phòng trọ',amenities:[],imageIds:[],slug:'p101',waterMode:'fixed'}],
tenants:[{id:'t1',name:'Trần Huy Hoàng',phone:'0394501334',roomId:'dh101',active:true,depositRequired:1000000,depositPaid:1000000,moveInDate:'2026-08-01'},
{id:'t2',name:'Chưa có',phone:'',roomId:'dh101',active:true,depositRequired:3000000,depositPaid:1000000,moveInDate:''}],
utilityReadings:[],invoices:[],appointments:[],settings:{}});
data=migrateData(data);saveData();`);

  const before=run(`data.leases.length`);
  ok(before>=2,`0. Sau khi nhập có ${before} hợp đồng (ứng dụng tự tạo cho người thuê chưa có HĐ)`);
  const openSameRoom=run(`data.leases.filter(l=>l.roomId==='dh101'&&['draft','active','ending'].includes(l.status)).length`);
  ok(openSameRoom>=2,'0b. Có ≥2 hợp đồng cùng mở trên P101 → máy chủ chắc chắn từ chối bớt');

  // ===== Đồng bộ: máy chủ từ chối hợp đồng thứ 2 =====
  await run(`Sync.cycle(true)`);
  await new Promise(r=>setTimeout(r,120));

  const after=run(`data.leases.filter(l=>!l.deleted).length`);
  ok(after>=1,`1a. Sau đồng bộ VẪN CÒN ${after} hợp đồng trên máy (trước khi sửa: về 0 — mất sạch)`);
  ok(run(`data.leases.some(l=>!l.deleted&&l.roomId==='dh101')`),'1b. Hợp đồng của P101 không bị xóa oan');
  ok(run(`data.tenants.length`)===2,'1c. Người ở vẫn nguyên');

  // ===== Không lặp vô hạn: bản bị từ chối không bị đẩy lại =====
  const p1=pushes;
  await run(`Sync.cycle(true)`); await new Promise(r=>setTimeout(r,60));
  await run(`Sync.cycle(true)`); await new Promise(r=>setTimeout(r,60));
  const pushedLeases=run(`typeof Sync.blocked==='undefined'?'[]':JSON.stringify(Object.keys(Sync.blocked.leases||{}))`);
  ok(pushedLeases!=='[]','2a. Bản ghi bị từ chối được đánh dấu ngừng đẩy lại');
  ok(run(`data.leases.filter(l=>!l.deleted).length`)===after,'2b. Đồng bộ thêm 2 vòng nữa: số hợp đồng KHÔNG đổi (hết lặp)');

  // ===== Sửa nội dung thì được đẩy lại =====
  run(`const L=data.leases.find(l=>!l.deleted&&l.roomId==='dh101');L.note='đã sửa';saveData()`);
  ok(run(`typeof Sync.isBlocked!=='function'?false:(function(){const L=data.leases.find(l=>!l.deleted&&l.roomId==='dh101');return !Sync.isBlocked('leases',L)})()`),
     '3a. Sau khi sửa nội dung → được phép đẩy lên lại');

  // ===== Tombstone THẬT (máy chủ báo xóa thật) vẫn phải áp dụng =====
  ok(run(`typeof Sync.isPhantomTombstone==='function'&&Sync.isPhantomTombstone('leases',{id:'khong-co-tren-may',deleted:true})===false`),
     '4a. Bản ghi máy không có → coi là xóa thật, vẫn áp dụng bình thường');
  ok(run(`typeof Sync.isPhantomTombstone==='function'&&(function(){const L=data.leases.find(l=>!l.deleted);return Sync.isPhantomTombstone('leases',{id:L.id,deleted:true})})()===true`),
     '4b. Bản ghi máy đang có bản sống → nhận diện đúng là tombstone giả');

  console.log('\nSỬA LỖI ĐỒNG BỘ SUPABASE v4.7.1:',pass,'passed,',fail,'failed');
  process.exit(fail?1:0);
})().catch(e=>{console.error(e);process.exit(1)});
