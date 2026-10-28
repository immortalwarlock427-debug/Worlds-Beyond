/* Cloud character storage adapter: CAS, ownership, backup compatibility and UI. */
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=pathName=>fs.readFileSync(path.join(__dirname,'..',pathName),'utf8');
const plain=obj=>JSON.parse(JSON.stringify(obj));
function cloud(){
  const ctx={window:{},URL,atob};
  vm.runInNewContext(read('js/cloud-characters.js'),ctx);
  return ctx.window.WBCloudCharacters;
}
const hero={id:'cabcde',fields:{charName:'Aldrich'},hist:{VIT:{1:16}},
  portraits:[],abilities:[],trauma:0};
function database(userId='a'){
 const rows=new Map(), calls=[];
 const client={
  auth:{async getUser(){return {data:{user:{id:userId}},error:null}}},
  from(table){
   assert.equal(table,'wb_characters');
   let action='select',value=null,filters={},columns=null;
   const q={
    select(cols){columns=cols;return q;},
    insert(doc){action='insert';value=doc;return q;},
    update(doc){action='update';value=doc;return q;},
    delete(){action='delete';return q;},
    eq(field,v){filters[field]=v;return q;},
    order(){return Promise.resolve(result());},
    single(){return Promise.resolve(result(true));},
    maybeSingle(){return Promise.resolve(result(true));},
    then(resolve,reject){return Promise.resolve(result()).then(resolve,reject);}
   };
   function result(single=false){
     calls.push({action,filters:plain(filters),columns,owner:userId});
     let matched=[...rows.values()].filter(row=>Object.entries(filters)
       .every(([key,v])=>row[key]===v));
     let err=null;
     if(action==='insert'){
       const k=value.owner_id+'|'+value.character_id;
       if(rows.has(k))err={message:'duplicate key'};
       else if(value.owner_id!==userId)err={message:'RLS violation'};
       else rows.set(k,{...value,updated_at:'2026-10-28'});
       matched=err?[]:[rows.get(k)];
     }else if(action==='update'){
       const row=matched[0];
       if(row){rows.set(row.owner_id+'|'+row.character_id,
         {...row,...value,updated_at:'2026-10-29'});
         matched=[rows.get(row.owner_id+'|'+row.character_id)];
       }
     }else if(action==='delete'){
       for(const row of matched)rows.delete(row.owner_id+'|'+row.character_id);
     }
     const filtered=matched.map(row=>{
       if(!columns||columns==='*')return row;
       const out={};for(const col of columns.split(','))
         if(col.trim() in row)out[col.trim()]=row[col.trim()];
       return out;
     });
     return {data:single?(filtered[0]||null):filtered,error:err};
   }
   return q;
  }
 };
 return {client,rows,calls};
}
test('cloud configuration accepts HTTPS public keys and rejects admin secrets',()=>{
 const c=cloud();
 assert.equal(c.validateConfig('https://example.supabase.co','sb_publishable_abc'),true);
 assert.equal(c.validateConfig('http://example.supabase.co','sb_publishable_abc'),false);
 assert.equal(c.validateConfig('https://example.supabase.co/path','sb_publishable_abc'),false);
 assert.equal(c.validateConfig('https://example.supabase.co','sb_secret_paste'),false);
 const secret='eyJhbGciOiJub25lIn0.'+
   Buffer.from(JSON.stringify({role:'service_role'})).toString('base64url')+'.abc';
 assert.equal(c.validateConfig('https://example.supabase.co',secret),false);
});
test('private character create/list/read/update/delete through optimistic revisions',async()=>{
 const c=cloud(),db=database('user-one'),store=c.createAdapter(db.client);
 const created=await store.save(hero,null);
 assert.equal(created.character_id,hero.id);
 assert.equal(created.revision,1);
 assert.deepEqual(plain((await store.list()).map(x=>x.name)),['Aldrich']);
 const restored=await store.get(hero.id);
 assert.deepEqual(plain(restored.document),plain(hero));
 const replacement={...hero,fields:{charName:'Aldrich II'}};
 const next=await store.save(replacement,1);
 assert.equal(next.revision,2);
 assert.equal(next.name,'Aldrich II');
 assert.deepEqual(plain((await store.get(hero.id)).document.fields),
   {charName:'Aldrich II'});
 await assert.rejects(()=>store.save(hero,1),/REVISION_CONFLICT/);
 await assert.rejects(()=>store.remove(hero.id,1),/REVISION_CONFLICT/);
 assert.equal(await store.remove(hero.id,2),true);
 assert.equal((await store.list()).length,0);
 assert.equal(db.calls.some(c=>c.action==='update'&&c.filters.revision===1),true);
 assert.equal(db.calls.some(c=>c.action==='delete'&&c.filters.revision===2),true);
});
test('two distinct accounts cannot read or modify another owner in adapter',async()=>{
 const api=cloud(),db=database('owner');
 const owner=api.createAdapter(db.client);
 await owner.save(hero,null);
 db.client.auth.getUser=async()=>({data:{user:{id:'attacker'}},error:null});
 const attacker=api.createAdapter(db.client);
 assert.deepEqual(plain(await attacker.list()),[]);
 assert.equal(await attacker.get(hero.id),null);
 await assert.rejects(()=>attacker.save(hero,1),/REVISION_CONFLICT/);
 await assert.rejects(()=>attacker.remove(hero.id,1),/REVISION_CONFLICT/);
 assert.equal(db.rows.size,1);
});
test('malformed characters, extra-large payload and invalid revisions are rejected',async()=>{
 const api=cloud(),adapter=api.createAdapter(database().client);
 assert.throws(()=>api.ensureState({...hero,id:'evil'}),/INVALID_CHARACTER/);
 assert.throws(()=>api.ensureState({...hero,fields:null}),/INVALID_CHARACTER/);
 assert.throws(()=>api.ensureState({...hero,portrait:'x'.repeat(3000001)}),
   /CHARACTER_TOO_LARGE/);
 await assert.rejects(()=>adapter.save(hero,0),/INVALID_REVISION/);
 assert.equal(hero.fields.charName,'Aldrich');
});
test('migration enforces owner-only policies for every verb, with grants',()=>{
 const migration=read('supabase/migrations/20261028_private_characters.sql').toLowerCase();
 assert.match(migration,/enable row level security/);
 assert.match(migration,/revoke all on public\.wb_characters from anon, authenticated/);
 assert.match(migration,/grant select,insert,update,delete on public\.wb_characters to authenticated/);
 for(const op of ['select','insert','update','delete'])
   assert.match(migration,new RegExp('for '+op+' to authenticated'));
 assert.match(migration,/owner_id = \(select auth\.uid\(\)\)/);
 assert.match(migration,/with check \(owner_id = \(select auth\.uid\(\)\)/);
});
test('cloud save page loads private adapter without changing sheet or DM scripts',()=>{
 const page=read('cloud.html');
 for(const id of ['cloudConfigForm','cloudAuthSection','cloudAuthForm',
  'cloudSignIn','cloudSignUp','cloudSignOut','cloudCharacterSection',
  'cloudSaveLocal','cloudDownloadBackup','cloudUndoRestore','cloudCharacterList'])
   assert.ok(page.includes('id="'+id+'"'),id);
 assert.match(page,/@supabase\/supabase-js@2/);
 const files=['css/sheet.css','css/dm.css','css/cloud.css',
  'js/persistence.js','js/cloud-characters.js','js/cloud.js'];
 const versions=files.map(f=>{
   const m=page.match(new RegExp('(?:href|src)="'+f.replaceAll('.','\\.')+
     '\\?v=([^"]+)"'));
   assert.ok(m,'Asset missing '+f);return m[1];
 });
 assert.equal(new Set(versions).size,1);
 for(const file of ['index.html','dm.html','player.html'])
   assert.match(read(file),/href="cloud\.html"/);
 const controller=read('js/cloud.js');
 assert.match(controller,/repo\.save\(\{\.\.\.fresh/ , 'noop');
});
