import { beforeEach, expect, it, vi } from 'vitest';
import { defaultAnalyticsPreferences, parseAnalyticsPreferences, loadAnalyticsPreferences, saveAnalyticsPreferences, resetAnalyticsPreferences, moveAnalyticsWidget } from './analyticsPreferences';
beforeEach(()=>localStorage.clear());
it('normalizes known ordinary widgets, rejects malformed or future schema and cannot hide urgent/setup',()=>{
 expect(parseAnalyticsPreferences('{broken')).toEqual(defaultAnalyticsPreferences());
 expect(parseAnalyticsPreferences(JSON.stringify({version:2,order:['equipment'],hidden:['vehicles']}))).toEqual(defaultAnalyticsPreferences());
 expect(parseAnalyticsPreferences(JSON.stringify({version:1,order:['equipment','equipment','urgent','metrics'],hidden:['setup','equipment','equipment']}))).toEqual({version:1,order:['equipment','metrics','outlook','vehicles'],hidden:['equipment']});
});
it('isolates managers and reset clears only the selected manager',()=>{
 saveAnalyticsPreferences('manager-a',{version:1,order:['equipment','metrics','outlook','vehicles'],hidden:['vehicles']});
 expect(loadAnalyticsPreferences('manager-a').hidden).toEqual(['vehicles']);
 expect(loadAnalyticsPreferences('manager-b')).toEqual(defaultAnalyticsPreferences());
 resetAnalyticsPreferences('manager-b');expect(loadAnalyticsPreferences('manager-a').hidden).toEqual(['vehicles']);
 expect(resetAnalyticsPreferences('manager-a')).toEqual(defaultAnalyticsPreferences());
 expect(loadAnalyticsPreferences('manager-a')).toEqual(defaultAnalyticsPreferences());
});
it('moves widgets predictably and ignores unknown or edge moves',()=>{
 const p=defaultAnalyticsPreferences();expect(moveAnalyticsWidget(p,'outlook',-1).order).toEqual(['outlook','metrics','vehicles','equipment']);
 expect(moveAnalyticsWidget(p,'metrics',-1)).toEqual(p);expect(moveAnalyticsWidget(p,'urgent' as any,1)).toEqual(p);
});
it('falls back safely and reports failure when browser storage is blocked',()=>{
 const get=vi.spyOn(Storage.prototype,'getItem').mockImplementation(()=>{throw new Error('blocked');});
 const set=vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new Error('blocked');});
 const remove=vi.spyOn(Storage.prototype,'removeItem').mockImplementation(()=>{throw new Error('blocked');});
 expect(loadAnalyticsPreferences('manager')).toEqual(defaultAnalyticsPreferences());
 expect(saveAnalyticsPreferences('manager',defaultAnalyticsPreferences())).toBe(false);
 expect(resetAnalyticsPreferences('manager')).toEqual(defaultAnalyticsPreferences());
 get.mockRestore();set.mockRestore();remove.mockRestore();
});
