/* Character navigation regression checks: run node --test tests/navigation.test.cjs */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const TABS = ['overview', 'attributes', 'equipment', 'abilities', 'statuses', 'notes'];

test('main destinations are separate from six character tabs without duplicating sheet sections', () => {
  const html = read('index.html');
  const destination = html.match(/<nav class="views main-views"[^>]*>([\s\S]*?)<\/nav>/);
  const tabs = html.match(/<nav class="sheet-tabs"[^>]*>([\s\S]*?)<\/nav>/);
  assert.ok(destination, 'Missing separate main navigation');
  assert.ok(tabs, 'Missing inner character navigation');
  assert.deepEqual(Array.from(destination[1].matchAll(/data-view="([^"]+)"/g), m => m[1]), ['sheet','map']);
  assert.deepEqual(Array.from(tabs[1].matchAll(/data-sheet-tab="([^"]+)"/g), m => m[1]), TABS);
  assert.equal((html.match(/data-sheet-section="/g)||[]).length, 9);
  for (const [head, group] of [
    ['statusHead','statuses'], ['vitalsHead','overview'], ['defHead','overview'],
    ['attrHead','attributes'],['equipHead','equipment'],['abilityHead','abilities'],
    ['advHead','attributes'],['notesHead','notes']]) {
    assert.match(html, new RegExp('<section[^>]*data-sheet-section="' + group + '"[^>]*aria-labelledby="' + head + '"'));
  }
  assert.match(html, /<section class="top"[^>]*data-sheet-section="overview" aria-label="Character"/);
  assert.ok(html.indexOf('id="sheetTabs"') > html.indexOf('id="footBtns"'));
  assert.ok(html.indexOf('id="mapSec"') > html.indexOf('id="sheetTabs"'));
  assert.equal((html.match(/id="abilitySection"/g)||[]).length, 1);
  assert.equal((html.match(/id="resourceSection"/g)||[]).length, 1);
});

function navigationHarness() {
  const app = read('js/app.js');
  const start = app.indexOf('  const SHEET_TABS =');
  const end = app.indexOf('  let resizeT =', start);
  assert.ok(start >= 0 && end > start, 'navigation source not found');
  const classes = {};
  const topButtons = ['sheet','map'].map(key => ({
    dataset: {view:key}, setAttribute(key,value) { this[key]=value; }
  }));
  const subButtons = TABS.map(key => ({
    dataset: {sheetTab:key}, setAttribute(k,value) { this[k]=value; },
    scrollIntoView(options) { this.scrollOptions=options; }
  }));
  const sections = ['notes','statuses','overview','overview','overview','attributes','equipment','abilities','attributes'].map(key => ({
    dataset: {sheetSection:key}, hidden: false
  }));
  const navHandlers={};
  const dom = {
    querySelectorAll(sel) {
      if(sel==='#viewNav button') return topButtons;
      if(sel==='#sheetTabs button') return subButtons;
      if(sel==='[data-sheet-section]') return sections;
      throw Error('Unexpected selector ' + sel);
    }
  };
  let mapCount=0, statusCount=0;
  const ctx={
    mainEl:{classList:{toggle(c,on) { classes[c]=on; }}},
    document:dom, location:{hash:''},
    window:{addEventListener(event,fn){navHandlers[event]=fn;}},
    $:selector=>({addEventListener(event,fn){navHandlers[selector+':'+event]=fn;}}),
    statusManager:{render(){statusCount++;}},abilityLibrary:{render(){}},renderMap(){mapCount++;},
    centerToken(){},console
  };
  vm.runInNewContext('let view="sheet"; let mapTarget=null;\n'+app.slice(start,end)+
    '\nglobalThis.__nav={setView,viewFromHash,getTab:()=>activeSheetTab,getView:()=>view};',ctx);
  return {ctx,classes,topButtons,subButtons,sections,navHandlers,
    mapCount:()=>mapCount,statusCount:()=>statusCount};
}
test('switching sheet tabs hides unrelated panels without destroying anything', () => {
  const h=navigationHarness();
  for(const tab of TABS) {
    h.ctx.__nav.setView('sheet',tab);
    assert.equal(h.ctx.__nav.getTab(),tab);
    assert.equal(h.classes['view-map'],false);
    assert.equal(h.classes['view-notes'],tab==='notes');
    assert.equal(h.topButtons[0]['aria-pressed'],'true');
    assert.equal(h.topButtons[1]['aria-pressed'],'false');
    for(const s of h.sections) assert.equal(s.hidden,s.dataset.sheetSection!==tab, tab);
    const selected=h.subButtons.filter(b=>b['aria-pressed']==='true');
    assert.equal(selected.length,1);
    assert.equal(selected[0].dataset.sheetTab,tab);
    assert.equal(selected[0].scrollOptions.inline,'nearest');
  }
  assert.ok(h.statusCount()>0);
});
test('Battlemap is independent and returning to Character restores the last sub-tab', () => {
  const h=navigationHarness();
  h.ctx.__nav.setView('sheet','equipment');
  h.ctx.__nav.setView('map');
  assert.equal(h.classes['view-map'],true);
  assert.equal(h.ctx.__nav.getTab(),'equipment');
  assert.equal(h.topButtons[1]['aria-pressed'],'true');
  assert.equal(h.sections.every(s=>s.hidden),true);
  assert.ok(h.mapCount()>=1);
  h.navHandlers['#viewNav:click']({target:{closest(){return h.topButtons[0];}}});
  assert.equal(h.ctx.location.hash,'#sheet/equipment');
  assert.equal(h.ctx.__nav.getTab(),'equipment');
  assert.equal(h.sections.filter(s=>!s.hidden).length,1);
});
test('deep links preserve legacy #status, #sheet and #map', () => {
  const h=navigationHarness();
  for(const [hash,expectedView,expectedTab] of [
    ['#sheet/abilities','sheet','abilities'],['#sheet/attributes','sheet','attributes'],
    ['#sheet/statuses','sheet','statuses'],['#status','sheet','statuses'],
    ['#sheet/notes','sheet','notes'],
    ['#map','map','notes'],['#sheet','sheet','overview'],['','sheet','overview']
  ]) {
    h.ctx.location.hash=hash;h.ctx.__nav.viewFromHash();
    assert.equal(h.ctx.__nav.getView(),expectedView,hash);
    assert.equal(h.ctx.__nav.getTab(),expectedTab,hash);
  }
  h.navHandlers['#sheetTabs:click']({target:{closest(){return h.subButtons[3];}}});
  assert.equal(h.ctx.location.hash,'#sheet/abilities');
  assert.equal(h.ctx.__nav.getTab(),'abilities');
});
test('sticky navigation and hidden sections maintain map separation', () => {
  const css=read('css/sheet.css'),app=read('js/app.js');
  assert.match(css,/\.views\.main-views\s*\{[^}]*position:\s*sticky/);
  assert.match(css,/\.sheet-tabs\s*\{[^}]*position:\s*sticky/);
  assert.match(css,/main\.sheet > section\[hidden\]/);
  assert.match(css,/main\.view-map > \.sheet-tabs\s*\{\s*display:\s*none/);
  assert.match(app,/section\.hidden = !onSheet \|\| section\.dataset\.sheetSection !== activeSheetTab/);
  assert.match(app,/if \(!onSheet\) \{ mapTarget = null; renderMap\(true\); centerToken\(\); \}/);
  assert.match(app,/if \(onSheet && activeSheetTab === 'statuses'\) statusManager\.render\(\)/);
});

test('all local scripts/styles across every page share one release and Draft label', () => {
  const versions = new Set(), drafts = new Set();
  for (const file of ['index.html', 'dm.html', 'player.html', 'cloud.html']) {
    const html = read(file);
    const assets = Array.from(html.matchAll(/(?:src|href)="((?:js|css)\/[^"]+)"/g), m => m[1]);
    assert.ok(assets.length > 0, file);
    for (const asset of assets) {
      const match = asset.match(/\?v=([\w-]+)$/);
      assert.ok(match, file + ': ' + asset + ' must have a release version');
      versions.add(match[1]);
    }
    const draft = html.match(/Draft (\d+)/);
    assert.ok(draft, file);
    drafts.add(draft[1]);
  }
  assert.equal(versions.size, 1, 'Every local asset on every page must use the same release');
  assert.equal(drafts.size, 1, 'All pages must identify the same Draft');
  assert.match(read('docs/CONTEXT.md'), new RegExp('What the site does \\(Draft ' + [...drafts][0] + '\\)'));
});
