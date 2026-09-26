import { chromium, firefox, expect } from '@playwright/test';
import { createServer } from 'vite';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Only generated localhost fixtures and their isolated storage are mutated.
const output = resolve('output/highlights', new Date().toISOString().replace(/[:.]/g, '-'));
mkdirSync(output, {recursive:true});
const server = await createServer({root:process.cwd(),configFile:resolve('vite.config.ts'),logLevel:'error',server:{host:'127.0.0.1',port:0}});
const results: Array<{browser:string;theme:string;status:string}> = [];
await server.listen();
try {
    const address = server.httpServer!.address();
    if (!address || typeof address === 'string') throw new Error('Missing fixture server');
    const origin = `http://127.0.0.1:${address.port}`;
    for (const [name, engine] of [['chromium',chromium],['firefox',firefox]] as const) {
        const browser = await engine.launch({headless:true});
        try {
            for (const theme of ['light','dark']) {
                const context = await browser.newContext({viewport:{width:1280,height:800},locale:'en-US'});
                try {
                    const reader = await context.newPage();
                    const readerUrl = `${origin}/mocks/components/reader-panel/index.html?theme=${theme}`;
                    await reader.goto(readerUrl);
                    await reader.locator('.reader-markdown strong').first().dblclick();
                    await reader.locator('.reader-comment-action [data-color="blue"]').click();
                    await expect(reader.locator('.reader-text-highlights [data-color="blue"]')).toHaveCount(1);
                    await reader.goto(readerUrl);
                    await expect(reader.locator('.reader-text-highlights [data-color="blue"]')).toHaveCount(1);
                    expect(await reader.locator('.reader-text-highlights').evaluate(el=>getComputedStyle(el).mixBlendMode)).toBe(theme==='dark'?'screen':'multiply');
                    const second = await context.newPage();
                    await second.goto(`${readerUrl}&conversation=visual-second`);
                    await second.locator('.reader-markdown strong').first().dblclick();
                    await second.locator('.reader-comment-action [data-color="blue"]').click();
                    const library = await context.newPage();
                    await library.goto(`${origin}/mocks/components/bookmarks-workspace/index.html?theme=${theme}`);
                    await library.locator('[data-action="set-bookmarks-tab"][data-tab="bookmarks"]').click();
                    await library.locator('[data-action="library-highlights"]').click();
                    await expect(library.locator('.library-conversation-header')).toHaveCount(2);
                    if(await library.locator('[data-conversation-id="visual-reader"]').getAttribute('aria-expanded')!=='true') await library.locator('[data-conversation-id="visual-reader"]').click();
                    await expect(library.locator('.library-mark-record')).toHaveCount(1);
                    await library.locator('.library-mark-record').click();
                    await expect(library.locator('.library-detail a')).toHaveAttribute('href','https://chatgpt.com/c/visual-reader');
                    await library.locator('.library-detail [data-color="yellow"]').click();
                    await expect(reader.locator('.reader-text-highlights [data-color="yellow"]')).toHaveCount(1);
                    await expect(second.locator('.reader-text-highlights [data-color="blue"]')).toHaveCount(1);
                    await reader.screenshot({path:resolve(output,`${name}-${theme}-restored.png`)});
                    await library.locator('.library-detail').getByRole('button',{name:'Delete',exact:true}).click();
                    await library.locator('[data-action="modal-confirm"]').click();
                    await expect(library.locator('.library-mark-record')).toHaveCount(1);
                    await expect(reader.locator('.reader-text-highlights [data-color]')).toHaveCount(0);
                    await reader.locator('.reader-markdown strong').first().dblclick();
                    await reader.locator('.reader-comment-action [data-color="blue"]').click();
                    await expect(library.locator('.library-conversation-header')).toHaveCount(2);
                    const currentGroup = library.locator('.library-conversation-group').filter({has:library.locator('[data-conversation-id="visual-reader"]')});
                    await currentGroup.locator('.library-conversation-toggle').click();
                    await currentGroup.getByRole('button',{name:'Rename conversation',exact:true}).click();
                    await library.locator('.mock-modal__input').fill('Study notes');
                    await library.locator('[data-action="modal-confirm"]').click();
                    await expect(library.locator('.mock-modal')).toHaveCount(0);
                    await expect(currentGroup.locator('.library-conversation-toggle')).toContainText('Study notes');
                    const folders=library.locator('.library-mark-folders');
                    await folders.getByRole('button',{name:'Create new folder',exact:true}).click();
                    await library.locator('.mock-modal__input').fill('Research');
                    await library.locator('[data-action="modal-confirm"]').click();
                    await expect(library.locator('.mock-modal')).toHaveCount(0);
                    await folders.getByRole('button',{name:'All',exact:true}).click();
                    await currentGroup.locator('.library-conversation-toggle').click();
                    await currentGroup.getByRole('button',{name:'Move conversations',exact:true}).click();
                    await library.getByRole('option',{name:'Research',exact:true}).click();
                    await library.getByRole('button',{name:'Confirm',exact:true}).click();
                    await expect(library.locator('.mock-modal')).toHaveCount(0);
                    await folders.getByRole('button',{name:'Research',exact:true}).click();
                    await expect(library.locator('.library-conversation-header')).toHaveCount(1);
                    await expect(library.locator('.library-conversation-toggle')).toContainText('Study notes');
                    await library.screenshot({path:resolve(output,`${name}-${theme}-folders.png`)});
                    await library.setViewportSize({width:375,height:667});
                    const panelBounds=await library.locator('.panel-window--bookmarks').evaluate(el=>({width:el.clientWidth,scroll:el.scrollWidth}));
                    expect(panelBounds.scroll,'Narrow mark library must not overflow').toBeLessThanOrEqual(panelBounds.width+1);
                    const folderActionBounds=await folders.locator('.library-folder-actions').evaluate(el=>{
                        const bounds=el.getBoundingClientRect();
                        return Array.from(el.querySelectorAll('button')).map(button=>({left:button.getBoundingClientRect().left-bounds.left,right:button.getBoundingClientRect().right-bounds.right}));
                    });
                    expect(folderActionBounds).toHaveLength(3);
                    for(const bounds of folderActionBounds){
                        expect(bounds.left,'Folder action must stay inside the narrow sidebar').toBeGreaterThanOrEqual(-1);
                        expect(bounds.right,'Folder action must not be clipped').toBeLessThanOrEqual(1);
                    }
                    await library.screenshot({path:resolve(output,`${name}-${theme}-folders-narrow.png`)});
                    await library.setViewportSize({width:1280,height:800});

                    await library.goto(`${origin}/mocks/components/bookmarks-workspace/index.html?theme=${theme}&view=library`);
                    await library.locator('[data-action="library-highlights"]').click();
                    await expect(library.locator('[data-conversation-id="visual-reader"]')).toContainText('Study notes');
                    const marks = library.locator('.library-marks');
                    await marks.getByRole('button',{name:'Manage selection',exact:true}).click();
                    await expect(marks.locator('[aria-label="Manage selection"]')).toBeHidden();
                    await marks.locator('[data-action="select-all-results"]').click();
                    await marks.locator('.library-batch [data-color="red"]').click();
                    await expect(reader.locator('.reader-text-highlights [data-color="red"]')).toHaveCount(1);
                    await expect(second.locator('.reader-text-highlights [data-color="red"]')).toHaveCount(1);
                    await library.screenshot({path:resolve(output,`${name}-${theme}-conversations-batch.png`)});
                    await marks.locator('[data-action="select-all-results"]').click();
                    await marks.locator('.library-batch').getByRole('button',{name:'Delete',exact:true}).click();
                    await library.getByRole('button',{name:'Cancel',exact:true}).click();
                    await expect(library.locator('.mock-modal')).toHaveCount(0);
                    await expect(library.locator('.library-conversation-header')).toHaveCount(2);
                    await marks.locator('.library-batch').getByRole('button',{name:'Delete',exact:true}).click();
                    await library.locator('[data-action="modal-confirm"]').click();
                    await expect(library.locator('.library-mark-record')).toHaveCount(0);
                    await expect(reader.locator('.reader-text-highlights [data-color]')).toHaveCount(0);
                    await expect(second.locator('.reader-text-highlights [data-color]')).toHaveCount(0);
                    results.push({browser:name,theme,status:'passed'});
                    process.stdout.write(`PASS ${name} ${theme}: select → restore → conversation filter → recolor → single/batch removal → cross-entry sync\n`);
                } finally {await context.close();}
            }
        } finally {await browser.close();}
    }
} finally {
    await server.close();
    writeFileSync(resolve(output,'summary.json'),JSON.stringify(results,null,2)+'\n');
    process.stdout.write(`Highlight evidence: ${output}\n`);
}
