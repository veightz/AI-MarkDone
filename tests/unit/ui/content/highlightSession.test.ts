import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HighlightSession } from '@/ui/content/highlights/HighlightSession';
import { highlightsClient } from '@/drivers/shared/clients/highlightsClient';
import type { HighlightEntry } from '@/contracts/highlights';
vi.mock('@/drivers/shared/clients/highlightsClient', () => ({highlightsClient:{list:vi.fn(),create:vi.fn(),update:vi.fn(),remove:vi.fn(),subscribe:vi.fn(()=>()=>undefined)}}));
const entry: HighlightEntry = {document:{platform:'chatgpt',conversationId:'one'},highlight:{id:'h1',itemId:'a1',target:{assistantMessageId:'a1'},quoteText:'Quote',sourceMarkdown:'Quote',selectors:{textQuote:{exact:'Quote',prefix:'',suffix:''},textPosition:{start:0,end:5},domRange:null,atomicRefs:[]},color:'blue',createdAt:1,updatedAt:1,revision:1}};
const settle = async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
beforeEach(()=>{vi.mocked(highlightsClient.list).mockReset().mockResolvedValue([entry]);vi.mocked(highlightsClient.update).mockReset();vi.mocked(highlightsClient.subscribe).mockReturnValue(()=>undefined);});
describe('Highlight view projection',()=>{
    it('ignores an older conversation response after switching identities',async()=>{
        let finish!:(entries:HighlightEntry[])=>void;
        vi.mocked(highlightsClient.list).mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;})).mockResolvedValueOnce([]);
        const session=new HighlightSession(vi.fn(),vi.fn()); session.bind(entry.document); session.bind({...entry.document,conversationId:'two'});
        await settle(); finish([entry]); await settle(); expect(session.list()).toEqual([]); session.dispose();
    });
    it('refreshes through storage subscription and drops stale replies after disposal',async()=>{
        let changed!:()=>void; const unsubscribe=vi.fn();
        vi.mocked(highlightsClient.subscribe).mockImplementation(listener=>{changed=listener;return unsubscribe;});
        const session=new HighlightSession(vi.fn(),vi.fn()); session.bind(entry.document); await settle();
        expect(session.list()[0].color).toBe('blue');
        vi.mocked(highlightsClient.list).mockResolvedValue([{...entry,highlight:{...entry.highlight,color:'red',revision:2}}]); changed(); await settle();
        expect(session.list()[0].color).toBe('red');
        session.dispose(); expect(unsubscribe).toHaveBeenCalledOnce(); expect(session.list()).toEqual([]);
    });
    it('keeps acknowledged records on a failed read or write',async()=>{
        const failed=vi.fn(); const session=new HighlightSession(vi.fn(),failed); session.bind(entry.document); await settle();
        vi.mocked(highlightsClient.list).mockRejectedValueOnce(new Error('Read failed')); await session.reload();
        expect(failed).toHaveBeenCalledOnce(); expect(session.list()).toHaveLength(1);
        vi.mocked(highlightsClient.create).mockRejectedValueOnce(new Error('Conflict'));
        await expect(session.create({...entry.highlight,color:'yellow'})).rejects.toThrow('Conflict');
        expect(session.list()[0].color).toBe('blue'); session.dispose();
    });
});
