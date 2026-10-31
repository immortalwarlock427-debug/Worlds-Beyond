/* Consumable inventory UI. Quantities/definitions use WBCharacter commands;
 * dice and the optional own-character healing action stay in the sheet UI. */
(() => {
  'use strict';
  const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function init(getState,save,controls){
    const root=document.getElementById('consumablesPanel');
    const list=root.querySelector('#consumableList'),form=root.querySelector('#consumableForm');
    const feedback=root.querySelector('#consumableFeedback'),add=root.querySelector('#consumableAdd');
    const name=form.querySelector('#consumableName'),quantity=form.querySelector('#consumableQuantity');
    const healing=form.querySelector('#consumableHealing'),description=form.querySelector('#consumableDescription');
    let editingId=null,pendingRemove=null;
    const entries=()=>window.WBCharacter.consumables(getState());
    function message(text,error=false){feedback.textContent=text;feedback.classList.toggle('error',error);}
    function focusItem(id){
      const card=Array.from(list.children).find(el=>el.dataset.consumableId===id);
      if(!card)return;
      const use=card.querySelector('[data-consumable-action="use"]');
      (use&&!use.disabled?use:card.querySelector('input')).focus();
    }
    function render(){
      const items=entries();add.disabled=items===null;
      if(items===null){list.innerHTML='<p class="note">The consumables in this save could not be read. Their saved data has been kept.</p>';return;}
      if(!items.length){list.innerHTML='<p class="consumable-empty">No consumables yet. Add potions, food, ammunition or other items you use up.</p>';return;}
      list.innerHTML=items.map(item=>{
        if(!item||typeof item!=='object'||typeof item.id!=='string'||!item.id.trim())
          return '<p class="note">A saved consumable could not be read. Its data has been kept.</p>';
        const title=String(item.name||'Consumable'),q=window.WBCharacter.consumableQuantity(item.quantity);
        return '<article class="consumable-card" data-consumable-id="'+esc(item.id)+'">'+
          '<div class="consumable-title"><h4>'+esc(title)+'</h4>'+
          (item.healingDice?'<span class="consumable-roll">Healing: '+esc(item.healingDice)+'</span>':'')+'</div>'+
          (typeof item.description==='string'&&item.description?'<p class="consumable-description">'+esc(item.description)+'</p>':'')+
          '<div class="consumable-actions"><label class="consumable-quantity"><span>Quantity</span><input type="number" min="0" step="1" inputmode="numeric" value="'+(q===null?'':q)+'" data-quantity-committed="'+(q===null?'':q)+'" aria-label="'+esc(title)+' quantity"></label>'+
          '<button type="button" class="btn strong" data-consumable-action="use" aria-label="Use '+esc(title)+'"'+(q===0?' disabled':'')+'>Use</button>'+
          '<button type="button" class="btn" data-consumable-action="drink"'+(q===0?' disabled':'')+'>Drink (DEX-discounted 5 AP)</button>'+
          '<button type="button" class="btn" data-consumable-action="edit" aria-label="Edit '+esc(title)+'">Edit</button>'+
          '<button type="button" class="btn-link" data-consumable-action="remove" aria-label="Remove '+esc(title)+'">Remove</button></div>'+
          (pendingRemove===item.id?'<div class="consumable-remove"><span>Remove '+esc(title)+' from this character?</span><button type="button" class="btn danger" data-consumable-action="confirm-remove">Remove item</button><button type="button" class="btn" data-consumable-action="keep">Keep</button></div>':'')+'</article>';
      }).join('');
    }
    function closeEditor(){editingId=null;form.reset();form.hidden=true;quantity.disabled=false;}
    function edit(item){
      editingId=item?item.id:null;form.reset();
      form.querySelector('#consumableEditorTitle').textContent=item?'Edit consumable':'Add consumable';
      name.value=item?String(item.name||''):'';
      description.value=item&&typeof item.description==='string'?item.description:'';
      healing.value=item&&item.healingDice!=null?String(item.healingDice):'';
      quantity.disabled=!!item;form.querySelector('#consumableNewQuantity').hidden=!!item;
      form.querySelector('#consumableEditQuantityNote').hidden=!item;
      form.hidden=false;message('');name.focus();
    }
    function execute(command,renderList=true,announceSuccess=true){
      const result=controls.execute(command);
      if(announceSuccess||!result.ok)message(result.message||'This consumable could not be updated.',!result.ok);
      if(result.ok){if(renderList)render();save();}
      return result;
    }
    add.addEventListener('click',()=>edit(null));
    form.querySelector('#consumableCancel').addEventListener('click',()=>{closeEditor();add.focus();});
    form.addEventListener('submit',event=>{
      event.preventDefault();
      const id=editingId||'cons'+Date.now().toString(36)+Math.random().toString(36).slice(2,10);
      const data={id,name:name.value,description:description.value,healingDice:healing.value};
      if(!editingId)data.quantity=quantity.value;
      const result=execute({type:editingId?'EditConsumable':'AddConsumable',consumableId:editingId,consumable:data});
      if(result.ok){closeEditor();focusItem(id);}
    });
    list.addEventListener('input',event=>{
      if(!event.target.matches('input'))return;
      const card=event.target.closest('[data-consumable-id]');if(!card)return;
      const q=window.WBCharacter.consumableQuantity(event.target.value);
      card.querySelector('[data-consumable-action="use"]').disabled=q===null||q===0;
    });
    list.addEventListener('change',event=>{
      if(!event.target.matches('input'))return;
      if(event.target.value===event.target.dataset.quantityCommitted)return;
      const card=event.target.closest('[data-consumable-id]');if(!card)return;
      // Keep the row in place during blur so the button being tapped can still
      // receive its click after committing the quantity correction.
      // A success message above the list would also move the button mid-tap.
      execute({type:'SetConsumableQuantity',consumableId:card.dataset.consumableId,value:event.target.value},false,false);
      const item=(entries()||[]).find(item=>item&&item.id===card.dataset.consumableId);
      const q=window.WBCharacter.consumableQuantity(item&&item.quantity);
      event.target.value=q===null?'':String(q);
      event.target.dataset.quantityCommitted=event.target.value;
      card.querySelector('[data-consumable-action="use"]').disabled=q===0;
    });
    list.addEventListener('click',event=>{
      const button=event.target.closest('[data-consumable-action]');if(!button)return;
      const card=button.closest('[data-consumable-id]'),id=card.dataset.consumableId;
      const item=(entries()||[]).find(item=>item&&item.id===id),action=button.dataset.consumableAction;
      if(action==='edit'&&item)edit(item);
      else if(action==='remove'){pendingRemove=id;render();list.querySelector('[data-consumable-action="keep"]').focus();}
      else if(action==='keep'){pendingRemove=null;render();focusItem(id);}
      else if(action==='confirm-remove'){
        const result=execute({type:'RemoveConsumable',consumableId:id});
        if(result.ok){pendingRemove=null;if(editingId===id)closeEditor();add.focus();}
      }else if(action==='use'||action==='drink'){
        // Some touch browsers do not blur number inputs when a button is tapped.
        // Commit the visible correction before using the item in that case too.
        const input=card.querySelector('input');
        if(window.WBCharacter.consumableQuantity(input.value)!==window.WBCharacter.consumableQuantity(item&&item.quantity)){
          const corrected=execute({type:'SetConsumableQuantity',consumableId:id,value:input.value},false,false);
          if(!corrected.ok)return;
        }
        // Ignore a delayed blur from this input when rendering the spent count.
        input.dataset.quantityCommitted=input.value;
        const result=execute({type:action==='drink'?'DrinkConsumable':'UseConsumable',consumableId:id});
        if(result.ok){focusItem(id);controls.onUse(result.consumablePlan);}
      }
    });
    render();
    return {render,reset(){closeEditor();pendingRemove=null;message('');render();}};
  }
  window.WBConsumables={init};
})();
