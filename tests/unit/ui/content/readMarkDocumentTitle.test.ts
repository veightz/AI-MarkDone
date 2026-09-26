import {afterEach,expect,it,vi} from 'vitest';
import {readMarkDocumentTitle} from '@/drivers/content/chatgpt/readMarkDocumentTitle';

afterEach(()=>{vi.unstubAllGlobals();document.title='';});
it('uses current-page title only for a matching ChatGPT conversation without changing the record',()=>{
    const source={platform:'chatgpt' as const,conversationId:'one',title:null};
    vi.stubGlobal('location',{href:'https://chatgpt.com/c/one',pathname:'/c/one'});document.title='My conversation';
    expect(readMarkDocumentTitle(source).title).toBe('My conversation');expect(source.title).toBeNull();
    expect(readMarkDocumentTitle({...source,conversationId:'two'}).title).toBeNull();
    expect(readMarkDocumentTitle({...source,title:'Saved title'}).title).toBe('Saved title');
});
it('does not replace missing names with generic page titles or an ID',()=>{
    vi.stubGlobal('location',{href:'https://chatgpt.com/c/one',pathname:'/c/one'});
    for(const title of ['ChatGPT','New chat','one','https://chatgpt.com/c/one']){document.title=title;expect(readMarkDocumentTitle({platform:'chatgpt',conversationId:'one',title:null}).title).toBeNull();}
});
