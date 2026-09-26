import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MARK_LIBRARY_KEY, type MarkLibraryOperation } from '@/contracts/markLibrary';
import { PROTOCOL_VERSION, isExtRequest, type ExtRequest } from '@/contracts/protocol';
import { handleMarkLibraryRequest } from '@/runtimes/background/handlers/markLibrary';

const { data, writes } = vi.hoisted(() => ({data:{} as Record<string,unknown>,writes:vi.fn()}));
vi.mock('@/drivers/background/storage/localStoragePort',()=>({localStoragePort:{get:vi.fn(async(key:string)=>({[key]:structuredClone(data[key])})),set:vi.fn(async(patch:Record<string,unknown>)=>{writes(patch);Object.assign(data,structuredClone(patch));})}}));
const source={platform:'chatgpt' as const,conversationId:'one',title:'Source name',lastKnownUrl:'https://chatgpt.com/c/one'};
async function mutate(operation:MarkLibraryOperation,revision=0){return (await handleMarkLibraryRequest({v:PROTOCOL_VERSION,id:'test',type:'markLibrary:mutate',payload:{operation,expectedRevision:revision}}))!.response as any;}
async function read(){return (await handleMarkLibraryRequest({v:PROTOCOL_VERSION,id:'test',type:'markLibrary:get'}))!.response as any;}
describe('mark library organization',()=>{
    beforeEach(()=>{for(const key of Object.keys(data))delete data[key];writes.mockReset();});
    it('opens old records without creating a catalog or modifying their bundles',async()=>{
        data['bookmark:old']={title:'Keep'};data['aimd:highlights:document:v1:old']={preserved:true};
        expect((await read()).data.catalog.revision).toBe(0);expect(writes).not.toHaveBeenCalled();expect(data['bookmark:old']).toEqual({title:'Keep'});
    });
    it('keeps folder IDs and source names stable across shared conversation rename and move',async()=>{
        await mutate({type:'folder-put',create:true,id:'work',parentId:null,name:'Work'});
        await mutate({type:'move',documents:[source],folderId:'work'},1);
        await mutate({type:'rename',document:source,title:'My name'},2);
        await mutate({type:'folder-put',id:'work',parentId:null,name:'Archive'},3);
        const catalog=(await read()).data.catalog;
        expect(catalog.conversations[0]).toMatchObject({folderId:'work',customTitle:'My name',document:{title:'Source name'}});
        await mutate({type:'move',documents:[{...source,title:'Changed website name'}],folderId:null},4);
        expect((await read()).data.catalog.conversations[0].customTitle).toBe('My name');
        expect(Object.keys(data)).toEqual([MARK_LIBRARY_KEY]);
    });
    it('rejects stale mutations and serializes concurrent writers',async()=>{
        const results=await Promise.all([mutate({type:'folder-put',create:true,id:'a',parentId:null,name:'A'}),mutate({type:'folder-put',create:true,id:'b',parentId:null,name:'B'})]);
        expect(results.filter(r=>r.ok)).toHaveLength(1);expect(results.find(r=>!r.ok)?.error.code).toBe('CONFLICT');
    });
    it('rejects siblings with duplicate names, cycles, missing parents and a fifth level without writes',async()=>{
        for(let i=1;i<=4;i++)expect((await mutate({type:'folder-put',create:true,id:String(i),name:`Level ${i}`,parentId:i===1?null:String(i-1)},i-1)).ok).toBe(true);
        const original=structuredClone(data);
        for(const operation of [
            {type:'folder-put',create:true,id:'5',name:'Fifth',parentId:'4'},
            {type:'folder-put',id:'1',name:'Cycle',parentId:'4'},
            {type:'folder-put',create:true,id:'x',name:'Level 1',parentId:null},
            {type:'folder-put',create:true,id:'x',name:'Missing',parentId:'missing'},
        ] as MarkLibraryOperation[])expect((await mutate(operation,4)).ok).toBe(false);
        expect(data).toEqual(original);
    });
    it('does not delete occupied folders, and bulk move updates only organization',async()=>{
        await mutate({type:'folder-put',create:true,id:'work',name:'Work',parentId:null});
        await mutate({type:'move',documents:[source,{...source,conversationId:'two'}],folderId:'work'},1);
        expect((await mutate({type:'folder-remove',id:'work'},2)).ok).toBe(false);
        await mutate({type:'move',documents:[source,{...source,conversationId:'two'}],folderId:null},2);
        expect((await mutate({type:'folder-remove',id:'work'},3)).ok).toBe(true);
        expect((await read()).data.catalog.conversations).toHaveLength(2);
    });
    it('preserves corrupt catalogs and rejects malformed protocol mutations',async()=>{
        data[MARK_LIBRARY_KEY]={schemaVersion:99,raw:'retain'};
        expect((await read()).error.code).toBe('SNAPSHOT_CORRUPTED');expect((await mutate({type:'rename',document:source,title:'new'})).ok).toBe(false);expect(writes).not.toHaveBeenCalled();
        const request={v:PROTOCOL_VERSION,id:'x',type:'markLibrary:mutate',payload:{expectedRevision:-1,operation:{type:'move',documents:[],folderId:null}}};
        expect(isExtRequest(request)).toBe(false);
    });
});
