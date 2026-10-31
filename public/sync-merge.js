(function (root) {
  const eq = (a,b) => JSON.stringify(a) === JSON.stringify(b);
  const keyed = a => Array.isArray(a) && a.every(x => x && typeof x === 'object' && typeof x.id === 'string') && new Set(a.map(x=>x.id)).size === a.length;
  function merge(base, local, remote, path = '') {
    if (eq(local, remote)) return { value: local, conflicts: [] };
    if (eq(base, local)) return { value: remote, conflicts: [] };
    if (eq(base, remote)) return { value: local, conflicts: [] };
    if (keyed(base) && keyed(local) && keyed(remote)) {
      const maps = [base,local,remote].map(a => new Map(a.map(x=>[x.id,x])));
      const ids = new Set([...remote.map(x=>x.id), ...local.map(x=>x.id), ...base.map(x=>x.id)]);
      const value = [], conflicts = [];
      for (const id of ids) { const r = merge(...maps.map(m=>m.get(id)), path+'/'+id); if(r.value!==undefined)value.push(r.value); conflicts.push(...r.conflicts); }
      return { value, conflicts };
    }
    const object = x => x && typeof x === 'object' && !Array.isArray(x);
    if (object(base) && object(local) && object(remote)) {
      const value = {}, conflicts = [];
      for (const key of new Set([...Object.keys(base),...Object.keys(local),...Object.keys(remote)])) {
        if (['__proto__','prototype','constructor'].includes(key)) continue;
        const r = merge(base[key],local[key],remote[key],path+'/'+key);
        if(r.value!==undefined)value[key]=r.value; conflicts.push(...r.conflicts);
      }
      return { value, conflicts };
    }
    // Concurrent edits to the same field (including delete vs edit) require a choice.
    return { value: local, conflicts: [path] };
  }
  function validateState(s) {
    if (!s || typeof s!=='object' || Array.isArray(s)) throw Error('קובץ נתונים לא תקין');
    for (const key of ['tasks','events','notes','children','parentSessions','childGoals']) if(!Array.isArray(s[key])) throw Error('חסר אוסף נתונים: '+key);
    if(s.children.length!==9)throw Error('נדרשים תשעה כרטיסי ילדים');
    const walk = (x, source=false) => {
      if(!x || typeof x!=='object')return;
      for(const [k,v] of Object.entries(x)) {
        if(['__proto__','constructor','prototype'].includes(k))throw Error('שדה לא תקין');
        if (!source && (k==='id'||k.endsWith('Id')||k==='child'||k==='templateId') && v!==null && v!==undefined && v!=='' && !/^[a-zA-Z0-9_@.:-]+$/.test(String(v)))throw Error('מזהה לא תקין');
        walk(v, source || k==='source');
      }
    };
    walk(s);
    if(new TextEncoder().encode(JSON.stringify(s)).length>4500000)throw Error('קובץ הנתונים גדול מדי');
    return s;
  }
  root.SyncMerge={ merge, validateState };
  if(typeof module!=='undefined')module.exports=root.SyncMerge;
})(typeof window!=='undefined'?window:globalThis);

