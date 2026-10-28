/* Supabase cloud character adapter (opt-in).
 * Works with a public/publishable browser key AND owner-only database RLS.
 * This module never fetches without user-provided project configuration.
 * The game/encounter repository is intentionally NOT synchronized here.
 */
(function () {
  'use strict';
  const MAX_JSON_BYTES=3000000;
  const record=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
  const validId=v=>typeof v==='string'&&/^c[a-z0-9]{4,30}$/.test(v);
  const cleanName=v=>String(v||'Unnamed character').trim().slice(0,100)||'Unnamed character';
  function ensureState(state) {
    if(!record(state)||!validId(state.id)||!record(state.fields)||!record(state.hist))
      throw new Error('INVALID_CHARACTER');
    const json=JSON.stringify(state);
    if(json.length>MAX_JSON_BYTES)throw new Error('CHARACTER_TOO_LARGE');
    return {document:JSON.parse(json),name:cleanName(state.fields.charName)};
  }
  function validateConfig(url,key) {
    try {
      const parsed=new URL(String(url||'').trim());
      // Supabase project domains are https. Custom domains also supported.
      if(parsed.protocol!=='https:'||parsed.username||parsed.password||
        parsed.search||parsed.hash||parsed.pathname!=='/'||!parsed.hostname)
        return false;
      const token=String(key||'').trim();
      // Reject service-role JWTs when recognizable; they must never appear in
      // the browser. Publishable "sb_publishable_" keys are preferred.
      if(!token||token.length>600)return false;
      if(token.startsWith('sb_secret_'))return false;
      if(token.startsWith('eyJ')){
        try {
          const segment=token.split('.')[1];
          if(!segment)return false;
          const decoded=JSON.parse(atob(segment.replace(/-/g,'+').replace(/_/g,'/')));
          if(decoded.role==='service_role')return false;
        }catch(err){return false;}
      }
      return true;
    }catch(err){return false;}
  }
  function createAdapter(client) {
    if(!client||!client.auth||typeof client.from!=='function')
      throw new TypeError('A Supabase v2 client is required.');
    async function user() {
      const {data,error}=await client.auth.getUser();
      if(error)throw error;
      if(!data||!data.user)throw new Error('SIGN_IN_REQUIRED');
      return data.user;
    }
    function handle(result) {
      if(result.error)throw result.error;
      return result.data;
    }
    async function list(){
      const account=await user();
      const data=handle(await client.from('wb_characters')
        .select('character_id,name,revision,updated_at')
        .eq('owner_id',account.id).order('updated_at',{ascending:false}));
      return Array.isArray(data)?data:[];
    }
    async function get(id) {
      const account=await user();
      const data=handle(await client.from('wb_characters')
        .select('character_id,name,revision,updated_at,document')
        .eq('owner_id',account.id).eq('character_id',id).maybeSingle());
      return data||null;
    }
    async function save(state,expectedRevision) {
      const account=await user();
      const {document,name}=ensureState(state);
      const character_id=state.id;
      if(expectedRevision===null){
        const data=handle(await client.from('wb_characters')
          .insert({owner_id:account.id,character_id,name,document,revision:1})
          .select('character_id,name,revision,updated_at').single());
        return data;
      }
      if(!Number.isSafeInteger(expectedRevision)||expectedRevision<1)
        throw new Error('INVALID_REVISION');
      const data=handle(await client.from('wb_characters')
        .update({name,document,revision:expectedRevision+1})
        .eq('owner_id',account.id).eq('character_id',character_id)
        .eq('revision',expectedRevision)
        .select('character_id,name,revision,updated_at').maybeSingle());
      if(!data)throw new Error('REVISION_CONFLICT');
      return data;
    }
    async function remove(id,revision) {
      const account=await user();
      if(!Number.isSafeInteger(revision)||revision<1)
        throw new Error('INVALID_REVISION');
      const data=handle(await client.from('wb_characters')
        .delete().eq('owner_id',account.id).eq('character_id',id)
        .eq('revision',revision)
        .select('character_id').maybeSingle());
      if(!data)throw new Error('REVISION_CONFLICT');
      return true;
    }
    return {user,list,get,save,remove,ensureState};
  }
  window.WBCloudCharacters={createAdapter,ensureState,validateConfig,MAX_JSON_BYTES};
})();