/* Cloud Saves UI – manual private character copies only.
 * NO automatic uploads. Local sheet and all game/DM saves remain separate.
 * The site supplies a publishable URL/key by default; an advanced override is
 * still available for local testing. Owner-only database RLS protects data.
 */
(function(){
  'use strict';
  const $=selector=>document.querySelector(selector);
  const text=v=>String(v==null?'':v);
  const html=v=>text(v).replace(/[&<>"']/g,c=>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
  const configKey='wb-cloud-public-config-v1';
  const backupKey='wb-cloud-last-local-backup-v1';
  const siteConfig=window.WBCloudConfig||null;
  const local=window.WBPersistence.createLocalRepositories(()=>window.localStorage).characters;
  let client=null,cloud=null,owner=null,listed=[],busy=false;
  const ui={
    feedback:$('#cloudFeedback'),auth:$('#cloudAuthSection'),
    account:$('#cloudAuthStatus'),characters:$('#cloudCharacterSection'),
    list:$('#cloudCharacterList'),local:$('#cloudLocalSummary')
  };
  const messages={
    INVALID_CHARACTER:'The local character cannot be uploaded. Open the Character Sheet and save it first.',
    CHARACTER_TOO_LARGE:'This character is over the 3 MB cloud limit (usually a large embedded portrait). Export your JSON locally and reduce embedded images before cloud saving.',
    REVISION_CONFLICT:'Conflict: this cloud character changed since the list was loaded. Refresh and review the newer copy before saving again.',
    SIGN_IN_REQUIRED:'Sign in to your cloud account first.',
    INVALID_REVISION:'Invalid cloud version. Refresh and retry.'
  };
  function announce(message,error=false){
    ui.feedback.textContent=message;ui.feedback.classList.toggle('error',error);
  }
  function failure(error){
    const code=error&&error.message||String(error);
    announce(messages[code]||('Cloud operation failed: '+code),true);
  }
  function setBusy(flag){
    busy=flag;
    for(const btn of document.querySelectorAll('.cloud-sheet button'))
      btn.disabled=flag;
  }
  function currentLocal(){
    try{return local.load();}catch(error){return null;}
  }
  function updateLocal(){
    const state=currentLocal();
    const label=state&&state.fields&&state.fields.charName||'Unnamed character';
    ui.local.textContent=state&&state.id?
      'Saved on this device: '+label+' · Character ID '+state.id:
      'No local character detected. Create or save one on the Character Sheet first.';
    $('#cloudSaveLocal').disabled=busy||!state||!state.id;
    $('#cloudDownloadBackup').disabled=busy||!state;
    $('#cloudUndoRestore').hidden=!window.localStorage.getItem(backupKey);
  }
  function showAccount(){
    ui.auth.hidden=!client;
    ui.characters.hidden=!owner;
    ui.account.textContent=owner?'Signed in as '+owner.email:'Not signed in';
    $('#cloudSignOut').hidden=!owner;
    $('#cloudAuthForm').querySelector('[name="password"]').value='';
    updateLocal();
  }
  function safeUrl(url){
    return new URL(url).origin;
  }
  async function connect(url,key,rememberOverride=false){
    if(!window.WBCloudCharacters.validateConfig(url,key))
      throw new Error('Use an HTTPS Supabase project URL and a publishable/anon key. Never use a service-role key.');
    if(!window.supabase || !window.supabase.createClient)
      throw new Error('Supabase browser SDK could not load. Check your connection or content blocker.');
    const endpoint=safeUrl(url),publishable=key.trim();
    if(client&&client.auth&&client.auth.stopAutoRefresh)client.auth.stopAutoRefresh();
    client=window.supabase.createClient(endpoint,publishable,{
      auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,
        storageKey:'wb-supabase-session-'+new URL(endpoint).hostname}
    });
    cloud=window.WBCloudCharacters.createAdapter(client);
    if(rememberOverride)
      window.localStorage.setItem(configKey,JSON.stringify({url:endpoint,key:publishable}));
    const response=await client.auth.getUser();
    owner=response.data&&response.data.user||null;
    // Auth can asynchronously refresh; protect the UI from exposing a stale
    // list by always reloading metadata after successful sign in.
    client.auth.onAuthStateChange((event,session)=>{
      owner=session&&session.user||null;
      listed=[];
      showAccount();
      if(owner){
        // Avoid additional auth operations inside Supabase's auth callback.
        Promise.resolve().then(()=>reload().catch(failure));
      }
    });
    showAccount();
    if(owner)await reload();
    else announce('Cloud project connected. Sign in or create an account to continue.');
  }
  async function reload(){
    if(!cloud||!owner)return;
    listed=await cloud.list();
    renderList();
    updateLocal();
  }
  function renderList(){
    const items=listed;
    if(!items.length){
      ui.list.innerHTML='<p class="dm-empty">No cloud characters yet. Save your local character to create your first private copy.</p>';
      return;
    }
    ui.list.innerHTML=items.map(row=>{
      const updated=row.updated_at?new Date(row.updated_at).toLocaleString():'Unknown date';
      return '<article class="cloud-item"><div><h3>'+html(row.name)+
        '</h3><p>Revision '+Number(row.revision)+' · '+html(updated)+
        '<br>Character ID: '+html(row.character_id)+'</p></div>'+
        '<div class="cloud-item-actions">'+
        '<button class="btn strong" data-cloud-action="restore" data-id="'+html(row.character_id)+'">Restore to this device</button>'+
        '<button class="btn" data-cloud-action="delete" data-id="'+html(row.character_id)+'">Delete cloud copy</button>'+
        '</div></article>';
    }).join('');
  }
  function downloadLocal(){
    const state=currentLocal();
    if(!state){announce('No local character to export.',true);return;}
    try{
      const data=window.WBPersistence.exportCharacter(state);
      const blob=new Blob([data],{type:'application/json'});
      const url=URL.createObjectURL(blob);
      const anchor=document.createElement('a');
      const name=text(state.fields&&state.fields.charName||'character')
        .replace(/[\\/:*?"<>|]+/g,'').slice(0,60)||'character';
      anchor.href=url;anchor.download=name+'-backup.json';
      document.body.append(anchor);anchor.click();anchor.remove();
      // Allow browser time to start the download before revoking the Blob URL.
      window.setTimeout(()=>URL.revokeObjectURL(url),1000);
      announce('Local JSON backup downloaded.');
    }catch(err){failure(err);}
  }
  $('#cloudConfigForm').addEventListener('submit',async event=>{
    event.preventDefault();if(busy)return;
    const data=new FormData(event.currentTarget);
    setBusy(true);
    try{
      await connect(text(data.get('url')).trim(),text(data.get('key')).trim(),true);
      $('#cloudAdvanced').open=false;
      announce('Cloud project connected. Sign in or continue with your account.');
    }
    catch(error){failure(error);}finally{setBusy(false);updateLocal();}
  });
  $('#cloudAuthForm').addEventListener('submit',async event=>{
    event.preventDefault();if(!client||busy)return;
    const data=new FormData(event.currentTarget);
    setBusy(true);
    try{
      const result=await client.auth.signInWithPassword({
        email:text(data.get('email')).trim(),password:text(data.get('password'))
      });
      if(result.error)throw result.error;
      owner=result.data.user;
      showAccount();await reload();
      announce('Signed in. Your cloud saves are available.');
    }catch(error){failure(error);}finally{setBusy(false);updateLocal();}
  });
  $('#cloudSignUp').addEventListener('click',async()=>{
    if(!client||busy)return;
    const data=new FormData($('#cloudAuthForm'));
    const email=text(data.get('email')).trim(),password=text(data.get('password'));
    if(!email||password.length<6){
      announce('Enter a valid email and password of at least 6 characters.',true);return;
    }
    setBusy(true);
    try{
      const result=await client.auth.signUp({email,password});
      if(result.error)throw result.error;
      owner=result.data.session&&result.data.user||null;
      showAccount();if(owner)await reload();
      announce(owner?'Account created and signed in.':
        'Account request accepted. Check your email for the verification link, then sign in.');
    }catch(error){failure(error);}finally{setBusy(false);updateLocal();}
  });
  $('#cloudSignOut').addEventListener('click',async()=>{
    if(!client||busy)return;
    setBusy(true);
    try{
      const result=await client.auth.signOut();
      if(result.error)throw result.error;
      owner=null;listed=[];showAccount();
      ui.list.innerHTML='';
      announce('Signed out. Your local character has not been changed.');
    }catch(error){failure(error);}finally{setBusy(false);updateLocal();}
  });
  $('#cloudReload').addEventListener('click',async()=>{
    if(busy||!owner)return;
    setBusy(true);
    try{await reload();announce('Cloud list refreshed.');}
    catch(error){failure(error);}finally{setBusy(false);updateLocal();}
  });
  $('#cloudSaveLocal').addEventListener('click',async()=>{
    if(busy||!owner)return;
    const state=currentLocal();
    if(!state){announce('Save a character on the Character Sheet first.',true);return;}
    const row=listed.find(item=>item.character_id===state.id);
    if(row&&!window.confirm('Update '+row.name+' in the cloud from this browser’s current local character? Your previous cloud revision will be replaced if no other device has changed it.'))return;
    setBusy(true);
    try{
      await cloud.save(state,row?row.revision:null);
      await reload();
      announce('Character saved privately to cloud. Local saves remain separate.');
    }catch(error){failure(error);}
    finally{setBusy(false);updateLocal();}
  });
  $('#cloudDownloadBackup').addEventListener('click',downloadLocal);
  $('#cloudCharacterList').addEventListener('click',async event=>{
    const btn=event.target.closest('button[data-cloud-action]');
    if(!btn||busy||!owner)return;
    const id=btn.dataset.id,meta=listed.find(row=>row.character_id===id);
    if(!meta)return;
    const type=btn.dataset.cloudAction;
    if(type==='restore'){
      if(!window.confirm('Restore '+meta.name+' from cloud? This replaces the locally saved character on this browser. Export your current character first if you want to keep a separate copy.'))return;
      setBusy(true);
      try{
        const latest=await cloud.get(id);
        if(!latest)throw new Error('Character no longer exists. Refresh the list.');
        if(latest.revision!==meta.revision)throw new Error('REVISION_CONFLICT');
        window.WBCloudCharacters.ensureState(latest.document);
        const previous=currentLocal();
        if(previous)window.localStorage.setItem(backupKey,JSON.stringify(previous));
        local.save(latest.document);
        updateLocal();
        announce('Cloud character restored on this device. Reopen or refresh the Character Sheet to use it. Undo last restore is available here.');
      }catch(error){failure(error);}finally{setBusy(false);updateLocal();}
    }else if(type==='delete'){
      if(!window.confirm('Permanently delete the private cloud copy of '+meta.name+'? Your local character will be unaffected.'))return;
      setBusy(true);
      try{
        await cloud.remove(id,meta.revision);
        await reload();
        announce('Cloud copy deleted. Your local character remains unchanged.');
      }catch(error){failure(error);}finally{setBusy(false);updateLocal();}
    }
  });
  $('#cloudUndoRestore').addEventListener('click',()=>{
    if(!window.confirm('Replace this browser’s current local character with the previous restore backup?'))return;
    try{
      const backup=window.localStorage.getItem(backupKey);
      if(!backup)return;
      const state=JSON.parse(backup);
      window.WBCloudCharacters.ensureState(state);
      local.save(state);
      window.localStorage.removeItem(backupKey);
      updateLocal();
      announce('Previous local character restored. Refresh the Character Sheet to see it.');
    }catch(error){failure(error);}
  });
  $('#cloudUseDefault').addEventListener('click',async()=>{
    if(busy)return;
    if(!siteConfig||!siteConfig.url||!siteConfig.key){
      announce('Default cloud connection is not available.',true);return;
    }
    setBusy(true);
    try{
      await connect(siteConfig.url,siteConfig.key,false);
      window.localStorage.removeItem(configKey);
      $('#cloudConfigForm').querySelector('[name="url"]').value=siteConfig.url;
      $('#cloudConfigForm').querySelector('[name="key"]').value=siteConfig.key;
      $('#cloudAdvanced').open=false;
      announce(owner?'Connected to Worlds Beyond cloud. Your account is ready.':
        'Connected to Worlds Beyond cloud. Sign in to continue.');
    }catch(error){failure(error);}finally{setBusy(false);updateLocal();}
  });
  (async()=>{
    updateLocal();
    try{
      const saved=JSON.parse(window.localStorage.getItem(configKey)||'null');
      // Ignore a legacy manual connection when it matches site defaults;
      // future publishable-key changes should reach existing visitors too.
      // The first public-key rollout accidentally lowercased one character.
      // Drop only that known-bad cached override, not arbitrary test projects.
      const legacyBadKey='sb_publishable_zWJlrpjloCXo6Cma5vxhHA_8djQB6T3';
      const legacyTypo=saved&&siteConfig&&saved.url===siteConfig.url&&
        saved.key===legacyBadKey;
      const sameAsDefault=saved&&siteConfig&&saved.url===siteConfig.url&&
        saved.key===siteConfig.key;
      if(sameAsDefault||legacyTypo)window.localStorage.removeItem(configKey);
      const chosen=saved&&!sameAsDefault&&!legacyTypo&&saved.url&&saved.key
        ?saved:siteConfig;
      if(chosen&&chosen.url&&chosen.key){
        $('#cloudConfigForm').querySelector('[name="url"]').value=chosen.url;
        $('#cloudConfigForm').querySelector('[name="key"]').value=chosen.key;
        await connect(chosen.url,chosen.key,false);
      }else {
        $('#cloudAdvanced').open=true;
        announce('No default cloud project is configured. Expand Advanced settings to connect.',true);
      }
    }catch(error){
      $('#cloudAdvanced').open=true;
      failure(error);
    }
  })();
})();